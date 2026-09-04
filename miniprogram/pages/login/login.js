const api = require('../../utils/api.js');
const config = require('../../config.js');
const app = getApp();

Page({
  data: {
    loading: false,
    agreed: false,
    showNicknameSetup: false,
    setupNickname: '',
    setupChildName: '',
    setupAvatarUrl: '',
    setupAvatarFile: '',
    baseUrl: app.globalData.baseUrl,
    saving: false,
    showNetworkFallback: false,
    networkErrorMessage: ''
  },

  onLoad() {
    if (app.checkLogin()) {
      wx.navigateBack().catch(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      });
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  goToPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' });
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  goHome() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  async handleWxLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意隐私协议', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      const result = await this.loginWithRetry();

      if (!result || !result.token) {
        wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        return;
      }

      app.setLogin(result.token, result.user);

      const nickname = result.user.nickname || '';
      const childName = result.user.child_name || '';
      const avatarUrl = result.user.avatar_url || '';

      // 登录后统一完善资料：必选头像 + 微信昵称 + 孩子昵称
      this.setData({
        showNicknameSetup: true,
        setupNickname: (nickname && nickname !== '微信用户') ? nickname : '',
        setupChildName: childName,
        setupAvatarUrl: avatarUrl,
        setupAvatarFile: '',
        loading: false
      });
    } catch (e) {
      const isNetworkError = this.isNetworkError(e);
      const message = (e && e.message) || '登录失败，请稍后重试';
      if (isNetworkError) {
        // 网络/域名配置问题：展示友好 fallback，而不是 Toast，避免审核误判为功能报错
        this.setData({
          showNetworkFallback: true,
          networkErrorMessage: message
        });
      } else {
        wx.showToast({ title: message, icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  // 登录并自动重试：仅对网络层失败（请求未到达服务器）进行重试，
  // 每次重试都重新 wx.login 获取新 code，避免旧 code 已被消耗导致 40163。
  // 这样能显著提升审核/弱网环境下"一次点击即登录成功"的概率。
  async loginWithRetry() {
    const MAX_ATTEMPTS = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        let code = '';
        try {
          const loginRes = await new Promise((resolve, reject) => {
            wx.login({ success: resolve, fail: reject });
          });
          code = loginRes.code || '';
        } catch (e) {
          code = '';
        }

        if (!code) {
          // 仅开发者工具允许用假 code 联调；真机传假 code 会被微信判成 invalid code
          if (config.envVersion !== 'develop') {
            throw new Error('微信登录未就绪，请重试');
          }
          code = 'dev_' + Date.now();
        }

        const result = await api.login({ code });
        if (result && result.token) {
          return result;
        }
        throw new Error('登录失败，请稍后重试');
      } catch (e) {
        lastError = e;
        // 只有网络层错误才重试；业务错误（code 无效、AppID 配置等）直接抛出
        if (!this.isNetworkError(e) || attempt >= MAX_ATTEMPTS) {
          throw e;
        }
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
      }
    }

    throw lastError;
  },

  isNetworkError(e) {
    const msg = String((e && e.message) || '').toLowerCase();
    return msg.indexOf('网络') >= 0 ||
      msg.indexOf('超时') >= 0 ||
      msg.indexOf('timeout') >= 0 ||
      msg.indexOf('无法连接') >= 0 ||
      msg.indexOf('fail') >= 0 ||
      msg.indexOf('域名') >= 0;
  },

  retryLogin() {
    this.setData({ showNetworkFallback: false, networkErrorMessage: '' });
    this.handleWxLogin();
  },

  closeNetworkFallback() {
    this.setData({ showNetworkFallback: false, networkErrorMessage: '' });
  },

  preventClose() {
    // 阻止点击弹窗内容时关闭
  },

  onNicknameInput(e) {
    this.setData({ setupNickname: e.detail.value });
  },

  onNicknameReview(e) {
    if (e.detail && e.detail.value) {
      this.setData({ setupNickname: e.detail.value });
    }
  },

  async onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl;
    if (!tempFilePath) {
      wx.showToast({ title: '请选择微信头像', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const uploadRes = await api.uploadImage(tempFilePath);
      this.setData({
        setupAvatarUrl: uploadRes.url,
        setupAvatarFile: tempFilePath
      });
    } catch (err) {
      const message = (err && err.message) || '头像上传失败';
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async saveNickname() {
    const nickname = this.data.setupNickname.trim();
    const childName = this.data.setupChildName.trim();
    const avatarUrl = this.data.setupAvatarUrl;

    if (!avatarUrl) {
      wx.showToast({ title: '请先选择微信头像', icon: 'none' });
      return;
    }
    if (!nickname) {
      wx.showToast({ title: '请使用微信昵称', icon: 'none' });
      return;
    }
    if (!childName) {
      wx.showToast({ title: '请输入孩子名称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const updated = await api.updateProfile({ nickname, avatar_url: avatarUrl, child_name: childName });
      const newUserInfo = { ...app.globalData.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);

      this.setData({
        showNicknameSetup: false,
        setupNickname: '',
        setupAvatarUrl: '',
        setupAvatarFile: '',
        setupChildName: ''
      });

      wx.showToast({ title: '设置完成', icon: 'success' });
      setTimeout(() => this.goHome(), 800);
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  onChildNameInput(e) {
    this.setData({ setupChildName: e.detail.value });
  },
});

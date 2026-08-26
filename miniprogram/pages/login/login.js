const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    loading: false,
    agreed: false,
    showNicknameSetup: false,
    showChildSetup: false,
    setupNickname: '',
    setupChildName: '',
    setupAvatarUrl: '',
    setupAvatarFile: '',
    saving: false
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
      let code = '';
      try {
        const loginRes = await new Promise((resolve, reject) => {
          wx.login({ success: resolve, fail: reject });
        });
        code = loginRes.code || '';
      } catch (e) {
        code = 'dev_' + Date.now();
      }

      const result = await api.login({ code });

      if (!result || !result.token) {
        wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        return;
      }

      app.setLogin(result.token, result.user);

      const nickname = result.user.nickname || '';
      const childName = result.user.child_name || '';

      if (nickname === '微信用户' || nickname === '') {
        this.setData({
          showNicknameSetup: true,
          setupNickname: '',
          loading: false
        });
      } else if (!childName) {
        this.setData({
          showChildSetup: true,
          setupChildName: '',
          loading: false
        });
      } else {
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => this.goHome(), 800);
      }
    } catch (e) {
      const message = (e && e.message) || '登录失败，请稍后重试';
      wx.showToast({ title: message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
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
    if (!tempFilePath) return;

    this.setData({ saving: true });
    try {
      const uploadRes = await api.uploadImage(tempFilePath);
      this.setData({
        setupAvatarUrl: uploadRes.url,
        setupAvatarFile: tempFilePath
      });
    } catch (err) {
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async saveNickname() {
    const nickname = this.data.setupNickname.trim();
    const avatarUrl = this.data.setupAvatarUrl;

    if (!nickname) {
      wx.showToast({ title: '请输入你的昵称', icon: 'none' });
      return;
    }
    if (!avatarUrl) {
      wx.showToast({ title: '请选择头像', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const updated = await api.updateProfile({ nickname, avatar_url: avatarUrl });
      const newUserInfo = { ...app.globalData.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);

      this.setData({
        showNicknameSetup: false,
        setupNickname: '',
        setupAvatarUrl: '',
        setupAvatarFile: ''
      });

      if (!newUserInfo.child_name) {
        this.setData({
          showChildSetup: true,
          setupChildName: ''
        });
      } else {
        wx.showToast({ title: '设置完成', icon: 'success' });
        setTimeout(() => this.goHome(), 800);
      }
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  onChildNameInput(e) {
    this.setData({ setupChildName: e.detail.value });
  },

  async saveChildName() {
    const childName = this.data.setupChildName.trim();
    if (!childName) {
      wx.showToast({ title: '请输入孩子名称', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const updated = await api.updateProfile({ child_name: childName });
      const newUserInfo = { ...app.globalData.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);

      this.setData({ showChildSetup: false, setupChildName: '' });
      wx.showToast({ title: '设置完成', icon: 'success' });
      setTimeout(() => this.goHome(), 800);
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});

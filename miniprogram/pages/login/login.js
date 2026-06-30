const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    loading: false,
    agreed: false
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

      let result;
      let useDevMode = !code || code.startsWith('dev_');

      try {
        result = await api.login({
          code,
          nickname: '微信用户',
          avatar_url: null,
          child_name: null
        });
      } catch (e) {
        if (!useDevMode) {
          code = 'dev_' + Date.now();
          result = await api.login({
            code,
            nickname: '微信用户',
            avatar_url: null,
            child_name: null
          });
        } else {
          throw e;
        }
      }

      if (!result || !result.token) {
        wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        return;
      }

      app.setLogin(result.token, result.user);

      wx.showToast({ title: '登录成功', icon: 'success' });
      
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) {
          wx.navigateBack();
        } else {
          wx.reLaunch({ url: '/pages/index/index' });
        }
      }, 1000);
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});

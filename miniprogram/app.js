const config = require('./config');

App({
  globalData: {
    baseUrl: config.apiBaseUrl,
    appVersion: config.appVersion,
    userInfo: null,
    token: null
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }

    // 版本更新：新版本下载完成后提示用户重启，避免老用户长期停留在旧版本
    if (wx.getUpdateManager) {
      const updateManager = wx.getUpdateManager();
      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success(res) {
            if (res.confirm) updateManager.applyUpdate();
          }
        });
      });
    }
  },

  checkLogin() {
    return !!this.globalData.token;
  },

  requireLogin() {
    if (!this.checkLogin()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return false;
    }
    return true;
  },

  setLogin(token, userInfo) {
    this.globalData.token = token;
    this.globalData.userInfo = userInfo;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);
  },

  logout() {
    this.globalData.token = null;
    this.globalData.userInfo = null;
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
  }
});
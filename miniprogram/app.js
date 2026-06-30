App({
  globalData: {
    baseUrl: 'http://124.220.103.120:3456',
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

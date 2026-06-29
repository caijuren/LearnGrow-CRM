const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    checkins: [],
    loading: true,
    baseUrl: app.globalData.baseUrl,
    isLoggedIn: false
  },

  onLoad() {
    this.setData({ isLoggedIn: app.checkLogin() });
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.loadCheckins();
    }
  },

  async loadCheckins() {
    this.setData({ loading: true });
    try {
      const checkins = await api.getMyCheckins();
      this.setData({ checkins });
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    if (app.checkLogin()) {
      this.loadCheckins().then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  }
});

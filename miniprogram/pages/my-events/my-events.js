const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    checkins: [],
    loading: true,
    loadedOnce: false,
    isLoggedIn: false
  },

  onLoad() {
    this.setData({ isLoggedIn: app.checkLogin() });
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.loadEvents();
    }
  },

  async loadEvents() {
    this.setData({ loading: true });
    try {
      const checkins = await api.getMyCheckins();
      this.setData({ checkins });
    } catch (e) {
      wx.showToast({ title: '活动加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/profile/profile' })
    });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    if (app.checkLogin()) {
      this.loadEvents().then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  }
});

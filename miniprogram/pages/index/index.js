const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    events: [],
    userInfo: null,
    loading: true,
    isLoggedIn: false
  },

  onLoad() {
    this.setData({ 
      isLoggedIn: app.checkLogin(),
      userInfo: app.globalData.userInfo 
    });
  },

  onShow() {
    this.setData({ 
      isLoggedIn: app.checkLogin(),
      userInfo: app.globalData.userInfo 
    });
    this.loadEvents();
  },

  async loadEvents() {
    this.setData({ loading: true });
    try {
      const events = await api.getEvents();
      this.setData({ events });
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
    }
  },

  async handleJoin(e) {
    if (!app.requireLogin()) return;
    const { id, name } = e.currentTarget.dataset;
    try {
      await api.joinEvent(id);
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.loadEvents();
    } catch (e) {
      console.error(e);
    }
  },

  handleQuickCheckin(e) {
    if (!app.requireLogin()) return;
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}&autoCheckin=1` });
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goToRanking(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/ranking/ranking?id=${id}` });
  },

  goToMyCheckins() {
    wx.navigateTo({ url: '/pages/my-checkins/my-checkins' });
  },

  goToProfile() {
    wx.navigateTo({ url: '/pages/profile/profile' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    this.loadEvents().then(() => wx.stopPullDownRefresh());
  }
});

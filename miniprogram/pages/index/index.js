const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    events: [],
    userInfo: null,
    loading: true
  },

  onLoad() {
    if (!app.checkLogin()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ userInfo: app.globalData.userInfo });
  },

  onShow() {
    if (app.checkLogin()) {
      this.loadEvents();
    }
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

  onPullDownRefresh() {
    this.loadEvents().then(() => wx.stopPullDownRefresh());
  }
});

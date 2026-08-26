const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    upcomingEvents: [],
    ongoingEvents: [],
    expiredEvents: [],
    todaySummary: {
      pending: 0,
      completed: 0,
      joined: 0,
      nextEvent: null
    },
    userInfo: null,
    loading: true,
    isLoggedIn: false,
    baseUrl: app.globalData.baseUrl
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
      const upcomingEvents = events.filter(e => e.event_status === 'upcoming');
      const ongoingEvents = events.filter(e => e.event_status === 'ongoing');
      const expiredEvents = events.filter(e => e.event_status === 'expired');

      const joinedEvents = ongoingEvents.filter(e => e.is_joined);
      const pendingEvents = joinedEvents.filter(e => !e.today_checked);
      const completedEvents = joinedEvents.filter(e => e.today_checked);
      this.setData({
        upcomingEvents,
        ongoingEvents,
        expiredEvents,
        todaySummary: {
          pending: pendingEvents.length,
          completed: completedEvents.length,
          joined: joinedEvents.length,
          nextEvent: pendingEvents[0] || joinedEvents[0] || null
        }
      });
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

  goToTodayTask() {
    if (!app.requireLogin()) return;
    const nextEvent = this.data.todaySummary.nextEvent;
    if (!nextEvent) {
      wx.showToast({ title: '暂无待打卡活动', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${nextEvent.id}&autoCheckin=${nextEvent.today_checked ? 0 : 1}` });
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
    wx.reLaunch({ url: '/pages/my-checkins/my-checkins' });
  },

  goToProfile() {
    wx.reLaunch({ url: '/pages/profile/profile' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    this.loadEvents().then(() => wx.stopPullDownRefresh());
  }
});

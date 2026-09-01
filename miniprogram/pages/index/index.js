const api = require('../../utils/api.js');
const avatarUtil = require('../../utils/avatar.js');
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
    todayRingPercent: 0,
    loadedOnce: false,
    userInfo: null,
    loading: true,
    isLoggedIn: false,
    baseUrl: app.globalData.baseUrl,
    brokenAvatars: {},
    showLoginPrompt: false
  },

  onAvatarError(e) {
    avatarUtil.onAvatarError(e, this);

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

      const enrichEvent = (e) => ({
        ...e,
        progressPercent: e.total_days > 0 ? Math.round((e.my_checkin_days / e.total_days) * 100) : 0
      });
      upcomingEvents.forEach((e, i) => upcomingEvents[i] = enrichEvent(e));
      ongoingEvents.forEach((e, i) => ongoingEvents[i] = enrichEvent(e));
      expiredEvents.forEach((e, i) => expiredEvents[i] = enrichEvent(e));
      this.setData({
        upcomingEvents,
        ongoingEvents,
        expiredEvents,
        todaySummary: {
          pending: pendingEvents.length,
          completed: completedEvents.length,
          joined: joinedEvents.length,
          nextEvent: pendingEvents[0] || joinedEvents[0] || null
        },
        todayRingPercent: joinedEvents.length > 0 ? Math.round((completedEvents.length / joinedEvents.length) * 100) : 0
      });
    } catch (e) {
      wx.showToast({ title: '活动加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },

  async handleJoin(e) {
    if (!app.requireLogin()) return;
    const { id } = e.currentTarget.dataset;
    try {
      await api.joinEvent(id);
      wx.showToast({ title: '报名成功', icon: 'success' });
      this.loadEvents();
    } catch (e) {
      // api.js 已展示具体错误信息
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
    if (!app.checkLogin()) {
      this.setData({ showLoginPrompt: true });
      return;
    }
    wx.navigateTo({ url: '/pages/my-checkins/my-checkins' });
  },

  goToProfile() {
    if (!app.checkLogin()) {
      this.setData({ showLoginPrompt: true });
      return;
    }
    wx.navigateTo({ url: '/pages/profile/profile' });

  },

  preventClose() {
    // 阻止冒泡，避免点击弹窗内容时关闭
  },

  closeLoginPrompt() {
    this.setData({ showLoginPrompt: false });
  },

  confirmLoginPrompt() {
    this.setData({ showLoginPrompt: false });
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    this.loadEvents().then(() => wx.stopPullDownRefresh());
  },

  onShareAppMessage() {
    return {
      title: '源来是糖 · 每天坚持，养成好习惯',
      path: '/pages/index/index',
      imageUrl: `${this.data.baseUrl}/uploads/share_brand.png`,
    };
  }
});

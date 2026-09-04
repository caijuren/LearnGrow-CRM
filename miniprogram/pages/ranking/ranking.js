const api = require('../../utils/api.js');
const avatarUtil = require('../../utils/avatar.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    events: [],
    eventNames: [],
    eventIndex: 0,
    ranking: [],
    myRank: null,
    loading: true,
    isLoggedIn: false,
    baseUrl: app.globalData.baseUrl,
    brokenAvatars: {}
  },

  onAvatarError(e) {
    avatarUtil.onAvatarError(e, this);
  },

  async onLoad() {
    this.setData({ isLoggedIn: app.checkLogin() });
    const pendingId = app.globalData.rankingEventId;
    if (pendingId) {
      app.globalData.rankingEventId = null;
      this.setData({ eventId: parseInt(pendingId, 10) });
      await this.loadEvents(pendingId);
      this.loadRanking();
    } else {
      await this.initDefaultEvent();
    }
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    // 设置自定义 tabBar 选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    // 从详情页/首页「排行榜」按钮跳转过来时，通过全局变量传递活动 id
    const pendingId = app.globalData.rankingEventId;
    if (pendingId && parseInt(pendingId, 10) !== this.data.eventId) {
      app.globalData.rankingEventId = null;
      this.setData({ eventId: parseInt(pendingId, 10) });
      this.loadEvents(pendingId);
      this.loadRanking();
    }
  },

  onPullDownRefresh() {
    this.loadRanking().then(() => wx.stopPullDownRefresh());
  },

  async loadEvents(preferredId) {
    try {
      const events = await api.getEvents();
      const names = events.map(e => e.name);
      let idx = 0;
      if (preferredId) {
        const found = events.findIndex(e => e.id === parseInt(preferredId, 10));
        if (found >= 0) idx = found;
      }
      this.setData({ events, eventNames: names, eventIndex: idx });
    } catch (e) {
      // 活动列表加载失败不阻断排名展示
    }
  },

  async initDefaultEvent() {
    try {
      const events = await api.getEvents();
      const names = events.map(e => e.name);
      // 优先选进行中的活动，其次即将开始，最后第一个
      let idx = events.findIndex(e => e.event_status === 'ongoing');
      if (idx < 0) idx = events.findIndex(e => e.event_status === 'upcoming');
      if (idx < 0) idx = 0;
      this.setData({
        events,
        eventNames: names,
        eventIndex: idx,
        eventId: events[idx] ? events[idx].id : null
      });
      this.loadRanking();
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onEventChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const event = this.data.events[idx];
    if (!event) return;
    this.setData({ eventIndex: idx, eventId: event.id });
    this.loadRanking();
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  async loadRanking() {
    if (!this.data.eventId) return;
    this.setData({ loading: true });
    try {
      const ranking = await api.getRanking(this.data.eventId);
      const myIndex = ranking.findIndex(item => item.is_me);
      let myRank = null;
      if (myIndex >= 0) {
        const previous = myIndex > 0 ? ranking[myIndex - 1] : null;
        myRank = {
          ...ranking[myIndex],
          gap_to_previous: previous ? Math.max(0, previous.checkin_days - ranking[myIndex].checkin_days) : 0
        };
      }
      this.setData({ ranking, myRank, brokenAvatars: {} });
    } catch (e) {
      wx.showToast({ title: '排行榜加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  }
});

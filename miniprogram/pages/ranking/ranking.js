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

  async onLoad(options) {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (options.id) {
      this.setData({ eventId: parseInt(options.id) });
      // 有指定活动时也加载活动列表，用于顶部选择器
      await this.loadEvents(options.id);
      this.loadRanking();
    } else {
      // 底部 tab 进入：无指定活动，默认选第一个进行中的活动
      await this.initDefaultEvent();
    }
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
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
    wx.reLaunch({ url: '/pages/index/index' });
  },

  goToProfile() {
    wx.reLaunch({ url: '/pages/profile/profile' });
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

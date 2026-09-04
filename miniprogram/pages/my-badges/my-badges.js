const api = require('../../utils/api.js');
const timeUtil = require('../../utils/time.js');
const app = getApp();

Page({
  data: {
    badges: [],
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
      this.loadBadges();
    }
  },

  async loadBadges() {
    this.setData({ loading: true });
    try {
      const badges = (await api.getMyBadges() || []).map(b => ({
        ...b,
        achievedDate: b.achieved_at ? timeUtil.formatBJT(b.achieved_at) : ''
      }));
      this.setData({ badges });
    } catch (e) {
      wx.showToast({ title: '徽章加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: '/pages/profile/profile' })
    });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    if (app.checkLogin()) {
      this.loadBadges().then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  }
});

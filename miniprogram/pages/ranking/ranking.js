const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    ranking: []
  },

  onLoad(options) {
    if (!app.checkLogin()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ eventId: parseInt(options.id) });
    this.loadRanking();
  },

  async loadRanking() {
    try {
      const ranking = await api.getRanking(this.data.eventId);
      this.setData({ ranking });
    } catch (e) {
      console.error(e);
    }
  }
});

const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    ranking: [],
    isLoggedIn: false
  },

  onLoad(options) {
    this.setData({ 
      eventId: parseInt(options.id),
      isLoggedIn: app.checkLogin()
    });
    this.loadRanking();
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
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

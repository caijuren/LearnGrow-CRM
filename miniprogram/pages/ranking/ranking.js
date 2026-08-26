const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    ranking: [],
    myRank: null,
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
      const myIndex = ranking.findIndex(item => item.is_me);
      let myRank = null;
      if (myIndex >= 0) {
        const previous = myIndex > 0 ? ranking[myIndex - 1] : null;
        myRank = {
          ...ranking[myIndex],
          gap_to_previous: previous ? Math.max(0, previous.checkin_days - ranking[myIndex].checkin_days) : 0
        };
      }
      this.setData({ ranking, myRank });
    } catch (e) {
      wx.showToast({ title: '排行榜加载失败', icon: 'none' });
    }
  }
});

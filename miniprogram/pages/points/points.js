const api = require('../../utils/api.js');
const timeUtil = require('../../utils/time.js');

Page({
  data: {
    balance: 0,
    items: [],
    loading: true,
    loadedOnce: false
  },

  onLoad() {
    this.loadPoints();
  },

  async loadPoints() {
    this.setData({ loading: true });
    try {
      const p = await api.getMyPoints();
      const items = (p.items || []).map(item => ({
        ...item,
        created_at: timeUtil.formatBJT(item.created_at)
      }));
      this.setData({
        balance: p.balance || 0,
        items
      });
    } catch (e) {
      wx.showToast({ title: '积分明细加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },

  onPullDownRefresh() {
    this.loadPoints().then(() => wx.stopPullDownRefresh());
  }
});

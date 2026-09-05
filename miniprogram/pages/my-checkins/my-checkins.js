const api = require('../../utils/api.js');
const app = getApp();

// 把 "YYYY-MM-DD" 转成 "M月D日"，避免 Date 解析时区歧义（纯字符串处理）
function formatCheckinDate(dateStr) {
  const parts = String(dateStr || '').split('-');
  if (parts.length !== 3) return dateStr || '';
  return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
}

Page({
  data: {
    feed: [],
    stats: {
      totalDays: 0,
      maxStreak: 0,
      totalEvents: 0
    },
    loading: true,
    loadedOnce: false,
    baseUrl: app.globalData.baseUrl,
    isLoggedIn: false
  },

  onLoad() {
    this.setData({ isLoggedIn: app.checkLogin() });
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.loadCheckins();
    }
  },

  async loadCheckins() {
    this.setData({ loading: true });
    try {
      const checkins = await api.getMyCheckins();

      // 统计概览：累计打卡天数、最长连续、参与活动数
      let totalDays = 0;
      let maxStreak = 0;
      const feed = [];

      for (const c of checkins) {
        totalDays += c.checkin_days || 0;
        if ((c.max_streak || 0) > maxStreak) maxStreak = c.max_streak;
        for (const r of c.records) {
          if (r.status !== 'approved') continue; // 只展示已通过的打卡
          feed.push({
            ...r,
            event_id: c.event.id,
            event_name: c.event.name,
            dateText: formatCheckinDate(r.checkin_date)
          });
        }
      }

      // 按打卡日期倒序，最新的在上面
      feed.sort((a, b) => String(b.checkin_date).localeCompare(String(a.checkin_date)));

      this.setData({
        feed,
        stats: {
          totalDays,
          maxStreak,
          totalEvents: checkins.length
        }
      });
    } catch (e) {
      wx.showToast({ title: '打卡记录加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false, loadedOnce: true });
    }
  },

  goToEvent(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/profile/profile' })
    });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPullDownRefresh() {
    if (app.checkLogin()) {
      this.loadCheckins().then(() => wx.stopPullDownRefresh());
    } else {
      wx.stopPullDownRefresh();
    }
  }
});

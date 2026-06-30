const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    userInfo: null,
    myCheckins: [],
    myBadges: [],
    totalDays: 0,
    totalStreak: 0,
    joinedEvents: 0,
    editing: false,
    editNickname: '',
    editChildName: '',
    saving: false,
    isLoggedIn: false
  },

  onLoad() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.setData({ userInfo: app.globalData.userInfo });
    }
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.setData({ userInfo: app.globalData.userInfo });
      this.loadStats();
    }
  },

  async loadStats() {
    try {
      const myCheckins = await api.getMyCheckins();
      let totalDays = 0;
      let maxStreak = 0;
      const activeCount = myCheckins.filter(c => c.event.status === 'active').length;
      
      for (const c of myCheckins) {
        totalDays += c.checkin_days;
        if (c.max_streak > maxStreak) maxStreak = c.max_streak;
      }

      let myBadges = [];
      try {
        myBadges = await api.getMyBadges() || [];
      } catch (e) { console.log('徽章加载失败', e); }

      this.setData({
        myCheckins,
        myBadges,
        totalDays,
        totalStreak: maxStreak,
        joinedEvents: myCheckins.length
      });
    } catch (e) {
      console.error(e);
    }
  },

  startEdit() {
    this.setData({
      editing: true,
      editNickname: this.data.userInfo.nickname || '',
      editChildName: this.data.userInfo.child_name || ''
    });
  },

  cancelEdit() {
    this.setData({ editing: false });
  },

  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  onChildNameInput(e) {
    this.setData({ editChildName: e.detail.value });
  },

  async saveProfile() {
    if (!this.data.editNickname.trim()) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const updated = await api.updateProfile({
        nickname: this.data.editNickname.trim(),
        child_name: this.data.editChildName.trim() || null
      });

      const newUserInfo = { ...this.data.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);
      this.setData({
        userInfo: newUserInfo,
        editing: false
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ saving: false });
    }
  },

  goToEvent(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/event-detail/event-detail?id=${id}` });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  goToMyCheckins() {
    wx.navigateTo({ url: '/pages/my-checkins/my-checkins' });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.logout();
          this.setData({ isLoggedIn: false, userInfo: null });
        }
      }
    });
  }
});

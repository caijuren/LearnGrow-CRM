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
    editAvatarUrl: '',
    editAvatarPath: '',
    saving: false,
    isLoggedIn: false,
    baseUrl: app.globalData.baseUrl,
    appVersion: app.globalData.appVersion
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
      } catch (e) {
        // 徽章加载失败不阻断主流程
      }

      this.setData({
        myCheckins,
        myBadges,
        totalDays,
        totalStreak: maxStreak,
        joinedEvents: myCheckins.length
      });
    } catch (e) {
      wx.showToast({ title: '数据加载失败', icon: 'none' });
    }
  },

  startEdit() {
    const nickname = this.data.userInfo.nickname || '';
    const avatarUrl = this.data.userInfo.avatar_url || '';
    this.setData({
      editing: true,
      editNickname: nickname === '微信用户' ? '' : nickname,
      editChildName: this.data.userInfo.child_name || '',
      editAvatarUrl: avatarUrl ? this.data.baseUrl + avatarUrl : '',
      editAvatarPath: ''
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

  async onChooseAvatar(e) {
    const tempFilePath = e.detail.avatarUrl;
    if (!tempFilePath) return;

    this.setData({ saving: true });
    try {
      const uploadRes = await api.uploadImage(tempFilePath);
      this.setData({
        editAvatarUrl: this.data.baseUrl + uploadRes.url,
        editAvatarPath: uploadRes.url
      });
    } catch (err) {
      wx.showToast({ title: '头像上传失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async saveProfile() {
    const nickname = this.data.editNickname.trim();
    const childName = this.data.editChildName.trim();

    if (!nickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    if (!childName) {
      wx.showToast({ title: '孩子名称不能为空', icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      const payload = { nickname, child_name: childName };
      if (this.data.editAvatarPath) {
        payload.avatar_url = this.data.editAvatarPath;
      }
      const updated = await api.updateProfile(payload);

      const newUserInfo = { ...this.data.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);
      this.setData({
        userInfo: newUserInfo,
        editing: false,
        editAvatarUrl: '',
        editAvatarPath: ''
      });

      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
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
    wx.reLaunch({ url: '/pages/my-checkins/my-checkins' });
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

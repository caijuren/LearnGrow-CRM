const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    event: null,
    myStats: { checkin_days: 0, current_streak: 0, max_streak: 0 },
    calendarDays: [],
    todayChecked: false,
    todayRecord: null,
    checkinNote: '',
    checkinImage: '',
    checkinImageUrl: '',
    submitting: false,
    baseUrl: app.globalData.baseUrl,
    isLoggedIn: false,
    isJoined: false,
    badges: [],
    achievedBadges: 0,
    materials: []
  },

  onLoad(options) {
    this.setData({ 
      eventId: parseInt(options.id),
      isLoggedIn: app.checkLogin()
    });
    this.loadData();
    
    if (options.autoCheckin === '1') {
      if (!app.requireLogin()) return;
      setTimeout(() => {
        wx.pageScrollTo({ selector: '.checkin-form', duration: 300 });
      }, 500);
    }
  },

  onShow() {
    this.setData({ isLoggedIn: app.checkLogin() });
    if (app.checkLogin()) {
      this.loadData();
    }
  },

  async loadData() {
    try {
      const events = await api.getEvents();
      const event = events.find(e => e.id === this.data.eventId);
      if (!event) {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        return;
      }

      let myStats = { checkin_days: 0, current_streak: 0, max_streak: 0 };
      let calendarDays = [];
      let todayChecked = false;
      let todayRecord = null;
      let isJoined = false;

      if (app.checkLogin()) {
        const myCheckins = await api.getMyCheckins();
        const myCheckin = myCheckins.find(c => c.event.id === this.data.eventId);

        const today = new Date().toISOString().split('T')[0];

        if (myCheckin) {
          isJoined = true;
          myStats = {
            checkin_days: myCheckin.checkin_days,
            current_streak: myCheckin.current_streak,
            max_streak: myCheckin.max_streak
          };
          todayRecord = myCheckin.records.find(r => r.checkin_date === today) || null;
          todayChecked = !!todayRecord;
          calendarDays = this.buildCalendar(myCheckin.calendar);
        } else {
          calendarDays = this.buildEmptyCalendar(event.start_date, event.end_date);
        }
      } else {
        calendarDays = this.buildEmptyCalendar(event.start_date, event.end_date);
      }

      let badges = [];
      let achievedBadges = 0;
      try {
        badges = await api.getEventBadges(this.data.eventId) || [];
        achievedBadges = badges.filter(b => b.achieved).length;
      } catch (e) { console.log('徽章加载失败', e); }

      let materials = [];
      try {
        materials = await api.getEventMaterials(this.data.eventId) || [];
      } catch (e) { console.log('资料加载失败', e); }

      this.setData({
        event,
        myStats,
        todayChecked,
        todayRecord,
        calendarDays,
        isJoined,
        badges,
        achievedBadges,
        materials
      });
    } catch (e) {
      console.error(e);
    }
  },

  buildCalendar(calendarData) {
    const days = [];
    const firstDate = calendarData[0]?.date;
    if (!firstDate) return days;

    const firstDay = new Date(firstDate);
    const startPadding = firstDay.getDay();

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, day: '', checked: false, inRange: false });
    }

    for (const d of calendarData) {
      const date = new Date(d.date);
      days.push({
        date: d.date,
        day: date.getDate(),
        checked: d.checked,
        isToday: api.isToday(d.date),
        inRange: true
      });
    }

    return days;
  },

  buildEmptyCalendar(startDate, endDate) {
    const days = [];
    const firstDay = new Date(startDate);
    const startPadding = firstDay.getDay();

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, day: '', checked: false, inRange: false });
    }

    let d = new Date(startDate);
    const endD = new Date(endDate);
    while (d <= endD) {
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: dateStr,
        day: d.getDate(),
        checked: false,
        isToday: api.isToday(dateStr),
        inRange: true
      });
      d.setDate(d.getDate() + 1);
    }

    return days;
  },

  async handleJoin() {
    if (!app.requireLogin()) return;
    try {
      await api.joinEvent(this.data.eventId);
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      console.error(e);
    }
  },

  onNoteInput(e) {
    this.setData({ checkinNote: e.detail.value });
  },

  async chooseImage() {
    if (!app.requireLogin()) return;
    const that = this;
    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: async (res) => {
        try {
          let sourceType = [];
          if (res.tapIndex === 0) {
            sourceType = ['camera'];
          } else {
            sourceType = ['album'];
          }

          const chooseRes = await new Promise((resolve, reject) => {
            wx.chooseImage({
              count: 1,
              sizeType: ['compressed'],
              sourceType: sourceType,
              success: resolve,
              fail: reject
            });
          });

          const tempFilePath = chooseRes.tempFilePaths[0];
          that.setData({ checkinImage: tempFilePath });

          wx.showLoading({ title: '上传中...' });
          const uploadRes = await api.uploadImage(tempFilePath);
          that.setData({ checkinImageUrl: uploadRes.url });
          wx.hideLoading();
        } catch (e) {
          wx.hideLoading();
          console.error(e);
        }
      }
    });
  },

  async submitCheckin() {
    if (!app.requireLogin()) return;
    this.setData({ submitting: true });
    try {
      const result = await api.doCheckin({
        event_id: this.data.eventId,
        note: this.data.checkinNote || null,
        image_url: this.data.checkinImageUrl || null
      });

      let toastTitle = `第${result.checkin_number}次打卡成功！`;
      if (result.new_badges && result.new_badges.length > 0) {
        toastTitle = `🎉 获得${result.new_badges[0].name}徽章！`;
      }

      wx.showToast({ 
        title: toastTitle, 
        icon: 'success',
        duration: 2500
      });
      this.setData({ checkinNote: '', checkinImage: '', checkinImageUrl: '' });
      this.loadData();
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  openMaterial(e) {
    const url = e.currentTarget.dataset.url;
    const type = e.currentTarget.dataset.type;
    if (!url) return;

    const fullUrl = this.data.baseUrl + url;
    
    if (type === 'pdf' || url.endsWith('.pdf')) {
      wx.showLoading({ title: '加载中...' });
      wx.downloadFile({
        url: fullUrl,
        success: (res) => {
          wx.hideLoading();
          wx.openDocument({
            filePath: res.tempFilePath,
            showMenu: true
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '加载失败', icon: 'none' });
        }
      });
    } else {
      wx.setClipboardData({
        data: fullUrl,
        success: () => {
          wx.showToast({ title: '链接已复制', icon: 'success' });
        }
      });
    }
  },

  goToRanking() {
    wx.navigateTo({ url: `/pages/ranking/ranking?id=${this.data.eventId}` });
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  }
});

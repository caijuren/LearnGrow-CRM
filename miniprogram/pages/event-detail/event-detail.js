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
    baseUrl: app.globalData.baseUrl
  },

  onLoad(options) {
    if (!app.checkLogin()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    this.setData({ eventId: parseInt(options.id) });
    this.loadData();
    
    if (options.autoCheckin === '1') {
      setTimeout(() => {
        wx.pageScrollTo({ selector: '.checkin-form', duration: 300 });
      }, 500);
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

      const myCheckins = await api.getMyCheckins();
      const myCheckin = myCheckins.find(c => c.event.id === this.data.eventId);

      const today = new Date().toISOString().split('T')[0];
      let todayRecord = null;
      let todayChecked = false;
      let myStats = { checkin_days: event.my_checkin_days, current_streak: event.my_current_streak, max_streak: 0 };
      let calendarDays = [];

      if (myCheckin) {
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

      this.setData({
        event,
        myStats,
        todayChecked,
        todayRecord,
        calendarDays
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
    try {
      const res = await new Promise((resolve, reject) => {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject
        });
      });

      const tempFilePath = res.tempFilePaths[0];
      this.setData({ checkinImage: tempFilePath });

      wx.showLoading({ title: '上传中...' });
      const uploadRes = await api.uploadImage(tempFilePath);
      this.setData({ checkinImageUrl: uploadRes.url });
      wx.hideLoading();
    } catch (e) {
      wx.hideLoading();
      console.error(e);
    }
  },

  async submitCheckin() {
    this.setData({ submitting: true });
    try {
      const today = new Date().toISOString().split('T')[0];
      await api.doCheckin({
        event_id: this.data.eventId,
        checkin_date: today,
        note: this.data.checkinNote || null,
        image_url: this.data.checkinImageUrl || null
      });

      wx.showToast({ title: '打卡成功', icon: 'success' });
      this.setData({ checkinNote: '', checkinImage: '', checkinImageUrl: '' });
      this.loadData();
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },

  goToRanking() {
    wx.navigateTo({ url: `/pages/ranking/ranking?id=${this.data.eventId}` });
  }
});

const api = require('../../utils/api.js');
const avatarUtil = require('../../utils/avatar.js');
const timeUtil = require('../../utils/time.js');
const app = getApp();

Page({
  data: {
    eventId: null,
    event: null,
    eventNotFound: false,
    myStats: { checkin_days: 0, current_streak: 0, max_streak: 0 },
    calendarDays: [],
    todayChecked: false,
    todayRecord: null,
    checkinNote: '',
    checkinImage: '',
    checkinImageUrl: '',
    checkinImageHash: '',
    checkinMediaType: 'image',
    makeupDate: '',
    submitting: false,
    isEditingTodayRecord: false,
    editingRecordId: null,
    showChildSetup: false,
    setupChildName: '',
    savingChildName: false,
    baseUrl: app.globalData.baseUrl,
    isLoggedIn: false,
    isJoined: false,
    badges: [],
    achievedBadges: 0,
    materials: [],
    feed: [],
    reminder: {
      is_enabled: false,
      remind_time: '20:00',
      template_id: null
    },
    savingReminder: false,
    brokenAvatars: {},
    networkError: false,
    activeTab: 'record'
  },

  onAvatarError(e) {
    avatarUtil.onAvatarError(e, this);
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onLoad(options) {
    let eventId = options.id ? parseInt(options.id) : null;
    // 通过小程序码扫码进入：scene 携带 id=活动ID
    if (!eventId && options.scene) {
      let scene = options.scene;
      try { scene = decodeURIComponent(scene); } catch (e) {}
      const match = String(scene).match(/(?:^|&)id=(\d+)/);
      if (match) eventId = parseInt(match[1], 10);
    }
    if (!eventId) {
      this.setData({ eventNotFound: true });
      return;
    }
    this.setData({ 
      eventId,
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
    this.setData({ networkError: false });
    try {
      const events = await api.getEvents();
      const event = events.find(e => e.id === this.data.eventId);
      if (!event) {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        this.setData({ eventNotFound: true });
        return;
      }

      let myStats = { checkin_days: 0, current_streak: 0, max_streak: 0 };
      let calendarDays = [];
      let todayChecked = false;
      let todayRecord = null;
      let isJoined = false;

      if (app.checkLogin()) {
        // 刷新用户信息，确保 child_name 等字段是最新的
        try {
          const latestUserInfo = await api.getUserInfo();
          if (latestUserInfo) {
            app.setLogin(app.globalData.token, latestUserInfo);
          }
        } catch (e) {
          // 用户信息刷新失败不阻断主流程
        }

        const myCheckins = await api.getMyCheckins();
        const myCheckin = myCheckins.find(c => c.event.id === this.data.eventId);

        const today = api.getChinaTodayStr();

        if (myCheckin) {
          isJoined = true;
          myStats = {
            checkin_days: myCheckin.checkin_days,
            current_streak: myCheckin.current_streak,
            max_streak: myCheckin.max_streak
          };
          todayRecord = myCheckin.records.find(r => r.checkin_date === today) || null;
          todayChecked = !!todayRecord && (!todayRecord.status || todayRecord.status === 'approved');
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
      } catch (e) {
        // 徽章加载失败不阻断主流程
      }

      let materials = [];
      try {
        materials = await api.getEventMaterials(this.data.eventId) || [];
      } catch (e) {
        // 资料加载失败不阻断主流程
      }

      let feed = [];
      try {
        feed = (await api.getEventFeed(this.data.eventId) || []).map(item => ({
          ...item,
          formattedDate: timeUtil.formatRelativeTime(item.created_at || item.checkin_date)
        }));
      } catch (e) {
        // 动态加载失败不阻断主流程
      }

      let reminder = this.data.reminder;
      if (app.checkLogin() && isJoined) {
        try {
          reminder = await api.getEventReminder(this.data.eventId) || reminder;
        } catch (e) {
          // 提醒设置加载失败不阻断主流程
        }
      }

      this.setData({
        event,
        myStats,
        todayChecked,
        todayRecord,
        calendarDays,
        isJoined,
        badges,
        achievedBadges,
        materials,
        feed,
        reminder,
        brokenAvatars: {}
      });
    } catch (e) {
      this.setData({ networkError: true });
    }
  },

  retryLoadData() {
    this.loadData();
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
        status: d.status || null,
        review_note: d.review_note || null,
        is_makeup: !!d.is_makeup,
        can_makeup: !!d.can_makeup,
        missed: !!d.missed,
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
        status: null,
        review_note: null,
        is_makeup: false,
        can_makeup: false,
        missed: false,
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
      wx.showToast({ title: '报名成功', icon: 'success' });
      this.loadData();
    } catch (e) {
      // api.js 已展示具体错误信息
    }
  },

  onNoteInput(e) {
      this.setData({ checkinNote: e.detail.value });
  },

  onChildNameInput(e) {
    this.setData({ setupChildName: e.detail.value });
  },

  async saveChildName() {
    const childName = this.data.setupChildName.trim();
    if (!childName) {
      wx.showToast({ title: '请输入孩子名称', icon: 'none' });
      return;
    }
    this.setData({ savingChildName: true });
    try {
      const updated = await api.updateProfile({ child_name: childName });
      const newUserInfo = { ...app.globalData.userInfo, ...updated };
      app.setLogin(app.globalData.token, newUserInfo);
      this.setData({ showChildSetup: false, setupChildName: '', savingChildName: false });
      wx.showToast({ title: '设置完成', icon: 'success' });
      // 补充完孩子名后继续打卡
      this.submitCheckin();
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      this.setData({ savingChildName: false });
    }
  },

  closeChildSetup() {
    this.setData({ showChildSetup: false, setupChildName: '' });
  },

  preventClose() {
    // 阻止弹窗内容点击冒泡到蒙层
  },

  selectMakeupDate(e) {
    const { date, canMakeup } = e.currentTarget.dataset;
    if (!canMakeup) return;
    this.setData({ makeupDate: date });
    setTimeout(() => {
      wx.pageScrollTo({ selector: '.checkin-form', duration: 300 });
    }, 80);
  },

  clearMakeupDate() {
    this.setData({ makeupDate: '' });
  },

  scrollToCheckin() {
    wx.pageScrollTo({ selector: '.checkin-card', duration: 300 });
  },

  async onReminderSwitch(e) {
    if (!app.requireLogin()) return;
    const enabled = e.detail.value;
    if (enabled && this.data.reminder.template_id) {
      let res = {};
      try {
        res = await new Promise((resolve) => {
          wx.requestSubscribeMessage({
            tmplIds: [this.data.reminder.template_id],
            complete: resolve
          });
        });
      } catch (err) {
        res = { [this.data.reminder.template_id]: 'reject' };
      }
      const accepted = res[this.data.reminder.template_id] === 'accept';
      if (!accepted) {
        this.setData({ 'reminder.is_enabled': false });
        wx.showToast({ title: '未授权订阅，未开启提醒', icon: 'none' });
        return;
      }
    }
    this.saveReminder({ is_enabled: enabled });
  },

  onReminderTimeChange(e) {
    this.saveReminder({ remind_time: e.detail.value, is_enabled: this.data.reminder.is_enabled });
  },

  async saveReminder(patch) {
    if (!app.requireLogin()) return;
    const next = {
      ...this.data.reminder,
      ...patch
    };
    this.setData({ savingReminder: true, reminder: next });
    try {
      const saved = await api.saveEventReminder(this.data.eventId, {
        is_enabled: next.is_enabled,
        remind_time: next.remind_time
      });
      this.setData({ reminder: { ...next, ...saved } });
      wx.showToast({ title: next.is_enabled ? '提醒已设置' : '提醒已关闭', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '提醒设置失败', icon: 'none' });
      this.loadData();
    } finally {
      this.setData({ savingReminder: false });
    }
  },



  async chooseMedia() {
    if (!app.requireLogin()) return;
    const that = this;
    wx.showActionSheet({
      itemList: ['拍照 / 拍视频', '从相册选择'],
      success: async (res) => {
        try {
          const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];

          const chooseRes = await new Promise((resolve, reject) => {
            wx.chooseMedia({
              count: 1,
              mediaType: ['image', 'video'],
              sourceType: sourceType,
              maxDuration: 60,
              camera: 'back',
              success: resolve,
              fail: reject
            });
          });

          const tempFile = chooseRes.tempFiles[0];
          const tempFilePath = tempFile.tempFilePath;
          const mediaType = chooseRes.type || tempFile.fileType || 'image';
          that.setData({ checkinImage: tempFilePath, checkinMediaType: mediaType });

          wx.showLoading({ title: '上传中...' });
          const uploadRes = await api.uploadMedia(tempFilePath);
          wx.hideLoading();

          if (uploadRes.same_day_duplicate) {
            that.setData({ checkinImage: '', checkinImageUrl: '', checkinImageHash: '', checkinMediaType: 'image' });
            wx.showToast({ title: '今天已上传过相同文件', icon: 'none' });
            return;
          }

          if (uploadRes.similar_record) {
            const dateStr = uploadRes.similar_record.checkin_date;
            wx.showModal({
              title: '重复提醒',
              content: `检测到和 ${dateStr} 的打卡文件相同，是否继续？`,
              confirmText: '继续',
              cancelText: '重新选择',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  that.setData({
                    checkinImageUrl: uploadRes.url,
                    checkinImageHash: uploadRes.media_hash || ''
                  });
                } else {
                  that.setData({ checkinImage: '', checkinImageUrl: '', checkinImageHash: '', checkinMediaType: 'image' });
                }
              }
            });
            return;
          }

          that.setData({
            checkinImageUrl: uploadRes.url,
            checkinImageHash: uploadRes.media_hash || ''
          });
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '上传失败，请重试', icon: 'none' });
        }
      }
    });
  },

  startEditTodayRecord() {
    const record = this.data.todayRecord;
    if (!record) return;
    this.setData({
      isEditingTodayRecord: true,
      editingRecordId: record.id,
      checkinNote: record.note || '',
      checkinImageUrl: record.image_url || '',
      checkinImageHash: record.image_hash || '',
      checkinImage: record.image_url ? (this.data.baseUrl + record.image_url) : '',
      checkinMediaType: record.media_type || 'image'
    });
    wx.pageScrollTo({ selector: '.checkin-form', duration: 300 });
  },

  cancelEditTodayRecord() {
    this.setData({
      isEditingTodayRecord: false,
      editingRecordId: null,
      checkinNote: '',
      checkinImage: '',
      checkinImageUrl: '',
      checkinImageHash: '',
      checkinMediaType: 'image'
    });
  },

  async submitCheckin() {
    if (!app.requireLogin()) return;

    // 校验孩子名：缺失时弹出补充框，补充后自动继续打卡
    const userInfo = app.globalData.userInfo || {};
    if (!userInfo.child_name || !String(userInfo.child_name).trim()) {
      this.setData({ showChildSetup: true, setupChildName: '' });
      return;
    }

    if (!this.data.checkinImageUrl) {
      wx.showToast({ title: '请上传打卡图片或视频', icon: 'error' });
      return;
    }
    this.setData({ submitting: true });
    try {
      let result;
      let toastTitle;
      if (this.data.isEditingTodayRecord) {
        result = await api.updateCheckinRecord(this.data.editingRecordId, {
          image_url: this.data.checkinImageUrl || null,
          image_hash: this.data.checkinImageHash || null,
          media_type: this.data.checkinMediaType || 'image',
          note: this.data.checkinNote || null
        });
        toastTitle = result.pending_review ? '已修改，等待老师审核' : '今日打卡已修改';
      } else {
        result = await api.doCheckin({
          event_id: this.data.eventId,
          checkin_date: this.data.makeupDate || undefined,
          note: this.data.checkinNote || null,
          image_url: this.data.checkinImageUrl || null,
          image_hash: this.data.checkinImageHash || null,
          media_type: this.data.checkinMediaType || 'image'
        });
        toastTitle = this.data.makeupDate ? '补卡已提交' : `第${result.checkin_number}次打卡成功！`;
        if (result.pending_review) {
          toastTitle = '已提交，等待老师审核';
        }
        if (result.new_badges && result.new_badges.length > 0) {
          toastTitle = `获得${result.new_badges[0].name}徽章！`;
        }
        if (result.points_earned > 0 && !result.pending_review) {
          toastTitle = this.data.makeupDate
            ? `补卡成功 · 积分+${result.points_earned}`
            : `第${result.checkin_number}次打卡成功 · 积分+${result.points_earned}`;
        }
      }

      wx.showToast({ 
        title: toastTitle, 
        icon: 'success',
        duration: 2500
      });
      this.setData({ checkinNote: '', checkinImage: '', checkinImageUrl: '', checkinImageHash: '', checkinMediaType: 'image', makeupDate: '', isEditingTodayRecord: false, editingRecordId: null });
      this.loadData();
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
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
    // 排行榜是 tabBar 页面，switchTab 无法带参数，通过全局变量传递活动 id
    app.globalData.rankingEventId = this.data.eventId;
    wx.switchTab({ url: '/pages/ranking/ranking' });
  },

  // 分享给好友/群聊：直接打开当前活动详情
  onShareAppMessage() {
    const event = this.data.event;
    const eventId = this.data.eventId;
    return {
      title: event ? `${event.name} · 一起来打卡吧` : '一起来打卡吧',
      path: `/pages/event-detail/event-detail?id=${eventId}`,
      imageUrl: event ? event.cover_url || '' : ''
    };
  },

  goToLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  formatFeedDate(dateStr) {
    return timeUtil.formatRelativeTime(dateStr);
  },

  previewFeedImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  }
});

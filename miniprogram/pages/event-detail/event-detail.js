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
    showSuccessActions: false,
    showShareModal: false,
    shareLink: '',
    sharingLink: false,
    shareExpireText: '',
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
    wx.showShareMenu({ withShareTicket: true });
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

  async toggleFeedLike(e) {
    if (!app.requireLogin()) return;
    const { id } = e.currentTarget.dataset;
    const feed = this.data.feed.map(item => {
      if (item.id !== id) return item;
      const liked = !item.liked_by_me;
      return {
        ...item,
        liked_by_me: liked,
        like_count: Math.max(0, (item.like_count || 0) + (liked ? 1 : -1))
      };
    });
    this.setData({ feed });
    try {
      const result = await api.toggleRecordLike(id);
      this.setData({
        feed: this.data.feed.map(item => item.id === id ? {
          ...item,
          liked_by_me: result.liked,
          like_count: result.like_count
        } : item)
      });
    } catch (err) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
      this.loadData();
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
    const wasMakeup = !!this.data.makeupDate;
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
      if (!this.data.isEditingTodayRecord && !result.pending_review && !wasMakeup) {
        setTimeout(() => this.showSharePrompt(), 600);
      }
    } catch (e) {
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  showSharePrompt() {
    this.setData({ showSuccessActions: true });
  },

  closeSuccessActions() {
    this.setData({ showSuccessActions: false });
  },

  async openShareModal() {
    if (this.data.sharingLink) return;
    this.setData({ sharingLink: true });
    try {
      const { scheme, expire_at } = await api.getEventShareLink(this.data.eventId);
      const expireText = expire_at ? expire_at.split(' ')[0].replace(/-/g, '.') : '';
      this.setData({
        shareLink: scheme,
        shareExpireText: expireText ? `${expireText} 前有效` : '',
        showShareModal: true
      });
    } catch (e) {
      // api.js 已展示具体错误信息
    } finally {
      this.setData({ sharingLink: false });
    }
  },

  closeShareModal() {
    this.setData({ showShareModal: false });
  },

  copyShareLink() {
    if (!this.data.shareLink) return;
    wx.setClipboardData({
      data: this.data.shareLink,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
        this.setData({ showShareModal: false });
      }
    });
  },

  onCreatePoster() {
    this.setData({ showSuccessActions: false });
    this.createPoster();
  },

  createPoster() {
    const event = this.data.event || {};
    const stats = this.data.myStats || {};
    const user = app.globalData.userInfo || {};
    const ctx = wx.createCanvasContext('checkinPoster', this);
    const width = 640;
    const height = 1100;
    const today = api.getChinaTodayStr();
    const nickname = user.nickname || '我';
    const checkinDays = stats.checkin_days || 0;
    const streakDays = stats.current_streak || 0;

    // 背景：深空渐变
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#090B12');
    bgGradient.addColorStop(0.45, '#111522');
    bgGradient.addColorStop(1, '#1a0b1a');
    ctx.setFillStyle(bgGradient);
    ctx.fillRect(0, 0, width, height);

    // 装饰光斑
    this._drawGlow(ctx, 520, 160, 240, 'rgba(244, 63, 94, 0.22)');
    this._drawGlow(ctx, 120, 420, 280, 'rgba(139, 92, 246, 0.18)');
    this._drawGlow(ctx, 480, 760, 200, 'rgba(244, 63, 94, 0.14)');

    // 顶部细线装饰
    ctx.setStrokeStyle('rgba(244, 63, 94, 0.6)');
    ctx.setLineWidth(3);
    ctx.beginPath();
    ctx.moveTo(60, 84);
    ctx.lineTo(180, 84);
    ctx.stroke();

    ctx.setFillStyle('rgba(255, 255, 255, 0.55)');
    ctx.setFontSize(24);
    ctx.setTextAlign('left');
    ctx.fillText(today, 60, 132);

    // 活动名称
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(48);
    ctx.setTextAlign('left');
    this.drawWrappedText(ctx, event.name || '学习打卡', 60, 196, 520, 64, 2);

    // 核心数据卡片背景
    this._drawRoundedRect(ctx, 48, 320, width - 96, 420, 28, 'rgba(17, 21, 34, 0.72)');
    ctx.setStrokeStyle('rgba(255, 255, 255, 0.08)');
    ctx.setLineWidth(2);
    ctx.stroke();

    // 累计打卡大数字
    const numGradient = ctx.createLinearGradient(0, 360, 0, 520);
    numGradient.addColorStop(0, '#F43F7A');
    numGradient.addColorStop(1, '#ec4899');
    ctx.setFillStyle(numGradient);
    ctx.setTextAlign('center');
    ctx.setFontSize(172);
    ctx.fillText(String(checkinDays), width / 2, 510);

    ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
    ctx.setFontSize(30);
    ctx.fillText('累计打卡天数', width / 2, 564);

    // 分隔线
    ctx.setStrokeStyle('rgba(255, 255, 255, 0.12)');
    ctx.setLineWidth(2);
    ctx.beginPath();
    ctx.moveTo(80, 610);
    ctx.lineTo(width - 80, 610);
    ctx.stroke();

    // 连续打卡
    ctx.setFillStyle('#F59E0B');
    ctx.setFontSize(64);
    ctx.fillText(String(streakDays), width / 2, 692);

    ctx.setFillStyle('rgba(255, 255, 255, 0.7)');
    ctx.setFontSize(26);
    ctx.fillText('当前连续打卡', width / 2, 736);

    // 进度条
    const totalDays = event.total_days || 1;
    const progress = Math.min(checkinDays / totalDays, 1);
    const barY = 780;
    const barW = width - 136;
    const barX = 68;
    ctx.setFillStyle('rgba(255, 255, 255, 0.12)');
    this._drawRoundedRect(ctx, barX, barY, barW, 18, 9, 'rgba(255, 255, 255, 0.12)');
    if (progress > 0) {
      const progGradient = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      progGradient.addColorStop(0, '#F43F7A');
      progGradient.addColorStop(1, '#8B5CF6');
      this._drawRoundedRect(ctx, barX, barY, barW * progress, 18, 9, progGradient);
    }
    ctx.setFillStyle('rgba(255, 255, 255, 0.65)');
    ctx.setFontSize(22);
    ctx.setTextAlign('right');
    ctx.fillText(`${checkinDays}/${totalDays} 天`, width - 68, barY + 46);

    // 鼓励语
    ctx.setTextAlign('center');
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(34);
    ctx.fillText(`${nickname} 正在坚持学习`, width / 2, 868);

    ctx.setFillStyle('rgba(255, 255, 255, 0.6)');
    ctx.setFontSize(26);
    const slogan = event.required_text || '每天一点进步，看得见的成长';
    this.drawWrappedText(ctx, slogan, width / 2, 914, 520, 40, 2);

    // 底部品牌区
    const footerY = 1010;
    ctx.setStrokeStyle('rgba(255, 255, 255, 0.1)');
    ctx.beginPath();
    ctx.moveTo(60, footerY);
    ctx.lineTo(width - 60, footerY);
    ctx.stroke();

    ctx.setTextAlign('left');
    ctx.setFillStyle('#ffffff');
    ctx.setFontSize(32);
    ctx.fillText('源来是糖', 60, 1064);

    ctx.setFillStyle('rgba(255, 255, 255, 0.55)');
    ctx.setFontSize(22);
    ctx.fillText('长按识别小程序，一起打卡', 60, 1100);

    // 小程序码占位框
    ctx.setStrokeStyle('rgba(255, 255, 255, 0.2)');
    ctx.setLineWidth(2);
    ctx.strokeRect(width - 132, 1032, 80, 80);
    ctx.setFillStyle('rgba(255, 255, 255, 0.9)');
    ctx.setFontSize(16);
    ctx.setTextAlign('center');
    ctx.fillText('扫码', width - 92, 1078);

    ctx.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'checkinPoster',
        width,
        height,
        destWidth: width * 2,
        destHeight: height * 2,
        success: (res) => {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => wx.showToast({ title: '海报已保存', icon: 'success' }),
            fail: () => wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
          });
        },
        fail: () => wx.showToast({ title: '海报生成失败', icon: 'none' })
      }, this);
    });
  },

  _drawGlow(ctx, x, y, r, color) {
    const glow = ctx.createCircularGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.setFillStyle(glow);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  },

  _drawRoundedRect(ctx, x, y, w, h, r, fill) {
    ctx.setFillStyle(fill);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + r, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const chars = String(text || '').split('');
    let line = '';
    let lines = 0;
    for (let i = 0; i < chars.length; i++) {
      const testLine = line + chars[i];
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines++;
        ctx.fillText(lines >= maxLines ? `${line.slice(0, Math.max(0, line.length - 1))}...` : line, x, y);
        if (lines >= maxLines) return;
        line = chars[i];
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line && lines < maxLines) ctx.fillText(line, x, y);
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
  },

  formatFeedDate(dateStr) {
    return timeUtil.formatRelativeTime(dateStr);
  },

  previewFeedImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url });
  },

  onShareAppMessage() {
    const event = this.data.event;
    return {
      title: event ? `我正在坚持「${event.name}」打卡` : '一起来打卡',
      path: `/pages/event-detail/event-detail?id=${this.data.eventId}`,
      imageUrl: `${this.data.baseUrl}/uploads/share_brand.png`,
    };
  }
});

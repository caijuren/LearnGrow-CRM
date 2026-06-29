const api = require('../../utils/api.js');
const app = getApp();

Page({
  data: {
    nickname: '',
    childName: '',
    loading: false
  },

  onLoad() {
    if (app.checkLogin()) {
      wx.switchTab ? wx.switchTab({ url: '/pages/index/index' }) : wx.reLaunch({ url: '/pages/index/index' });
    }
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  onChildNameInput(e) {
    this.setData({ childName: e.detail.value });
  },

  async handleLogin() {
    if (!this.data.nickname.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    try {
      let code = '';
      try {
        const loginRes = await new Promise((resolve, reject) => {
          wx.login({ success: resolve, fail: reject });
        });
        code = loginRes.code || '';
      } catch (e) {
        code = 'dev_' + Date.now();
      }

      const result = await api.login({
        code,
        nickname: this.data.nickname.trim(),
        child_name: this.data.childName.trim() || null
      });

      app.setLogin(result.token, result.user);

      wx.showToast({ title: '登录成功', icon: 'success' });
      
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' });
      }, 1000);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ loading: false });
    }
  }
});

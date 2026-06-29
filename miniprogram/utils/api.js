const app = getApp();

const BASE_URL = app.globalData.baseUrl;

function request(options) {
  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json',
      ...options.header
    };
    
    if (app.globalData.token) {
      header['Authorization'] = `Bearer ${app.globalData.token}`;
    }

    wx.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          app.logout();
          wx.reLaunch({ url: '/pages/login/login' });
          reject(new Error('请先登录'));
          return;
        }
        if (res.data && res.data.success) {
          resolve(res.data.data);
        } else {
          wx.showToast({
            title: res.data?.error || '请求失败',
            icon: 'none',
            duration: 2000
          });
          reject(new Error(res.data?.error || '请求失败'));
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        });
        reject(err);
      }
    });
  });
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/api/wx/upload-image',
      filePath: filePath,
      name: 'file',
      header: {
        'Authorization': `Bearer ${app.globalData.token}`
      },
      success: (res) => {
        const data = JSON.parse(res.data);
        if (data.success) {
          resolve(data.data);
        } else {
          reject(new Error(data.error || '上传失败'));
        }
      },
      fail: reject
    });
  });
}

function login(data) {
  return request({
    url: '/api/wx/login',
    method: 'POST',
    data
  });
}

function updateProfile(data) {
  return request({
    url: '/api/wx/update-profile',
    method: 'POST',
    data
  });
}

function getEvents() {
  return request({ url: '/api/wx/checkin-events' });
}

function joinEvent(eventId) {
  return request({
    url: `/api/wx/checkin-events/${eventId}/join`,
    method: 'POST',
    data: {}
  });
}

function doCheckin(data) {
  return request({
    url: '/api/wx/checkin',
    method: 'POST',
    data
  });
}

function getMyCheckins() {
  return request({ url: '/api/wx/my-checkins' });
}

function getRanking(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/ranking` });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getDayOfWeek(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[new Date(dateStr).getDay()];
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function getDaysLeft(endDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

module.exports = {
  request,
  uploadImage,
  login,
  updateProfile,
  getEvents,
  joinEvent,
  doCheckin,
  getMyCheckins,
  getRanking,
  formatDate,
  getDayOfWeek,
  isToday,
  getDaysLeft
};

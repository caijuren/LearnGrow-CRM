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
          if (options.showError !== false) {
            wx.showToast({
              title: res.data?.error || '请求失败',
              icon: 'none',
              duration: 2000
            });
          }
          reject(new Error(res.data?.error || '请求失败'));
        }
      },
      fail: (err) => {
        if (options.showError !== false) {
          wx.showToast({
            title: '网络错误',
            icon: 'none'
          });
        }
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

function uploadMedia(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + '/api/wx/upload-media',
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
    data,
    showError: false
  });
}

function updateProfile(data) {
  return request({
    url: '/api/wx/update-profile',
    method: 'POST',
    data
  });
}

function getUserInfo() {
  return request({
    url: '/api/wx/user-info',
    method: 'GET'
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

function updateCheckinRecord(recordId, data) {
  return request({
    url: `/api/wx/checkin-records/${recordId}`,
    method: 'PUT',
    data
  });
}

function getMyCheckins() {
  return request({ url: '/api/wx/my-checkins' });
}

function getRanking(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/ranking` });
}

function getEventFeed(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/feed` });
}

function getEventReminder(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/reminder` });
}

function saveEventReminder(eventId, data) {
  return request({
    url: `/api/wx/checkin-events/${eventId}/reminder`,
    method: 'POST',
    data
  });
}

function toggleRecordLike(recordId) {
  return request({
    url: `/api/wx/checkin-records/${recordId}/like`,
    method: 'POST',
    data: {}
  });
}

function getEventMaterials(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/materials` });
}

function getEventBadges(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/badges` });
}

function getEventShareLink(eventId) {
  return request({ url: `/api/wx/checkin-events/${eventId}/share-link` });
}

function getMyBadges() {
  return request({ url: '/api/wx/my-badges' });
}

function getMyPoints() {
  return request({ url: '/api/wx/my-points' });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function getDayOfWeek(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return days[new Date(dateStr).getDay()];
}

function getChinaTodayStr() {
  // 以东八区（北京时间）为准，避免 00:00-08:00 之间 UTC 与本地日期错位
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().split('T')[0];
}

function isToday(dateStr) {
  return dateStr === getChinaTodayStr();
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
  uploadMedia,
  login,
  updateProfile,
  getUserInfo,
  getEvents,
  joinEvent,
  doCheckin,
  updateCheckinRecord,
  getMyCheckins,
  getRanking,
  getEventFeed,
  getEventReminder,
  saveEventReminder,
  toggleRecordLike,
  getEventMaterials,
  getEventBadges,
  getEventShareLink,
  getMyBadges,
  getMyPoints,
  formatDate,
  getDayOfWeek,
  isToday,
  getChinaTodayStr,
  getDaysLeft
};

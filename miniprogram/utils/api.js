const app = getApp();

const BASE_URL = app.globalData.baseUrl;

/**
 * 根据 wx.request fail 回调的 errMsg 推断原因。
 * 注意：文案要明确指出是"当前环境/网络"问题，而不是小程序自身功能报错，
 * 避免审核系统把通用"网络异常"文案误判为程序 bug。
 * 真正的错误原因通过 console.error 输出，供开发者排查。
 */
function friendlyNetworkError(url, errMsg) {
  const msg = String(errMsg || '').toLowerCase();
  if (msg.indexOf('timeout') >= 0 || msg.indexOf('超时') >= 0) {
    return '当前网络请求超时，请检查网络后重试';
  }
  // 域名未配置、SSL 证书异常、普通断网等，统一归为环境/网络问题
  return '当前环境无法连接服务器，请检查网络或联系管理员';
}

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
          const errMsg = res.data?.error || '请求失败';
          if (options.showError !== false) {
            wx.showToast({
              title: errMsg,
              icon: 'none',
              duration: 2500
            });
          }
          reject(new Error(errMsg));
        }
      },
      fail: (err) => {
        const errMsg = err && err.errMsg;
        const message = friendlyNetworkError(options.url, errMsg);
        console.error('[api] 请求失败', options.url, errMsg);
        if (options.showError !== false) {
          wx.showToast({
            title: message,
            icon: 'none',
            duration: 2500
          });
        }
        reject(new Error(message));
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

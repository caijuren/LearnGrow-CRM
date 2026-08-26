// 正式版和体验版使用已备案、已配置到微信公众平台的 HTTPS 接口域名。
const API_BASE_URLS = {
  release: 'https://tangma.quxueban.cn',
  trial: 'https://tangma.quxueban.cn',
  develop: 'http://127.0.0.1:3456'
};

const envVersion = typeof __wxConfig !== 'undefined' ? __wxConfig.envVersion : 'develop';
const apiBaseUrl = API_BASE_URLS[envVersion] || API_BASE_URLS.release;

// 小程序本地版本号，独立于后端版本，用于“我的”页展示；升级小程序时同步更新
const APP_VERSION = '3.3.0';

if (envVersion !== 'develop' && !apiBaseUrl.startsWith('https://')) {
  throw new Error('正式版和体验版必须使用 HTTPS API 域名');
}

module.exports = {
  apiBaseUrl,
  appVersion: APP_VERSION
};
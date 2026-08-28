// 正式版和体验版使用已备案、已配置到微信公众平台的 HTTPS 接口域名。
const API_BASE_URLS = {
  release: 'https://tangma.quxueban.cn',
  trial: 'https://tangma.quxueban.cn',
  develop: 'http://127.0.0.1:3456'
};

// __wxConfig 是未公开的内部变量，部分基础库取不到；真机误判成 develop 会去请求 127.0.0.1
function resolveEnvVersion() {
  try {
    const info = wx.getAccountInfoSync();
    const v = info && info.miniProgram && info.miniProgram.envVersion;
    if (v === 'develop' || v === 'trial' || v === 'release') return v;
  } catch (e) {
    // 老基础库无 getAccountInfoSync
  }
  return 'release';
}

const envVersion = resolveEnvVersion();
const apiBaseUrl = API_BASE_URLS[envVersion] || API_BASE_URLS.release;

// 小程序本地版本号，独立于后端版本，用于“我的”页展示；升级小程序时同步更新
const APP_VERSION = '3.6.0';

if (envVersion !== 'develop' && !apiBaseUrl.startsWith('https://')) {
  throw new Error('正式版和体验版必须使用 HTTPS API 域名');
}

module.exports = {
  apiBaseUrl,
  appVersion: APP_VERSION,
  envVersion
};
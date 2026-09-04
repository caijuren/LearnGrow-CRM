// 正式版和体验版使用已备案、已配置到微信公众平台的 HTTPS 接口域名。
// 审核环境下，envVersion 必须判为 trial 或 release，绝对不能走 develop 的 localhost
const PROD_BASE_URL = 'https://tangma.quxueban.cn';
const API_BASE_URLS = {
  release: PROD_BASE_URL,
  trial: PROD_BASE_URL,
  develop: 'http://127.0.0.1:3456'
};

/**
 * 安全判定当前小程序环境版本。
 * 规则：
 *  - 只有在开发者工具内、且明确返回 develop 时，才使用 develop URL。
 *  - 真机（审核版、体验版、正式版）一律走 HTTPS 正式域名，绝不允许回退到 localhost。
 *  - 任何异常（老基础库、字段缺失、未知值、同步报错）默认 release，防止审核误连本地。
 */
function resolveEnvVersion() {
  // 1) 优先使用官方同步接口
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const v = info && info.miniProgram && info.miniProgram.envVersion;
    if (v === 'develop') {
      // 关键：只有「明确运行在开发者工具里」（platform === 'devtools'）才允许用 localhost。
      // 真机（platform 为 ios/android/devtools 之外）和审核环境一律兜底到 HTTPS 正式域名。
      // 注意：不能用 __wxConfig.envVersion === 'develop' 来判断，因为此时 v 本身就是 'develop'，
      // 该条件恒真，会导致审核环境也被误判为 devtools 而连到 127.0.0.1。
      try {
        const sys = wx.getSystemInfoSync && wx.getSystemInfoSync();
        const platform = (sys && sys.platform) || '';
        if (platform === 'devtools') return 'develop';
        // 真机 / 审核环境上报了 develop → 兜底走 HTTPS 正式域名
        return 'release';
      } catch (_) {
        return 'release';
      }
    }
    if (v === 'trial' || v === 'release') return v;
  } catch (_) {
    // 老基础库没有 getAccountInfoSync，吞掉异常继续走兜底
  }

  // 2) 兜底再尝试内部配置，只认 release / trial
  try {
    if (typeof __wxConfig !== 'undefined' && __wxConfig) {
      const v = __wxConfig.envVersion;
      if (v === 'trial' || v === 'release') return v;
    }
  } catch (_) {}

  // 3) 最终默认 release，避免任何情况下连到 127.0.0.1
  return 'release';
}

const envVersion = resolveEnvVersion();
const apiBaseUrl = API_BASE_URLS[envVersion] || PROD_BASE_URL;

// 小程序本地版本号，独立于后端版本，用于"我的"页展示；升级小程序时同步更新
const APP_VERSION = '3.6.0';

// 硬校验：真机 / 审核环境绝不能使用 HTTP
if (envVersion !== 'develop' && !apiBaseUrl.startsWith('https://')) {
  throw new Error('正式版和体验版必须使用 HTTPS API 域名');
}

module.exports = {
  apiBaseUrl,
  appVersion: APP_VERSION,
  envVersion
};
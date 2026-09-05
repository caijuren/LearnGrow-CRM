import db from '../db.js';

// 明文 URL Scheme：无需调微信接口，按官方格式拼接即可
// 前提：小程序为非个人主体、已发布，并在 MP 后台「账号设置-基本设置-隐私与安全-明文Scheme拉起此小程序」声明开通
export function getEventShareLink(eventId: number, envVersion: string = 'release'): { scheme: string; expire_at: string | null } {
  const WX_APPID = process.env.WX_APPID;
  if (!WX_APPID) {
    throw new Error('微信分享配置缺失：WX_APPID 未设置');
  }
  const version = ['release', 'trial', 'develop'].includes(envVersion) ? envVersion : 'release';
  const scheme = `weixin://dl/business/?appid=${WX_APPID}&path=pages/event-detail/event-detail&query=${encodeURIComponent(`id=${eventId}`)}&env_version=${version}`;
  // 明文 scheme 无有效期，返回 null 表示永久有效
  return { scheme, expire_at: null };
}

// 获取微信接口调用凭证（access_token），带缓存
export async function getWxAccessToken(): Promise<string | null> {
  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_SECRET || process.env.WX_APPSECRET;
  if (!appId || !appSecret) return null;

  const cached = db.prepare("SELECT value FROM settings WHERE key = 'wx_access_token'").get() as any;
  if (cached) {
    const tokenData = JSON.parse(cached.value);
    if (tokenData.expires_at > Date.now()) return tokenData.access_token;
  }

  try {
    const res = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`);
    const data: any = await res.json();
    if (data.access_token) {
      const tokenData = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000
      };
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('wx_access_token', ?)").run(JSON.stringify(tokenData));
      return data.access_token;
    }
  } catch (e) {
    console.error('获取微信access_token失败', e);
  }
  return null;
}

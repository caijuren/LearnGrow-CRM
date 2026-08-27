/* eslint-disable @typescript-eslint/no-explicit-any */
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

import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getWxAccessToken } from './wx-share.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

// 分享卡片图缓存目录（独立于用户上传，避免被 media 完整性扫描误判）
const shareCardDir = path.join(uploadsDir, 'share-cards');
if (!fs.existsSync(shareCardDir)) fs.mkdirSync(shareCardDir, { recursive: true });

// 卡片尺寸：5:4 比例（微信分享卡片推荐比例）
const CARD_WIDTH = 1000;
const CARD_HEIGHT = 800;

/**
 * 调微信 getwxacodeunlimit 生成小程序码，scene 携带活动 id
 * 返回 PNG buffer；失败返回 null
 */
async function getWxacodeUnlimited(scene: string, page: string): Promise<Buffer | null> {
  const accessToken = await getWxAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene,
        page,
        width: 430,
        check_path: false,
        env_version: 'release',
        auto_color: false,
        line_color: { r: 255, g: 255, b: 255 },
      }),
    });

    // 成功返回图片二进制；失败返回 JSON（含 errcode）
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('image')) {
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const errData: any = await res.json().catch(() => ({}));
    console.error('生成小程序码失败', errData);
    return null;
  } catch (e) {
    console.error('生成小程序码异常', e);
    return null;
  }
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 生成活动专属分享卡片图，返回 /uploads 下的相对 URL
 * 事件数据变化后重新生成；命中缓存则直接返回
 */
export async function generateEventShareCard(event: {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  required_text?: string | null;
}): Promise<string | null> {
  const fileName = `share_card_${event.id}.png`;
  const filePath = path.join(shareCardDir, fileName);

  // 缓存：文件存在且 1 小时内生成过则直接复用，避免每次打开详情页都重新渲染并调用微信接口
  if (fs.existsSync(filePath)) {
    const age = Date.now() - fs.statSync(filePath).mtimeMs;
    if (age < 60 * 60 * 1000) {
      return `/uploads/share-cards/${fileName}`;
    }
  }

  const scene = `id=${event.id}`;
  const page = 'pages/event-detail/event-detail';
  const qrBuffer = await getWxacodeUnlimited(scene, page);
  const qrDataUrl = qrBuffer ? `data:image/png;base64,${qrBuffer.toString('base64')}` : null;

  const name = escapeXml(event.name || '打卡活动');
  const dateRange = escapeXml(`${event.start_date || ''} ~ ${event.end_date || ''}`);
  const slogan = escapeXml(event.required_text || '每天一点进步，看得见的成长');
  // 长活动名需要换行处理：粗略按每行最多 12 个字切分，最多 2 行
  const lines = splitName(name);

  const titleBlocks = lines.map((line, i) => {
    const y = 300 + i * 96;
    return `<text x="500" y="${y}" text-anchor="middle" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="76" font-weight="bold" fill="#ffffff">${line}</text>`;
  }).join('');

  const svg = `<svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F1220"/>
      <stop offset="55%" stop-color="#171032"/>
      <stop offset="100%" stop-color="#1F0B24"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F43F7A"/>
      <stop offset="100%" stop-color="#8B5CF6"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.85" cy="0.15" r="0.6">
      <stop offset="0%" stop-color="#F43F7A" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#F43F7A" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.15" cy="0.85" r="0.6">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow1)"/>
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow2)"/>

  <!-- 顶部品牌 -->
  <text x="70" y="90" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="34" fill="rgba(255,255,255,0.7)">源来是糖</text>
  <rect x="70" y="112" width="80" height="6" rx="3" fill="url(#accent)"/>

  <!-- 主标题：活动名 -->
  ${titleBlocks}

  <!-- 日期 -->
  <text x="500" y="${360 + (lines.length - 1) * 96}" text-anchor="middle" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="34" fill="rgba(255,255,255,0.75)">${dateRange}</text>

  <!-- 激励语 -->
  <text x="500" y="560" text-anchor="middle" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="30" fill="rgba(255,255,255,0.6)">${slogan}</text>

  <!-- 底部小程序码区域 -->
  <rect x="0" y="${CARD_HEIGHT - 220}" width="${CARD_WIDTH}" height="220" fill="rgba(0,0,0,0.22)"/>
  ${
    qrDataUrl
      ? `<image x="${CARD_WIDTH - 240}" y="${CARD_HEIGHT - 205}" width="160" height="160" xlink:href="${qrDataUrl}"/>`
      : `<rect x="${CARD_WIDTH - 240}" y="${CARD_HEIGHT - 205}" width="160" height="160" rx="16" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)"/>`
  }
  <text x="${CARD_WIDTH - 320}" y="${CARD_HEIGHT - 130}" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="34" fill="#ffffff" text-anchor="middle">长按识别小程序码</text>
  <text x="${CARD_WIDTH - 320}" y="${CARD_HEIGHT - 90}" font-family="'WenQuanYi Micro Hei', sans-serif" font-size="26" fill="rgba(255,255,255,0.65)" text-anchor="middle">一起坚持打卡</text>
</svg>`;

  try {
    await sharp(Buffer.from(svg)).png().toFile(filePath);
    return `/uploads/share-cards/${fileName}`;
  } catch (e) {
    console.error('合成分享卡片失败', e);
    return null;
  }
}

function splitName(name: string): string[] {
  // 粗略按字符数换行：超过 12 个字符切两行
  if (name.length <= 12) return [name];
  const first = name.slice(0, 12);
  const rest = name.slice(12);
  if (rest.length <= 12) return [first, rest];
  return [first, rest.slice(0, 12) + '…'];
}

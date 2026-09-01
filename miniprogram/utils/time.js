/**
 * 时间格式化工具
 * 后端返回的 created_at 为 UTC 时间（格式：YYYY-MM-DD HH:mm:ss），统一按北京时间（UTC+8）展示。
 * 为避免小程序 JavaScript 引擎对 Date 解析的时区差异，这里手动解析时间字符串。
 */

const BJT_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 解析后端 UTC 时间字符串，返回对应的 timestamp（毫秒）
 * 支持格式：YYYY-MM-DD HH:mm:ss / YYYY-MM-DDTHH:mm:ss / 带 Z 或 +/-HH:mm 时区
 */
function parseUTCTimestamp(dateStr) {
  if (!dateStr) return null;

  const str = String(dateStr).trim();
  if (!str) return null;

  // 匹配：YYYY-MM-DD[ T]HH:mm:ss[.sss][Z|+HH:mm|-HH:mm|+HHmm|-HHmm]
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
  if (!match) {
    // 兜底：尝试原生解析
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  const [, year, month, day, hour, minute, second, tz] = match;
  const y = parseInt(year, 10);
  const mo = parseInt(month, 10) - 1;
  const d = parseInt(day, 10);
  const h = parseInt(hour, 10);
  const mi = parseInt(minute, 10);
  const s = parseInt(second, 10);

  if (!tz) {
    // 无显式时区，视为 UTC
    return Date.UTC(y, mo, d, h, mi, s);
  }

  if (tz === 'Z') {
    return Date.UTC(y, mo, d, h, mi, s);
  }

  // 显式时区：先按 UTC 算，再减去时区偏移
  const utcMs = Date.UTC(y, mo, d, h, mi, s);
  const sign = tz[0] === '+' ? 1 : -1;
  const clean = tz.slice(1).replace(':', '');
  const tzHours = parseInt(clean.slice(0, 2), 10);
  const tzMinutes = parseInt(clean.slice(2, 4), 10);
  return utcMs - sign * (tzHours * 60 + tzMinutes) * 60000;
}

/**
 * 把后端 UTC 时间转成北京时间 Date 对象（内部 timestamp 对应北京时间）
 */
function toBJTDate(dateStr) {
  const utcMs = parseUTCTimestamp(dateStr);
  if (utcMs === null) return null;
  return new Date(utcMs + BJT_OFFSET_MS);
}

/**
 * 格式化为：YYYY-MM-DD HH:mm
 */
function formatBJT(dateStr) {
  const bjt = toBJTDate(dateStr);
  if (!bjt) return String(dateStr);

  const pad = n => n.toString().padStart(2, '0');
  const year = bjt.getUTCFullYear();
  const month = pad(bjt.getUTCMonth() + 1);
  const day = pad(bjt.getUTCDate());
  const hours = pad(bjt.getUTCHours());
  const minutes = pad(bjt.getUTCMinutes());

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 格式化为相对时间：今天 HH:mm / 昨天 HH:mm / MM-DD HH:mm
 */
function formatRelativeTime(dateStr) {
  const bjt = toBJTDate(dateStr);
  if (!bjt) return String(dateStr);

  const pad = n => n.toString().padStart(2, '0');
  const nowMs = Date.now();
  const nowBjtMs = nowMs + BJT_OFFSET_MS;
  const nowBjt = new Date(nowBjtMs);

  const today = new Date(Date.UTC(nowBjt.getUTCFullYear(), nowBjt.getUTCMonth(), nowBjt.getUTCDate()));
  const target = new Date(Date.UTC(bjt.getUTCFullYear(), bjt.getUTCMonth(), bjt.getUTCDate()));
  const diff = Math.floor((target - today) / 86400000);

  const hours = pad(bjt.getUTCHours());
  const minutes = pad(bjt.getUTCMinutes());
  const month = pad(bjt.getUTCMonth() + 1);
  const day = pad(bjt.getUTCDate());

  if (diff === 0) return `今天 ${hours}:${minutes}`;
  if (diff === -1) return `昨天 ${hours}:${minutes}`;
  return `${month}-${day} ${hours}:${minutes}`;
}

module.exports = {
  toBJTDate: toBJTDate,
  formatBJT: formatBJT,
  formatRelativeTime: formatRelativeTime
};

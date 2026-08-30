/**
 * Settings Service - 系统设置业务逻辑层
 * 
 * 职责：处理系统设置的读取和更新，包括积分配置等
 */

import db from '../db.js';

export function getPointsSettings() {
  const points_checkin = getIntSetting('points_checkin');
  const points_order_rate = getIntSetting('points_order_rate');
  
  return { points_checkin, points_order_rate };
}

export function updatePointsSettings(data: { points_checkin?: number; points_order_rate?: number }) {
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
  
  if (data.points_checkin !== undefined) {
    const v = parseInt(String(data.points_checkin), 10);
    if (!Number.isFinite(v) || v <= 0 || v > 10000) {
      throw new Error('打卡积分必须是 1-10000 的整数');
    }
    upsert.run('points_checkin', String(v));
  }
  
  if (data.points_order_rate !== undefined) {
    const v = parseInt(String(data.points_order_rate), 10);
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      throw new Error('订单积分比例必须是 1-100 的整数');
    }
    upsert.run('points_order_rate', String(v));
  }
  
  return getPointsSettings();
}

function getIntSetting(key: string): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  if (!row) {
    // 默认值
    if (key === 'points_checkin') return 10;
    if (key === 'points_order_rate') return 10;
    return 0;
  }
  return parseInt(row.value, 10) || 0;
}

/**
 * 打卡服务 - v2.9.0 架构重构
 *
 * 提供打卡活动、参与者、记录等业务逻辑封装
 */

import db from '../db.js';
import { randomUUID } from 'crypto';

// 辅助函数
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function bjtToday(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function bjtDaysAgo(days: number): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  now.setDate(now.getDate() - days);
  return now.toISOString().slice(0, 10);
}

/**
 * 获取打卡活动列表
 */
export function listCheckinEvents(options: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { status, search, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  let whereSql = ' WHERE 1=1';
  const params: any[] = [];

  if (status) {
    whereSql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    whereSql += ' AND (title LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = (db.prepare(`SELECT COUNT(*) as total FROM checkin_events${whereSql}`).get(...params) as any).total;

  const events = db.prepare(`
    SELECT * FROM checkin_events${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  return { events, total };
}

/**
 * 获取单个打卡活动详情
 */
export function getCheckinEventById(id: number) {
  return db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(id) as any;
}

/**
 * 创建打卡活动
 */
export function createCheckinEvent(data: {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  signup_deadline?: string;
  rules?: string;
  points_per_checkin?: number;
  cover_image?: string;
}) {
  const result = db.prepare(`
    INSERT INTO checkin_events (title, description, start_date, end_date, signup_deadline, rules, points_per_checkin, cover_image, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
  `).run(
    data.title,
    data.description || null,
    data.start_date,
    data.end_date,
    data.signup_deadline || null,
    data.rules || null,
    data.points_per_checkin || 0,
    data.cover_image || null
  );

  return db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(result.lastInsertRowid) as any;
}

/**
 * 更新打卡活动
 */
export function updateCheckinEvent(id: number, data: Partial<{
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  signup_deadline: string;
  rules: string;
  points_per_checkin: number;
  cover_image: string;
  status: string;
}>) {
  const fields: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      params.push(value);
    }
  }

  if (fields.length === 0) return null;

  params.push(id);
  db.prepare(`UPDATE checkin_events SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(id) as any;
}

/**
 * 获取活动统计信息
 */
export function getCheckinEventStats(eventId: number) {
  const totalParticipants = (db.prepare(`
    SELECT COUNT(*) as count FROM checkin_participants
    WHERE event_id = ? AND status = 'active'
  `).get(eventId) as any).count;

  const totalRecords = (db.prepare(`
    SELECT COUNT(*) as count
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.event_id = ?
  `).get(eventId) as any).count;

  const approvedRecords = (db.prepare(`
    SELECT COUNT(*) as count
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.event_id = ? AND r.status = 'approved'
  `).get(eventId) as any).count;

  const pendingRecords = (db.prepare(`
    SELECT COUNT(*) as count
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.event_id = ? AND r.status = 'pending'
  `).get(eventId) as any).count;

  const activeParticipants7d = (db.prepare(`
    SELECT COUNT(DISTINCT p.wx_user_id) as count
    FROM checkin_participants p
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    WHERE p.event_id = ? AND r.checkin_date >= date('now', '-7 days')
  `).get(eventId) as any).count;

  return {
    totalParticipants,
    totalRecords,
    approvedRecords,
    pendingRecords,
    activeParticipants7d
  };
}

/**
 * 获取活动排行榜
 */
export function getCheckinRanking(eventId: number, limit = 50) {
  return db.prepare(`
    SELECT
      p.wx_user_id,
      u.nickname,
      u.avatar_url,
      COUNT(r.id) as record_count,
      SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approved_count
    FROM checkin_participants p
    JOIN wx_users u ON p.wx_user_id = u.id
    LEFT JOIN checkin_records r ON r.participant_id = p.id
    WHERE p.event_id = ? AND p.status = 'active'
    GROUP BY p.wx_user_id
    ORDER BY approved_count DESC, record_count DESC
    LIMIT ?
  `).all(eventId, limit) as any[];
}

/**
 * 报名参与活动
 */
export function joinCheckinEvent(eventId: number, wxUserId: number) {
  // 检查活动是否存在
  const event = getCheckinEventById(eventId);
  if (!event) throw new Error('活动不存在');

  // 检查是否已报名
  const existing = db.prepare(`
    SELECT id FROM checkin_participants
    WHERE event_id = ? AND wx_user_id = ?
  `).get(eventId, wxUserId);

  if (existing) throw new Error('已报名参与');

  // 检查报名时间
  const now = bjtToday();
  if (event.signup_deadline && now > event.signup_deadline) {
    throw new Error('报名已截止');
  }

  const result = db.prepare(`
    INSERT INTO checkin_participants (event_id, wx_user_id, status, joined_at)
    VALUES (?, ?, 'active', datetime('now'))
  `).run(eventId, wxUserId);

  return result.lastInsertRowid as number;
}

/**
 * 提交打卡记录
 */
export function submitCheckinRecord(data: {
  participantId: number;
  mediaType: string;
  mediaUrl: string;
  note?: string;
  isMakeup?: boolean;
  makeupDate?: string;
}) {
  const today = bjtToday();

  const result = db.prepare(`
    INSERT INTO checkin_records (participant_id, media_type, media_url, note, status, checkin_date, is_makeup, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
  `).run(
    data.participantId,
    data.mediaType,
    data.mediaUrl,
    data.note || null,
    data.isMakeup ? data.makeupDate : today,
    data.isMakeup ? 1 : 0
  );

  return result.lastInsertRowid as number;
}

/**
 * 审核打卡记录
 */
export function approveCheckinRecord(recordId: number, comment?: string) {
  const record = db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId) as any;
  if (!record) throw new Error('记录不存在');

  db.prepare(`
    UPDATE checkin_records
    SET status = 'approved', approved_at = datetime('now'), approve_comment = ?
    WHERE id = ?
  `).run(comment || null, recordId);

  // 发放积分
  const participant = db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(record.participant_id) as any;
  const event = getCheckinEventById(participant.event_id);

  if (event && event.points_per_checkin > 0) {
    const { grantCheckinPoints } = await import('./points.js');
    grantCheckinPoints(participant.wx_user_id, recordId, event.points_per_checkin);
  }

  return true;
}

/**
 * 拒绝打卡记录
 */
export function rejectCheckinRecord(recordId: number, comment: string) {
  const record = db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId) as any;
  if (!record) throw new Error('记录不存在');

  db.prepare(`
    UPDATE checkin_records
    SET status = 'rejected', approved_at = datetime('now'), approve_comment = ?
    WHERE id = ?
  `).run(comment, recordId);

  return true;
}

/**
 * 获取用户的打卡记录
 */
export function getUserCheckinRecords(wxUserId: number, options: { page?: number; limit?: number }) {
  const { page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const records = db.prepare(`
    SELECT r.*, a.title as event_title, a.id as event_id
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    JOIN checkin_events a ON p.event_id = a.id
    WHERE p.wx_user_id = ?
    ORDER BY r.checkin_date DESC
    LIMIT ? OFFSET ?
  `).all(wxUserId, limit, offset) as any[];

  const total = (db.prepare(`
    SELECT COUNT(*) as count
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.wx_user_id = ?
  `).get(wxUserId) as any).count;

  return { records, total };
}

/**
 * 计算连续打卡天数
 */
export function calculateStreak(records: { checkin_date: string }[]) {
  if (records.length === 0) return { current_streak: 0, max_streak: 0 };

  const dates = records.map(r => r.checkin_date).sort();
  let currentStreak = 1;
  let maxStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return { current_streak: currentStreak, max_streak: maxStreak };
}

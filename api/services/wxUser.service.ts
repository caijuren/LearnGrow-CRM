/**
 * 微信用户服务 - v2.9.0 架构重构
 *
 * 提供微信用户的业务逻辑封装
 */

import { randomUUID } from 'crypto';
import db from '../db.js';
import type { WxUser, OrderWithProduct, FollowUp } from '../../shared/types.js';

// 辅助函数
function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function mapWxUser(c: any): WxUser {
  return {
    ...c,
    tags: parseJson<string[]>(c.tags, []),
    weak_subjects: parseJson<string[]>(c.weak_subjects, []),
  };
}

const DISPLAY_NAME = "COALESCE(NULLIF(name, ''), nickname, child_name, '')";

/**
 * 获取微信用户列表（支持分页、搜索、筛选）
 */
export function listWxUsers(options: {
  search?: string;
  importance?: string;
  stage?: string;
  need_follow?: boolean;
  tag?: string;
  page?: number;
  limit?: number;
  sort?: string;
  dir?: 'ASC' | 'DESC';
}) {
  const {
    search,
    importance,
    stage,
    need_follow,
    tag,
    page = 1,
    limit = 20,
    sort = 'activity',
    dir = 'DESC'
  } = options;

  const SEARCH_COLS = '(name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR child_name LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)';
  const SEARCH_PLACEHOLDERS = 9;

  const ACTIVITY_JOIN = `
    LEFT JOIN (
      SELECT p.wx_user_id AS uid,
             COUNT(DISTINCT p.id) AS signup_count,
             COUNT(r.id) AS checkin_count,
             MAX(r.checkin_date) AS last_checkin_date
      FROM checkin_participants p
      LEFT JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
      WHERE p.wx_user_id IS NOT NULL
      GROUP BY p.wx_user_id
    ) act ON act.uid = u.id`;

  // 构建WHERE条件
  let whereSql = ' WHERE 1=1';
  const params: any[] = [];

  if (search) {
    whereSql += ` AND ${SEARCH_COLS}`;
    params.push(...Array(SEARCH_PLACEHOLDERS).fill(`%${search}%`));
  }
  if (importance) {
    whereSql += ' AND importance = ?';
    params.push(importance);
  }
  if (stage) {
    whereSql += ' AND stage = ?';
    params.push(stage);
  }
  if (need_follow) {
    whereSql += ' AND (last_follow_date IS NULL OR date(last_follow_date) < date("now", "-7 days"))';
  }
  if (tag) {
    whereSql += ' AND tags LIKE ?';
    params.push(`%"${tag}"%`);
  }

  // 排序配置
  const SORTS: Record<string, { by: string; dir: 'ASC' | 'DESC'; then: string }> = {
    activity: { by: 'MAX(COALESCE(substr(u.last_login_at, 1, 10), \'\'), COALESCE(act.last_checkin_date, \'\'))', dir: 'DESC', then: 'COALESCE(act.checkin_count, 0) DESC' },
    joined: { by: 'u.created_at', dir: 'DESC', then: 'u.id DESC' },
    points: { by: 'u.points', dir: 'DESC', then: 'u.id DESC' },
  };

  const sortConfig = SORTS[sort] || SORTS.activity;
  const orderDir = dir === 'asc' ? 'ASC' : dir === 'desc' ? 'DESC' : sortConfig.dir;
  const offset = (page - 1) * limit;

  // 查询总数
  const total = (db.prepare(`SELECT COUNT(*) as total FROM wx_users u${whereSql}`).get(...params) as any).total;

  // 查询数据
  const rows = db.prepare(`
    SELECT u.*, ${DISPLAY_NAME} AS display_name,
           COALESCE(act.signup_count, 0) AS signup_count,
           COALESCE(act.checkin_count, 0) AS checkin_count,
           act.last_checkin_date AS last_checkin_date
    FROM wx_users u${ACTIVITY_JOIN}${whereSql}
    ORDER BY ${sortConfig.by} ${orderDir}, ${sortConfig.then}, u.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as any[];

  // 统计分组
  const groupCount = (col: 'importance' | 'stage') => {
    const q = buildWhereClause({ ...options, [col]: undefined });
    const grouped = db.prepare(`SELECT ${col} AS k, COUNT(*) AS c FROM wx_users${q.sql}`).all(...q.params) as { k: string | null; c: number }[];
    const out: Record<string, number> = {};
    for (const g of grouped) if (g.k) out[g.k] = g.c;
    return out;
  };

  const needFollowQuery = buildWhereClause({ ...options, need_follow: true });
  const needFollowCount = (db.prepare(`SELECT COUNT(*) AS c FROM wx_users${needFollowQuery.sql}`).get(...needFollowQuery.params) as any).c;

  return {
    users: rows.map(mapWxUser),
    total,
    facets: {
      importance: groupCount('importance'),
      stage: groupCount('stage'),
      need_follow: needFollowCount
    }
  };
}

function buildWhereClause(options: any): { sql: string; params: any[] } {
  const { search, importance, stage, need_follow, tag } = options;
  const SEARCH_COLS = '(name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR child_name LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)';
  const SEARCH_PLACEHOLDERS = 9;

  let sql = ' WHERE 1=1';
  const params: any[] = [];

  if (search) { sql += ` AND ${SEARCH_COLS}`; params.push(...Array(SEARCH_PLACEHOLDERS).fill(`%${search}%`)); }
  if (importance) { sql += ' AND importance = ?'; params.push(importance); }
  if (stage) { sql += ' AND stage = ?'; params.push(stage); }
  if (need_follow) { sql += ' AND (last_follow_date IS NULL OR date(last_follow_date) < date("now", "-7 days"))'; }
  if (tag) { sql += ' AND tags LIKE ?'; params.push(`%"${tag}"%`); }

  return { sql, params };
}

/**
 * 获取所有标签
 */
export function getAllTags(): string[] {
  const all = db.prepare('SELECT tags FROM wx_users').all() as any[];
  const tagSet = new Set<string>();
  all.forEach(c => parseJson<string[]>(c.tags, []).forEach((t: string) => tagSet.add(t)));
  return Array.from(tagSet).sort();
}

/**
 * 获取单个微信用户详情（360度视图）
 */
export function getWxUserDetail(id: number) {
  const row = db.prepare(`SELECT *, ${DISPLAY_NAME} AS display_name FROM wx_users WHERE id = ?`).get(id) as any;
  if (!row) return null;

  const user = mapWxUser(row);
  const ordersRaw = db.prepare(`SELECT o.*, p.name as product_name, p.tier as product_tier FROM orders o JOIN products p ON o.product_id = p.id WHERE o.wx_user_id = ? ORDER BY o.purchase_date DESC`).all(id) as any[];
  const followUps = (db.prepare('SELECT * FROM follow_ups WHERE wx_user_id = ? ORDER BY date DESC, created_at DESC').all(id) as any[]).map((f: any) => ({
    ...f,
    tags: parseJson(f.tags, [])
  })) as FollowUp[];
  const children = db.prepare('SELECT * FROM children WHERE wx_user_id = ? ORDER BY created_at DESC').all(id) as any[];

  return {
    ...user,
    children,
    orders: ordersRaw as OrderWithProduct[],
    follow_ups: followUps
  };
}

/**
 * 创建微信用户
 */
export function createWxUser(data: {
  name: string;
  nickname?: string;
  phone?: string;
  wechat_id?: string;
  wechat_remark?: string;
  wechat_add_date?: string;
  wechat_account?: string;
  douyin_nickname?: string;
  source?: string;
  importance?: string;
  stage?: string;
  tags?: string[];
  remark?: string;
  next_talk_topic?: string;
}): WxUser {
  const {
    name,
    nickname,
    phone,
    wechat_id,
    wechat_remark,
    wechat_add_date,
    wechat_account = 'main',
    douyin_nickname,
    source = 'other',
    importance = 'normal',
    stage = 'new_friend',
    tags = [],
    remark,
    next_talk_topic
  } = data;

  const result = db.prepare(`
    INSERT INTO wx_users (openid, name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, tags, remark, next_talk_topic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `manual_${randomUUID()}`,
    name,
    nickname || null,
    phone || null,
    wechat_id || null,
    wechat_remark || null,
    wechat_add_date || null,
    wechat_account,
    douyin_nickname || null,
    source,
    importance,
    stage,
    JSON.stringify(tags),
    remark || null,
    next_talk_topic || null
  );

  const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(result.lastInsertRowid) as any;
  return mapWxUser(user);
}

/**
 * 更新微信用户信息
 */
export function updateWxUser(id: number, data: Partial<{
  name: string;
  nickname: string;
  phone: string;
  wechat_id: string;
  wechat_remark: string;
  wechat_add_date: string;
  wechat_account: string;
  douyin_nickname: string;
  source: string;
  importance: string;
  stage: string;
  tags: string[];
  remark: string;
  next_talk_topic: string;
}>): WxUser {
  const fields: string[] = [];
  const params: any[] = [];

  const editable = [
    'name', 'nickname', 'phone', 'wechat_id', 'wechat_remark',
    'wechat_add_date', 'wechat_account', 'douyin_nickname',
    'source', 'importance', 'stage', 'remark', 'next_talk_topic'
  ];

  for (const key of editable) {
    if (data[key as keyof typeof data] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key as keyof typeof data]);
    }
  }

  if (data.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }

  fields.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE wx_users SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id) as any;
  return mapWxUser(user);
}

/**
 * 更新用户统计数据（订单总额、数量等）
 */
export function updateWxUserStats(wxUserId: number): void {
  const orders = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt, MAX(purchase_date) as last_date FROM orders WHERE wx_user_id = ?").get(wxUserId) as any;
  const lastFollow = db.prepare("SELECT MAX(date) as last_date FROM follow_ups WHERE wx_user_id = ?").get(wxUserId) as any;

  db.prepare("UPDATE wx_users SET total_spent = ?, order_count = ?, last_order_date = ?, last_follow_date = ?, updated_at = datetime('now') WHERE id = ?")
    .run(orders.total || 0, orders.cnt || 0, orders.last_date || null, lastFollow.last_date || null, wxUserId);
}

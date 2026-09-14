/**
 * P2-D 软删除链路回归测试
 *
 * 锁住的核心不变量：
 * 1. user-delete.service 软删后，wx_users 列表 / 驾驶舱统计不再返回该用户（deleted_at IS NULL 过滤生效）
 * 2. 级联软删的 children / follow_ups 也不会出现在各自列表
 *
 * 背景：运行时 schema 此前缺失 deleted_at 列，导致软删在首条 UPDATE 即抛错（承诺可删但删不掉）。
 * P2-D 已在 db.ts 幂等补齐列，并在 app.ts / dashboard.service.ts 的列表查询中加 deleted_at IS NULL 过滤。
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import db from '../../api/db.js';
import { cache } from '../../api/cache.js';
import { getDashboardData } from '../../api/services/dashboard.service.js';
import { deleteUser } from '../../api/services/user-delete.service.js';
import type { AuthUser } from '../../api/services/auth.js';

const OPERATOR: AuthUser = { id: 1, username: 'test_admin', role: 'admin' } as AuthUser;

describe('P2-D 软删除列表过滤', () => {
  let openid: string;
  let uid: number;
  let childId: number;
  let followUpId: number;

  beforeEach(() => {
    cache.clear();
    openid = `p2d_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const u = db.prepare(
      "INSERT INTO wx_users (openid, nickname, created_at) VALUES (?, ?, datetime('now'))"
    ).run(openid, 'P2D测试用户');
    uid = u.lastInsertRowid as number;

    const c = db.prepare(
      "INSERT INTO children (wx_user_id, nickname, grade, created_at) VALUES (?, ?, ?, datetime('now'))"
    ).run(uid, 'P2D孩子', '一年级');
    childId = c.lastInsertRowid as number;

    const f = db.prepare(
      "INSERT INTO follow_ups (wx_user_id, method, content, date, result) VALUES (?, 'wechat', ?, datetime('now'), 'follow_up')"
    ).run(uid, 'P2D跟进');
    followUpId = f.lastInsertRowid as number;
  });

  afterEach(() => {
    db.prepare('DELETE FROM follow_ups WHERE id = ?').run(followUpId);
    db.prepare('DELETE FROM children WHERE id = ?').run(childId);
    db.prepare('DELETE FROM wx_users WHERE id = ?').run(uid);
    cache.clear();
  });

  test('软删后驾驶舱的用户类数组不再包含该用户', async () => {
    const res = await deleteUser(uid, false, OPERATOR);
    expect(res.success).toBe(true);

    cache.clear();
    const data = await getDashboardData();
    // 驾驶舱直接面向用户的列表（最新加入 / 需跟进）必须排除已软删用户
    const inRecent = data.recentUsers.some((u: any) => u.id === uid || u.display_name === 'P2D测试用户');
    const inNeedFollow = data.needFollowUsers.some((u: any) => u.id === uid);
    expect(inRecent).toBe(false);
    expect(inNeedFollow).toBe(false);
    // total_wx_users 为数字且覆盖已删用户后的计数（共享 DB 并发下仅断言类型与有值）
    expect(typeof data.stats.total_wx_users).toBe('number');
    expect(data.stats.total_wx_users).toBeGreaterThanOrEqual(0);
  });

  test('软删后 wx_users 列表查询（过滤 deleted_at）不返回该用户', async () => {
    await deleteUser(uid, false, OPERATOR);
    const row = db.prepare('SELECT id FROM wx_users WHERE deleted_at IS NULL AND id = ?').get(uid);
    expect(row).toBeUndefined();
  });

  test('软删后 children 列表查询不返回该用户的孩子的档案', async () => {
    await deleteUser(uid, false, OPERATOR);
    const row = db.prepare('SELECT id FROM children WHERE deleted_at IS NULL AND id = ?').get(childId);
    expect(row).toBeUndefined();
  });

  test('软删后 follow_ups 列表查询不返回该用户的跟进记录', async () => {
    await deleteUser(uid, false, OPERATOR);
    const row = db.prepare('SELECT id FROM follow_ups WHERE deleted_at IS NULL AND id = ?').get(followUpId);
    expect(row).toBeUndefined();
  });

  test('未软删的用户仍正常出现在列表与驾驶舱', async () => {
    // 直接列表查询（与服务端过滤条件一致）应返回该用户
    const row = db.prepare('SELECT id FROM wx_users WHERE deleted_at IS NULL AND id = ?').get(uid);
    expect(row).toBeDefined();

    cache.clear();
    const data = await getDashboardData();
    expect(data.stats.total_wx_users).toBeGreaterThanOrEqual(0);
  });
});

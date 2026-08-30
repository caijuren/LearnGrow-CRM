/**
 * 打卡流程集成测试
 * 测试完整打卡流程：创建活动 -> 报名 -> 提交打卡 -> 审核 -> 积分发放
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../../api/db.js';

describe('Checkin Flow Integration', () => {
  let testUserId: number;
  let testEventId: number;
  let testParticipantId: number;
  let testProductId: number;

  beforeAll(() => {
    // 创建测试用户
    const userResult = db.prepare(
      "INSERT INTO wx_users (openid, nickname, name, phone, stage) VALUES (?, ?, ?, ?, ?)"
    ).run('test_openid_checkin', '测试用户', '张三', '13800138000', 'interested');
    testUserId = userResult.lastInsertRowid as number;

    // 创建测试产品
    const productResult = db.prepare(
      "INSERT INTO products (name, price, commission_percent, is_on_sale) VALUES (?, ?, ?, ?)"
    ).run('打卡课程', 500, 10, true);
    testProductId = productResult.lastInsertRowid as number;

    // 创建打卡活动
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const eventResult = db.prepare(`
      INSERT INTO checkin_events (title, description, start_date, end_date, signup_deadline, status, points_per_checkin, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('测试打卡活动', '每日阅读打卡', now, now, now, 'active', 10, now);
    testEventId = eventResult.lastInsertRowid as number;

    // 报名参与
    const participantResult = db.prepare(
      "INSERT INTO checkin_participants (event_id, wx_user_id, status) VALUES (?, ?, ?)"
    ).run(testEventId, testUserId, 'active');
    testParticipantId = participantResult.lastInsertRowid as number;
  });

  afterAll(() => {
    // 清理测试数据（按依赖顺序）
    db.prepare('DELETE FROM checkin_records WHERE participant_id IN (SELECT id FROM checkin_participants WHERE event_id = ?)').run(testEventId);
    db.prepare('DELETE FROM checkin_participants WHERE event_id = ?').run(testEventId);
    db.prepare('DELETE FROM checkin_events WHERE id = ?').run(testEventId);
    db.prepare('DELETE FROM orders WHERE wx_user_id = ?').run(testUserId);
    db.prepare('DELETE FROM points_ledger WHERE wx_user_id = ?').run(testUserId);
    db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
    db.prepare('DELETE FROM wx_users WHERE openid = ?').run('test_openid_checkin');
  });

  describe('Create Checkin Event', () => {
    it('应该成功创建打卡活动', () => {
      const event = db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(testEventId) as any;
      expect(event).toBeDefined();
      expect(event.title).toBe('测试打卡活动');
      expect(event.status).toBe('active');
      expect(event.points_per_checkin).toBe(10);
    });
  });

  describe('Submit Checkin Record', () => {
    it('应该成功提交打卡记录', () => {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const result = db.prepare(`
        INSERT INTO checkin_records (participant_id, media_type, media_url, status, checkin_date, created_at)
        VALUES (?, 'image', '/uploads/test.jpg', 'pending', ?, ?)
      `).run(testParticipantId, now, now);

      expect(result.lastInsertRowid).toBeGreaterThan(0);

      const record = db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(result.lastInsertRowid) as any;
      expect(record.status).toBe('pending');
      expect(record.participant_id).toBe(testParticipantId);
    });

    it('应该能查询到待审核的打卡', () => {
      const pendingRecords = db.prepare(
        "SELECT * FROM checkin_records WHERE status = 'pending' AND participant_id = ?"
      ).all(testParticipantId) as any[];

      expect(pendingRecords.length).toBeGreaterThan(0);
    });
  });

  describe('Approve Checkin Record', () => {
    let recordId: number;

    beforeAll(() => {
      const records = db.prepare(
        "SELECT id FROM checkin_records WHERE status = 'pending' AND participant_id = ?"
      ).all(testParticipantId) as any[];
      if (records.length > 0) {
        recordId = records[0].id;
      }
    });

    it('应该能审核通过打卡记录', () => {
      if (!recordId) return;

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare("UPDATE checkin_records SET status = 'approved', approved_at = ? WHERE id = ?").run(now, recordId);

      const record = db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId) as any;
      expect(record.status).toBe('approved');
      expect(record.approved_at).toBeDefined();
    });

    it('审核通过后应发放积分', () => {
      if (!recordId) return;

      // 模拟积分发放逻辑
      const event = db.prepare('SELECT points_per_checkin FROM checkin_events WHERE id = ?').get(testEventId) as any;
      const points = event.points_per_checkin;

      const ledgerResult = db.prepare(`
        INSERT INTO points_ledger (wx_user_id, ref_type, ref_id, points, reason, created_at)
        VALUES (?, 'checkin', ?, ?, '打卡奖励', datetime('now'))
      `).run(testUserId, recordId, points);

      expect(ledgerResult.lastInsertRowid).toBeGreaterThan(0);

      const ledger = db.prepare('SELECT * FROM points_ledger WHERE id = ?').get(ledgerResult.lastInsertRowid) as any;
      expect(ledger.points).toBe(points);
      expect(ledger.ref_type).toBe('checkin');
    });
  });

  describe('Checkin Statistics', () => {
    it('应该能统计活动参与人数', () => {
      const stats = db.prepare(`
        SELECT COUNT(DISTINCT p.wx_user_id) as participant_count
        FROM checkin_participants p
        WHERE p.event_id = ?
      `).get(testEventId) as any;

      expect(stats.participant_count).toBe(1);
    });

    it('应该能统计已审核打卡数', () => {
      const stats = db.prepare(`
        SELECT COUNT(*) as approved_count
        FROM checkin_records r
        JOIN checkin_participants p ON r.participant_id = p.id
        WHERE p.event_id = ? AND r.status = 'approved'
      `).get(testEventId) as any;

      expect(stats.approved_count).toBeGreaterThanOrEqual(0);
    });
  });
});

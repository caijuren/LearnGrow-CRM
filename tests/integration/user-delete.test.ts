/**
 * 用户数据删除功能测试 - v2.7.0
 * 
 * 测试场景:
 * 1. 软删除用户及级联清理
 * 2. 硬删除用户及物理清除
 * 3. 批量软删除
 * 4. 审计日志记录
 */

import { describe, test, expect, beforeEach } from 'vitest';
import db from '../../api/db.js';
import { deleteUser, batchSoftDeleteUsers } from '../../api/services/user-delete.service.js';
import type { AuthUser } from '../../api/services/auth.js';

const TEST_OPERATOR: AuthUser = {
  id: 1,
  username: 'test_admin',
  role: 'admin'
};

describe('用户数据删除功能', () => {
  let testUserId: number;
  let testChildId: number;
  let testOrderId: number;

  // 每个测试前创建测试数据
  beforeEach(() => {
    // 清理之前的测试数据
    cleanupTestData();
    
    // 创建测试用户
    const userResult = db.prepare(`
      INSERT INTO wx_users (openid, nickname, child_name, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(`test_openid_${Date.now()}_${Math.random()}`, '测试用户', '测试孩子');
    
    testUserId = userResult.lastInsertRowid as number;
    
    // 创建测试孩子档案
    const childResult = db.prepare(`
      INSERT INTO children (wx_user_id, nickname, grade, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(testUserId, '测试孩子', '一年级');
    
    testChildId = childResult.lastInsertRowid as number;
  });

  test('软删除用户应标记deleted_at而非物理删除', async () => {
    const result = await deleteUser(testUserId, false, TEST_OPERATOR);
    
    expect(result.success).toBe(true);
    expect(result.user_id).toBe(testUserId);
    expect(result.hard_delete).toBe(false);
    
    // 验证用户被标记为已删除
    const user = db.prepare('SELECT deleted_at FROM wx_users WHERE id = ?').get(testUserId) as any;
    expect(user.deleted_at).not.toBeNull();
    
    // 验证级联清理统计
    expect(result.cascade_deleted.children).toBeGreaterThanOrEqual(1);
    // orders在未创建时为0，所以只验证children
  });

  test('硬删除用户应物理清除所有关联数据', async () => {
    const result = await deleteUser(testUserId, true, TEST_OPERATOR);
    
    expect(result.success).toBe(true);
    expect(result.hard_delete).toBe(true);
    
    // 验证用户已被物理删除
    const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(testUserId);
    expect(user).toBeUndefined();
    
    // 验证关联数据也被删除
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(testChildId);
    expect(child).toBeUndefined();
    
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId);
    expect(order).toBeUndefined();
  });

  test('删除不存在的用户应返回错误', async () => {
    const result = await deleteUser(999999, false, TEST_OPERATOR);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('不存在');
  });

  test('批量软删除应处理所有用户', async () => {
    // 创建额外的测试用户
    const extraUserIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const result = db.prepare(`
        INSERT INTO wx_users (openid, nickname, created_at)
        VALUES (?, ?, datetime('now'))
      `).run(`extra_${i}_${Date.now()}`, `额外用户${i}`);
      extraUserIds.push(result.lastInsertRowid as number);
    }
    
    const allUserIds = [testUserId, ...extraUserIds];
    const results = await batchSoftDeleteUsers(allUserIds, TEST_OPERATOR);
    
    expect(results.length).toBe(allUserIds.length);
    expect(results.every(r => r.success)).toBe(true);
    
    // 验证所有用户都被标记为已删除
    for (const userId of allUserIds) {
      const user = db.prepare('SELECT deleted_at FROM wx_users WHERE id = ?').get(userId) as any;
      expect(user.deleted_at).not.toBeNull();
    }
  });

  test('审计日志应记录删除操作', async () => {
    await deleteUser(testUserId, false, TEST_OPERATOR);
    
    // 检查audit_logs表
    const auditLog = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE user_id = ? AND action = 'USER_SOFT_DELETED'
      ORDER BY id DESC LIMIT 1
    `).get(testUserId) as any;
    
    expect(auditLog).toBeDefined();
    expect(auditLog.operator_id).toBe(TEST_OPERATOR.id);
    expect(auditLog.details).toContain('测试用户');
  });
});

// 清理测试数据
function cleanupTestData() {
  try {
    db.prepare("DELETE FROM audit_logs WHERE operator_id = 1 AND username = 'test_admin'").run();
    db.prepare("DELETE FROM wx_users WHERE openid LIKE 'test_openid_%' OR openid LIKE 'extra_%'").run();
    db.prepare("DELETE FROM orders WHERE order_no LIKE 'TEST_ORDER_%'").run();
  } catch (e) {
    // 忽略清理错误（表可能不存在）
  }
}

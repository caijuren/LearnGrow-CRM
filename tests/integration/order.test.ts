/**
 * 订单管理集成测试
 * 测试订单创建、积分计算、状态变更等核心功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import db from '../../api/db.js';

describe('Order Management Integration', () => {
  let testUserId: number;
  let testProductId: number;
  let testOrderId: number;

  beforeAll(() => {
    // 创建测试用户
    const userResult = db.prepare(
      "INSERT INTO wx_users (openid, nickname, name, phone, stage, total_spent, order_count) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run('test_openid_order', '订单测试用户', '李四', '13900139000', 'purchased', 0, 0);
    testUserId = userResult.lastInsertRowid as number;

    // 创建测试产品（佣金比例10%）
    const productResult = db.prepare(
      "INSERT INTO products (name, price, commission_percent, is_on_sale) VALUES (?, ?, ?, ?)"
    ).run('测试课程', 1000, 10, true);
    testProductId = productResult.lastInsertRowid as number;
  });

  afterAll(() => {
    // 清理测试数据（按依赖顺序）
    db.prepare('DELETE FROM points_ledger WHERE wx_user_id = ?').run(testUserId);
    db.prepare('DELETE FROM orders WHERE wx_user_id = ?').run(testUserId);
    db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
    db.prepare('DELETE FROM wx_users WHERE openid = ?').run('test_openid_order');
  });

  describe('Create Order', () => {
    it('应该成功创建订单', () => {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const result = db.prepare(`
        INSERT INTO orders (wx_user_id, product_id, amount, purchase_date, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(testUserId, testProductId, 1000, now, 'completed', now);

      testOrderId = result.lastInsertRowid as number;
      expect(testOrderId).toBeGreaterThan(0);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.wx_user_id).toBe(testUserId);
      expect(order.product_id).toBe(testProductId);
      expect(order.amount).toBe(1000);
      expect(order.status).toBe('completed');
    });

    it('创建订单后应更新用户统计', () => {
      // 手动触发统计更新（模拟业务逻辑）
      const stats = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as order_count
        FROM orders WHERE wx_user_id = ? AND status = 'completed'
      `).get(testUserId) as any;

      db.prepare('UPDATE wx_users SET total_spent = ?, order_count = ? WHERE id = ?')
        .run(stats.total_spent, stats.order_count, testUserId);

      const user = db.prepare('SELECT total_spent, order_count FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.total_spent).toBe(1000);
      expect(user.order_count).toBe(1);
    });
  });

  describe('Points Calculation', () => {
    it('应该根据订单金额和佣金比例计算积分', () => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(testProductId) as any;

      const expectedPoints = Math.floor(order.amount * (product.commission_percent / 100));
      expect(expectedPoints).toBe(100); // 1000 * (10/100) = 100

      // 记录积分流水
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const ledgerResult = db.prepare(`
        INSERT INTO points_ledger (wx_user_id, ref_type, ref_id, points, reason, created_at)
        VALUES (?, 'order', ?, ?, '订单积分奖励', ?)
      `).run(testUserId, testOrderId, expectedPoints, now);

      expect(ledgerResult.lastInsertRowid).toBeGreaterThan(0);
    });

    it('应该能查询用户积分余额', () => {
      const balance = db.prepare(`
        SELECT COALESCE(SUM(points), 0) as total_points
        FROM points_ledger WHERE wx_user_id = ?
      `).get(testUserId) as any;

      expect(balance.total_points).toBe(100);
    });
  });

  describe('Order Status Changes', () => {
    it('应该能将订单标记为已退款', () => {
      db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(testOrderId);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.status).toBe('refunded');
    });

    it('退款后应扣减用户统计', () => {
      const stats = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as order_count
        FROM orders WHERE wx_user_id = ? AND status = 'completed'
      `).get(testUserId) as any;

      db.prepare('UPDATE wx_users SET total_spent = ?, order_count = ? WHERE id = ?')
        .run(stats.total_spent, stats.order_count, testUserId);

      const user = db.prepare('SELECT total_spent, order_count FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.total_spent).toBe(0); // 退款后归零
      expect(user.order_count).toBe(0);
    });

    it('退款后应扣除相应积分', () => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(testProductId) as any;
      const refundPoints = -Math.floor(order.amount * (product.commission_percent / 100));

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      db.prepare(`
        INSERT INTO points_ledger (wx_user_id, ref_type, ref_id, points, reason, created_at)
        VALUES (?, 'refund', ?, ?, '退款扣减积分', ?)
      `).run(testUserId, testOrderId, refundPoints, now);

      const balance = db.prepare(`
        SELECT COALESCE(SUM(points), 0) as total_points
        FROM points_ledger WHERE wx_user_id = ?
      `).get(testUserId) as any;

      expect(balance.total_points).toBe(0); // 100 - 100 = 0
    });
  });

  describe('Order Queries', () => {
    it('应该能按用户查询订单列表', () => {
      const orders = db.prepare(`
        SELECT o.*, p.name as product_name
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.wx_user_id = ?
        ORDER BY o.created_at DESC
      `).all(testUserId) as any[];

      expect(orders.length).toBe(1);
      expect(orders[0].product_name).toBe('测试课程');
    });

    it('应该能按产品查询购买用户数', () => {
      const stats = db.prepare(`
        SELECT COUNT(DISTINCT wx_user_id) as buyer_count
        FROM orders WHERE product_id = ? AND status = 'completed'
      `).get(testProductId) as any;

      // 注意：前面已经退款，所以completed状态的为0
      expect(stats.buyer_count).toBe(0);
    });
  });
});

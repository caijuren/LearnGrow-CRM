/**
 * 订单管理集成测试
 * 测试订单创建、积分发放、退款撤销积分等核心功能
 *
 * 真实 schema：orders 表无 status 列（用 order_type），退款通过删除订单 + 撤销积分实现
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

    // 创建测试产品（佣金比例10%，is_on_sale 为 0/1 整数）
    const productResult = db.prepare(
      "INSERT INTO products (name, price, commission_percent, is_on_sale) VALUES (?, ?, ?, ?)"
    ).run('测试课程', 1000, 10, 1);
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
      const orderNo = `TEST_ORDER_${Date.now()}`;
      const result = db.prepare(`
        INSERT INTO orders (order_no, wx_user_id, product_id, amount, purchase_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderNo, testUserId, testProductId, 1000, now, now);

      testOrderId = result.lastInsertRowid as number;
      expect(testOrderId).toBeGreaterThan(0);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.wx_user_id).toBe(testUserId);
      expect(order.product_id).toBe(testProductId);
      expect(order.amount).toBe(1000);
      expect(order.order_no).toBe(orderNo);
    });

    it('创建订单后应更新用户统计', () => {
      const stats = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as order_count
        FROM orders WHERE wx_user_id = ?
      `).get(testUserId) as any;

      db.prepare('UPDATE wx_users SET total_spent = ?, order_count = ? WHERE id = ?')
        .run(stats.total_spent, stats.order_count, testUserId);

      const user = db.prepare('SELECT total_spent, order_count FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.total_spent).toBe(1000);
      expect(user.order_count).toBe(1);
    });
  });

  describe('Points Calculation', () => {
    it('应该根据订单金额发放积分', () => {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(testOrderId) as any;
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(testProductId) as any;

      const expectedPoints = Math.floor(order.amount * (product.commission_percent / 100));
      expect(expectedPoints).toBe(100); // 1000 * (10/100) = 100

      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const ledgerResult = db.prepare(`
        INSERT INTO points_ledger (wx_user_id, amount, type, ref_type, ref_id, note, created_at)
        VALUES (?, ?, 'order', 'order', ?, '订单积分奖励', ?)
      `).run(testUserId, expectedPoints, testOrderId, now);

      expect(ledgerResult.lastInsertRowid).toBeGreaterThan(0);

      // 同步累加用户积分余额
      db.prepare('UPDATE wx_users SET points = points + ? WHERE id = ?').run(expectedPoints, testUserId);
    });

    it('应该能查询用户积分余额', () => {
      const user = db.prepare('SELECT points FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.points).toBe(100);
    });
  });

  describe('Order Refund (删除订单 + 撤销积分)', () => {
    it('删除订单后应扣减用户统计', () => {
      db.prepare('DELETE FROM orders WHERE id = ?').run(testOrderId);

      const stats = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as order_count
        FROM orders WHERE wx_user_id = ?
      `).get(testUserId) as any;

      db.prepare('UPDATE wx_users SET total_spent = ?, order_count = ? WHERE id = ?')
        .run(stats.total_spent, stats.order_count, testUserId);

      const user = db.prepare('SELECT total_spent, order_count FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.total_spent).toBe(0);
      expect(user.order_count).toBe(0);
    });

    it('退款后应撤销相应积分', () => {
      const ledger = db.prepare(
        "SELECT amount FROM points_ledger WHERE wx_user_id = ? AND ref_type = 'order' AND ref_id = ?"
      ).get(testUserId, testOrderId) as any;
      const refundAmount = ledger ? ledger.amount : 0;

      // 撤销积分：反向扣减余额
      db.prepare('UPDATE wx_users SET points = points - ? WHERE id = ?').run(refundAmount, testUserId);

      const user = db.prepare('SELECT points FROM wx_users WHERE id = ?').get(testUserId) as any;
      expect(user.points).toBe(0); // 100 - 100 = 0
    });
  });

  describe('Order Queries', () => {
    it('应该能按用户查询订单列表（退款后应为空）', () => {
      const orders = db.prepare(`
        SELECT o.*, p.name as product_name
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.wx_user_id = ?
        ORDER BY o.created_at DESC
      `).all(testUserId) as any[];

      expect(orders.length).toBe(0);
    });

    it('应该能按产品查询购买用户数', () => {
      const stats = db.prepare(`
        SELECT COUNT(DISTINCT wx_user_id) as buyer_count
        FROM orders WHERE product_id = ?
      `).get(testProductId) as any;

      // 退款（删除订单）后购买数为 0
      expect(stats.buyer_count).toBe(0);
    });
  });
});

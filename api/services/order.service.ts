/**
 * Order Service - 订单业务逻辑层
 * 
 * 职责：处理订单创建、查询、删除等业务逻辑，包含积分计算和销售统计更新
 */

import db from '../db.js';
import { getIntSetting } from './points.js';

interface CreateOrderData {
  wx_user_id: number;
  product_id: number;
  amount?: number;
  order_type?: 'first' | 'repurchase';
  remark?: string;
  shipping_note?: string;
  child_id?: number;
}

interface ListOrdersOptions {
  wx_user_id?: number;
  page?: number;
  limit?: number;
}

export function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${dateStr}${random}`;
}

export function listOrders(options: ListOrdersOptions = {}) {
  const { wx_user_id, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;
  
  let sql = `SELECT o.*, 
    COALESCE(NULLIF(c.name, ''), c.nickname, c.child_name, '') as wx_user_name, 
    p.name as product_name, 
    p.tier as product_tier 
    FROM orders o 
    JOIN wx_users c ON o.wx_user_id = c.id 
    JOIN products p ON o.product_id = p.id 
    WHERE 1=1`;
  const params: any[] = [];
  
  if (wx_user_id) {
    sql += ' AND o.wx_user_id = ?';
    params.push(wx_user_id);
  }
  
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const orders = db.prepare(sql).all(...params) as any[];
  const total = (db.prepare('SELECT COUNT(*) as total FROM orders').get() as any).total;
  
  return { orders, total };
}

export function getOrderById(id: number) {
  const order = db.prepare(`SELECT o.*, 
    COALESCE(NULLIF(c.name, ''), c.nickname, c.child_name, '') as wx_user_name, 
    p.name as product_name, 
    p.tier as product_tier 
    FROM orders o 
    JOIN wx_users c ON o.wx_user_id = c.id 
    JOIN products p ON o.product_id = p.id 
    WHERE o.id = ?`).get(id) as any;
  
  return order || null;
}

export function createOrder(data: CreateOrderData) {
  const { wx_user_id, product_id, amount, order_type, remark, shipping_note, child_id } = data;
  
  // 验证产品是否存在
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
  if (!product) {
    throw new Error('产品不存在');
  }
  
  // 确定金额
  const finalAmount = amount || product.price;
  
  // 确定订单类型
  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE wx_user_id = ?').get(wx_user_id) as any).c;
  const finalType = order_type || (existingCount === 0 ? 'first' : 'repurchase');
  
  // 创建订单
  const r = db.prepare(
    "INSERT INTO orders (order_no, wx_user_id, child_id, product_id, amount, order_type, remark, shipping_note, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))"
  ).run(generateOrderNo(), wx_user_id, child_id || null, product_id, finalAmount, finalType, remark || null, shipping_note || null);
  
  const orderId = r.lastInsertRowid as number;
  
  // 计算并授予积分
  const earned = Math.floor(finalAmount * getIntSetting('points_order_rate'));
  if (earned > 0) {
    const { grantOrderPoints } = await import('./points.js');
    grantOrderPoints(wx_user_id, orderId, earned);
  }
  
  // 更新用户统计
  updateWxUserStats(wx_user_id);
  
  // 更新产品销售统计
  updateProductSales(product_id);
  
  // 返回创建的订单
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
}

export function deleteOrder(id: number) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    throw new Error('订单不存在');
  }
  
  // 删除订单
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  
  // 撤销相关积分
  const { revokeByRef } = await import('./points.js');
  revokeByRef(order.wx_user_id, 'order', id);
  
  // 更新统计
  updateWxUserStats(order.wx_user_id);
  updateProductSales(order.product_id);
  
  return order;
}

export function updateWxUserStats(wxUserId: number) {
  const orders = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt, MAX(purchase_date) as last_date FROM orders WHERE wx_user_id = ?").get(wxUserId) as any;
  const lastFollow = db.prepare("SELECT MAX(date) as last_date FROM follow_ups WHERE wx_user_id = ?").get(wxUserId) as any;
  
  db.prepare("UPDATE wx_users SET total_spent = ?, order_count = ?, last_order_date = ?, last_follow_date = ?, updated_at = datetime('now') WHERE id = ?").run(
    orders.total || 0, 
    orders.cnt || 0, 
    orders.last_date || null, 
    lastFollow.last_date || null, 
    wxUserId
  );
}

export function updateProductSales(productId: number) {
  const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE product_id = ?").get(productId) as any).c;
  db.prepare("UPDATE products SET sales_count = ? WHERE id = ?").run(count, productId);
}

/**
 * Order Repository - 订单数据访问层
 * 
 * 职责：封装订单的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { OrderWithProduct } from '../../shared/types.js';

export class OrderRepository extends BaseRepository<OrderWithProduct> {
  constructor() {
    super('orders');
  }
  
  /**
   * 获取用户的订单列表（包含产品信息）
   */
  findByUser(wxUserId: number, options: { page?: number; limit?: number } = {}): { orders: OrderWithProduct[]; total: number } {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const total = db.prepare(
      'SELECT COUNT(*) as total FROM orders WHERE wx_user_id = ?'
    ).get(wxUserId) as any;
    
    const orders = db.prepare(`
      SELECT o.*, p.name as product_name, p.tier as product_tier 
      FROM orders o 
      JOIN products p ON o.product_id = p.id 
      WHERE o.wx_user_id = ? 
      ORDER BY o.purchase_date DESC 
      LIMIT ? OFFSET ?
    `).all(wxUserId, limit, offset) as OrderWithProduct[];
    
    return { orders, total: total.total };
  }
  
  /**
   * 统计用户的订单总金额和数量
   */
  getUserStats(wxUserId: number): { totalAmount: number; orderCount: number; lastOrderDate: string | null } {
    const stats = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as totalAmount, 
             COUNT(*) as orderCount, 
             MAX(purchase_date) as lastOrderDate 
      FROM orders 
      WHERE wx_user_id = ?
    `).get(wxUserId) as any;
    
    return {
      totalAmount: stats.totalAmount || 0,
      orderCount: stats.orderCount || 0,
      lastOrderDate: stats.lastOrderDate || null
    };
  }
  
  /**
   * 统计产品的销售数量和销售额
   */
  getProductStats(productId: number): { salesCount: number; totalRevenue: number } {
    const stats = db.prepare(`
      SELECT COUNT(*) as salesCount, 
             COALESCE(SUM(amount), 0) as totalRevenue 
      FROM orders 
      WHERE product_id = ?
    `).get(productId) as any;
    
    return {
      salesCount: stats.salesCount || 0,
      totalRevenue: stats.totalRevenue || 0
    };
  }
  
  /**
   * 生成订单号
   */
  generateOrderNo(): string {
    const now = new Date();
    const dateStr = now.getFullYear().toString() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD${dateStr}${random}`;
  }
}

export const orderRepo = new OrderRepository();

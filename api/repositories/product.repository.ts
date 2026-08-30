/**
 * Product Repository - 产品数据访问层
 * 
 * 职责：封装产品的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { Product } from '../../shared/types.js';

export class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('products');
  }
  
  /**
   * 获取在售产品列表（简化版）
   */
  findOnSale(): Product[] {
    return db.prepare(
      'SELECT id, name, price, tier FROM products WHERE is_on_sale = 1 ORDER BY name'
    ).all() as Product[];
  }
  
  /**
   * 根据分类和层级筛选产品
   */
  findByFilters(options: { tier?: string; category?: string; page?: number; limit?: number }): { products: Product[]; total: number } {
    const { tier, category, page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;
    
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    
    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    sql += " ORDER BY CASE tier WHEN 'traffic' THEN 1 WHEN 'main' THEN 2 ELSE 3 END, sales_count DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    
    const products = db.prepare(sql).all(...params) as Product[];
    
    // 统计总数
    let countSql = 'SELECT COUNT(*) as total FROM products WHERE 1=1';
    const cparams: any[] = [];
    if (tier) {
      countSql += ' AND tier = ?';
      cparams.push(tier);
    }
    if (category) {
      countSql += ' AND category = ?';
      cparams.push(category);
    }
    
    const total = (db.prepare(countSql).get(...cparams) as any).total;
    
    return { products, total };
  }
  
  /**
   * 更新产品销售数量
   */
  updateSalesCount(productId: number): void {
    const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE product_id = ?").get(productId) as any).c;
    db.prepare("UPDATE products SET sales_count = ? WHERE id = ?").run(count, productId);
  }
}

export const productRepo = new ProductRepository();

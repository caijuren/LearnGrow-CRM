/**
 * Product Service - 产品业务逻辑层
 * 
 * 职责：处理产品的增删改查业务逻辑
 */

import db from '../db.js';

interface ListProductsOptions {
  tier?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface CreateProductData {
  name: string;
  tier?: 'traffic' | 'main' | 'premium';
  category?: string;
  price?: number;
  commission_percent?: number;
  selling_points?: string;
  related_product_ids?: number[];
  description?: string;
  is_on_sale?: boolean;
}

export function listProducts(options: ListProductsOptions = {}) {
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
  
  const products = db.prepare(sql).all(...params) as any[];
  
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

export function getAllOnSaleProducts() {
  return db.prepare('SELECT id, name, price, tier FROM products WHERE is_on_sale = 1 ORDER BY name').all() as any[];
}

export function getProductById(id: number) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any || null;
}

export function createProduct(data: CreateProductData) {
  const { 
    name, 
    tier = 'main', 
    category, 
    price = 0, 
    commission_percent = 0, 
    selling_points, 
    related_product_ids = [], 
    description, 
    is_on_sale = true 
  } = data;
  
  if (!name) {
    throw new Error('商品名不能为空');
  }
  
  const r = db.prepare(
    'INSERT INTO products (name, tier, category, price, commission_percent, selling_points, related_product_ids, description, is_on_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    name, 
    tier, 
    category || null, 
    price, 
    commission_percent, 
    selling_points || null, 
    JSON.stringify(related_product_ids), 
    description || null, 
    is_on_sale ? 1 : 0
  );
  
  return db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid) as any;
}

export function updateProduct(id: number, data: Partial<CreateProductData>) {
  // 验证记录存在
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) {
    throw new Error('产品不存在');
  }
  
  const fields: string[] = [];
  const params: any[] = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.tier !== undefined) {
    fields.push('tier = ?');
    params.push(data.tier);
  }
  if (data.category !== undefined) {
    fields.push('category = ?');
    params.push(data.category);
  }
  if (data.price !== undefined) {
    fields.push('price = ?');
    params.push(data.price);
  }
  if (data.commission_percent !== undefined) {
    fields.push('commission_percent = ?');
    params.push(data.commission_percent);
  }
  if (data.selling_points !== undefined) {
    fields.push('selling_points = ?');
    params.push(data.selling_points);
  }
  if (data.related_product_ids !== undefined) {
    fields.push('related_product_ids = ?');
    params.push(JSON.stringify(data.related_product_ids));
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    params.push(data.description);
  }
  if (data.is_on_sale !== undefined) {
    fields.push('is_on_sale = ?');
    params.push(data.is_on_sale ? 1 : 0);
  }
  
  if (fields.length === 0) {
    throw new Error('没有需要更新的字段');
  }
  
  params.push(id);
  db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
}

export function deleteProduct(id: number) {
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
}

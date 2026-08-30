/**
 * Material Repository - 素材数据访问层
 * 
 * 职责：封装素材的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { Material } from '../../shared/types.js';

export class MaterialRepository extends BaseRepository<Material> {
  constructor() {
    super('materials');
  }
  
  /**
   * 获取素材列表（包含关联信息）
   */
  findAllWithDetails(options: { category?: string; search?: string; product_id?: number }): Material[] {
    const { category, search, product_id } = options;
    
    let sql = `SELECT m.*, p.name as product_name, u.display_name as uploader_name 
      FROM materials m 
      LEFT JOIN products p ON m.product_id = p.id 
      LEFT JOIN users u ON m.uploaded_by = u.id 
      WHERE 1=1`;
    const params: any[] = [];
    
    if (category && category !== 'all') {
      sql += ' AND m.category = ?';
      params.push(category);
    }
    if (product_id) {
      sql += ' AND m.product_id = ?';
      params.push(product_id);
    }
    if (search) {
      sql += ' AND (m.original_name LIKE ? OR m.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' ORDER BY m.created_at DESC';
    
    return db.prepare(sql).all(...params) as Material[];
  }
  
  /**
   * 增加下载次数
   */
  incrementDownloadCount(id: number): void {
    db.prepare('UPDATE materials SET download_count = download_count + 1 WHERE id = ?').run(id);
  }
}

export const materialRepo = new MaterialRepository();

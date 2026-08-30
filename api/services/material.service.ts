/**
 * Material Service - 素材管理业务逻辑层
 * 
 * 职责：处理素材的上传、查询、更新、删除等业务逻辑
 */

import db from '../db.js';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import type { MaterialCategory } from '../../shared/types.js';

interface ListMaterialsOptions {
  category?: string;
  search?: string;
  product_id?: number;
}

interface UploadMaterialData {
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: MaterialCategory;
  tags?: string[];
  description?: string;
  product_id?: number;
  uploaded_by: number;
}

export function listMaterials(options: ListMaterialsOptions = {}) {
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
  
  return db.prepare(sql).all(...params) as any[];
}

export function getMaterialById(id: number) {
  const m = db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name 
    FROM materials m 
    LEFT JOIN products p ON m.product_id = p.id 
    LEFT JOIN users u ON m.uploaded_by = u.id 
    WHERE m.id = ?`).get(id) as any;
  
  return m || null;
}

export function uploadMaterial(data: UploadMaterialData & { fileBuffer?: Buffer }) {
  const { 
    filename, 
    original_name, 
    file_path, 
    file_size, 
    mime_type, 
    category, 
    tags = [], 
    description, 
    product_id, 
    uploaded_by 
  } = data;
  
  const validCats: MaterialCategory[] = ['sales', 'internal', 'product', 'planning', 'other'];
  if (!validCats.includes(category)) {
    throw new Error('无效的分类');
  }
  
  const result = db.prepare(`
    INSERT INTO materials (filename, original_name, file_path, file_size, mime_type, category, tags, description, product_id, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    filename, 
    original_name, 
    file_path, 
    file_size, 
    mime_type, 
    category, 
    JSON.stringify(tags), 
    description || null, 
    product_id || null, 
    uploaded_by
  );
  
  return db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name 
    FROM materials m 
    LEFT JOIN products p ON m.product_id = p.id 
    LEFT JOIN users u ON m.uploaded_by = u.id 
    WHERE m.id = ?`).get(result.lastInsertRowid) as any;
}

export function updateMaterial(id: number, data: Partial<{ category: MaterialCategory; description: string; tags: string[]; product_id: number }>) {
  if (!db.prepare('SELECT id FROM materials WHERE id = ?').get(id)) {
    throw new Error('资料不存在');
  }
  
  const updates: string[] = [];
  const params: any[] = [];
  
  if (data.category !== undefined) {
    updates.push('category = ?');
    params.push(data.category);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description);
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }
  if (data.product_id !== undefined) {
    updates.push('product_id = ?');
    params.push(data.product_id || null);
  }
  
  if (updates.length === 0) {
    return null;
  }
  
  updates.push("updated_at = datetime('now')");
  params.push(id);
  
  db.prepare(`UPDATE materials SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name 
    FROM materials m 
    LEFT JOIN products p ON m.product_id = p.id 
    LEFT JOIN users u ON m.uploaded_by = u.id 
    WHERE m.id = ?`).get(id) as any;
}

export function incrementDownloadCount(id: number) {
  const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!m) {
    throw new Error('资料不存在');
  }
  
  db.prepare('UPDATE materials SET download_count = download_count + 1 WHERE id = ?').run(id);
  
  return { download_count: m.download_count + 1 };
}

export function deleteMaterial(id: number, uploadsDir: string) {
  const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!m) {
    throw new Error('资料不存在');
  }
  
  // 删除文件
  try {
    fs.unlinkSync(m.file_path);
  } catch (e) {
    // 文件可能已被删除，忽略错误
  }
  
  // 删除记录
  db.prepare('DELETE FROM materials WHERE id = ?').run(id);
}

export function generateUniqueFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  return `${randomUUID()}${ext}`;
}

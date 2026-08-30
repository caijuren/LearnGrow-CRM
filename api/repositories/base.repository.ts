/**
 * Base Repository - 基础仓储层
 * 
 * 职责：提供通用的数据库访问方法，封装 better-sqlite3 的操作
 */

import db from '../db.js';

export interface QueryOptions {
  where?: Record<string, any>;
  orderBy?: string;
  limit?: number;
  offset?: number;
}

export class BaseRepository<T extends { id: number }> {
  protected tableName: string;
  
  constructor(tableName: string) {
    this.tableName = tableName;
  }
  
  /**
   * 根据ID查询单条记录
   */
  findById(id: number): T | null {
    const row = db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    return (row as T) || null;
  }
  
  /**
   * 查询所有记录
   */
  findAll(options: QueryOptions = {}): T[] {
    let sql = `SELECT * FROM ${this.tableName}`;
    const params: any[] = [];
    
    if (options.where) {
      const conditions = Object.keys(options.where).map(key => `${key} = ?`);
      sql += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(options.where));
    }
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    } else {
      sql += ' ORDER BY id DESC';
    }
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }
    
    return db.prepare(sql).all(...params) as T[];
  }
  
  /**
   * 查询单条记录（带条件）
   */
  findOne(where: Record<string, any>): T | null {
    const keys = Object.keys(where);
    const conditions = keys.map(key => `${key} = ?`).join(' AND ');
    const params = Object.values(where);
    
    const row = db.prepare(`SELECT * FROM ${this.tableName} WHERE ${conditions} LIMIT 1`).get(...params);
    return (row as T) || null;
  }
  
  /**
   * 插入新记录
   */
  insert(data: Partial<T>): number {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map(() => '?').join(', ');
    
    const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = db.prepare(sql).run(...values);
    
    return result.lastInsertRowid as number;
  }
  
  /**
   * 更新记录
   */
  update(id: number, data: Partial<T>): void {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map(key => `${key} = ?`).join(', ');
    
    const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    db.prepare(sql).run(...values, id);
  }
  
  /**
   * 删除记录
   */
  delete(id: number): void {
    db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
  }
  
  /**
   * 统计记录数
   */
  count(where?: Record<string, any>): number {
    let sql = `SELECT COUNT(*) as total FROM ${this.tableName}`;
    const params: any[] = [];
    
    if (where) {
      const conditions = Object.keys(where).map(key => `${key} = ?`);
      sql += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(where));
    }
    
    return (db.prepare(sql).get(...params) as any).total;
  }
  
  /**
   * 执行自定义查询
   */
  query(sql: string, params: any[] = []): T[] {
    return db.prepare(sql).all(...params) as T[];
  }
  
  /**
   * 执行自定义查询（单条结果）
   */
  queryOne(sql: string, params: any[] = []): T | null {
    const row = db.prepare(sql).get(...params);
    return (row as T) || null;
  }
}

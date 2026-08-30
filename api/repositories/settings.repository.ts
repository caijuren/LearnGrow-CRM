/**
 * Settings Repository - 系统设置数据访问层
 * 
 * 职责：封装系统设置的数据库访问逻辑
 */

import db from '../db.js';

export class SettingsRepository {
  private tableName = 'settings';
  
  /**
   * 获取设置值
   */
  get(key: string): string | null {
    const row = db.prepare(`SELECT value FROM ${this.tableName} WHERE key = ?`).get(key) as any;
    return row ? row.value : null;
  }
  
  /**
   * 设置值
   */
  set(key: string, value: string): void {
    db.prepare(
      `INSERT OR REPLACE INTO ${this.tableName} (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    ).run(key, value);
  }
  
  /**
   * 获取整数设置值
   */
  getInt(key: string, defaultValue: number = 0): number {
    const value = this.get(key);
    if (!value) return defaultValue;
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  /**
   * 批量获取设置
   */
  getMany(keys: string[]): Record<string, string | null> {
    const result: Record<string, string | null> = {};
    
    for (const key of keys) {
      result[key] = this.get(key);
    }
    
    return result;
  }
  
  /**
   * 批量设置
   */
  setMany(settings: Record<string, string>): void {
    const upsert = db.prepare(
      `INSERT OR REPLACE INTO ${this.tableName} (key, value, updated_at) VALUES (?, ?, datetime('now'))`
    );
    
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, value);
    }
  }
}

export const settingsRepo = new SettingsRepository();

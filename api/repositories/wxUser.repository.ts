/**
 * WxUser Repository - 微信用户数据访问层
 * 
 * 职责：封装微信用户的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { WxUser } from '../../shared/types.js';

export class WxUserRepository extends BaseRepository<WxUser> {
  constructor() {
    super('wx_users');
  }
  
  /**
   * 根据搜索条件查询用户（支持多字段模糊搜索）
   */
  search(searchTerm: string, options: { page?: number; limit?: number } = {}): { users: WxUser[]; total: number } {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const SEARCH_COLS = '(name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR child_name LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)';
    const SEARCH_PLACEHOLDERS = (SEARCH_COLS.match(/\?/g) || []).length;
    const params = Array(SEARCH_PLACEHOLDERS).fill(`%${searchTerm}%`);
    
    const countSql = `SELECT COUNT(*) as total FROM wx_users WHERE ${SEARCH_COLS}`;
    const total = (db.prepare(countSql).get(...params) as any).total;
    
    const sql = `SELECT * FROM wx_users WHERE ${SEARCH_COLS} ORDER BY id DESC LIMIT ? OFFSET ?`;
    const users = db.prepare(sql).all(...params, limit, offset) as WxUser[];
    
    return { users, total };
  }
  
  /**
   * 获取所有标签（去重）
   */
  getAllTags(): string[] {
    const all = db.prepare('SELECT tags FROM wx_users').all() as any[];
    const tagSet = new Set<string>();
    
    all.forEach(c => {
      try {
        const tags = JSON.parse(c.tags || '[]') as string[];
        tags.forEach((t: string) => tagSet.add(t));
      } catch {
        // 忽略解析错误
      }
    });
    
    return Array.from(tagSet).sort();
  }
  
  /**
   * 统计各重要性等级的用户数
   */
  countByImportance(): Record<string, number> {
    const grouped = db.prepare('SELECT importance AS k, COUNT(*) AS c FROM wx_users GROUP BY importance').all() as { k: string | null; c: number }[];
    const out: Record<string, number> = {};
    for (const g of grouped) {
      if (g.k) out[g.k] = g.c;
    }
    return out;
  }
  
  /**
   * 统计各阶段的用户数
   */
  countByStage(): Record<string, number> {
    const grouped = db.prepare('SELECT stage AS k, COUNT(*) AS c FROM wx_users GROUP BY stage').all() as { k: string | null; c: number }[];
    const out: Record<string, number> = {};
    for (const g of grouped) {
      if (g.k) out[g.k] = g.c;
    }
    return out;
  }
  
  /**
   * 统计需要跟进的用户数
   */
  countNeedFollow(): number {
    const today = new Date().toISOString().split('T')[0];
    const result = db.prepare(`
      SELECT COUNT(*) as c FROM wx_users 
      WHERE next_talk_topic IS NOT NULL AND next_talk_topic != '' 
      AND (last_follow_date IS NULL OR last_follow_date < ?)
    `).get(today) as any;
    
    return result.c || 0;
  }
}

export const wxUserRepo = new WxUserRepository();

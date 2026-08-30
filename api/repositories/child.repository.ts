/**
 * Child Repository - 孩子档案数据访问层
 * 
 * 职责：封装孩子档案的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { Child, ChildWithProgress } from '../../shared/types.js';

export class ChildRepository extends BaseRepository<Child> {
  constructor() {
    super('children');
  }
  
  /**
   * 获取用户的所有孩子
   */
  findByUser(wxUserId: number): Child[] {
    return db.prepare(
      'SELECT * FROM children WHERE wx_user_id = ? ORDER BY created_at DESC'
    ).all(wxUserId) as Child[];
  }
  
  /**
   * 获取孩子详情（包含学习进度、订单、跟进记录）
   */
  findByIdWithDetails(id: number): ChildWithProgress | null {
    const child = this.findById(id);
    if (!child) return null;
    
    // 获取学习进度
    const progressRaw = db.prepare(`
      SELECT cp.*, lp.name as path_name, ls.name as current_stage_name
      FROM child_learning_progress cp
      JOIN learning_paths lp ON cp.path_id = lp.id
      LEFT JOIN learning_stages ls ON cp.current_stage_id = ls.id
      WHERE cp.child_id = ?
      ORDER BY cp.updated_at DESC
    `).all(id) as any[];
    
    // 获取订单
    const ordersRaw = db.prepare(`
      SELECT o.*, p.name as product_name, p.tier as product_tier
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.child_id = ?
      ORDER BY o.purchase_date DESC
    `).all(id) as any[];
    
    // 获取跟进记录
    const followUpsRaw = db.prepare(`
      SELECT * FROM follow_ups WHERE child_id = ? ORDER BY date DESC
    `).all(id) as any[];
    
    return {
      ...child,
      learning_progress: progressRaw,
      orders: ordersRaw,
      follow_ups: followUpsRaw
    };
  }
}

export const childRepo = new ChildRepository();

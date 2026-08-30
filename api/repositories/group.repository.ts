/**
 * Group Repository - 微信群组数据访问层
 * 
 * 职责：封装群组和成员的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { WechatGroup, WechatGroupMember } from '../../shared/types.js';

export class WechatGroupRepository extends BaseRepository<WechatGroup> {
  constructor() {
    super('wechat_groups');
  }
  
  /**
   * 获取群组详情（包含成员列表）
   */
  findByIdWithMembers(id: number): WechatGroup | null {
    const group = this.findById(id);
    if (!group) return null;
    
    const members = db.prepare(
      'SELECT * FROM wechat_group_members WHERE group_id = ? ORDER BY activity_score DESC, created_at DESC'
    ).all(id) as WechatGroupMember[];
    
    return {
      ...group,
      active_members: members
    };
  }
  
  /**
   * 更新群组成员数量
   */
  updateMemberCount(groupId: number): void {
    const count = (db.prepare(
      'SELECT COUNT(*) as c FROM wechat_group_members WHERE group_id = ?'
    ).get(groupId) as any).c;
    
    db.prepare(
      "UPDATE wechat_groups SET member_count = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(count, groupId);
  }
}

export class WechatGroupMemberRepository extends BaseRepository<WechatGroupMember> {
  constructor() {
    super('wechat_group_members');
  }
  
  /**
   * 检查成员是否已存在
   */
  isMemberExists(groupId: number, wechatName: string): boolean {
    const result = db.prepare(
      'SELECT id FROM wechat_group_members WHERE group_id = ? AND wechat_name = ?'
    ).get(groupId, wechatName);
    
    return !!result;
  }
  
  /**
   * 批量导入成员
   */
  batchInsert(groupId: number, names: string[], role: string = 'new'): { added: number; skipped: number } {
    let added = 0;
    let skipped = 0;
    
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO wechat_group_members (group_id, wechat_name, role, tags, activity_score)
      VALUES (?, ?, ?, '[]', 50)
    `);
    
    const insertMany = db.transaction(() => {
      for (const name of names) {
        const trimmed = String(name).trim();
        if (!trimmed) {
          skipped++;
          continue;
        }
        
        if (this.isMemberExists(groupId, trimmed)) {
          skipped++;
          continue;
        }
        
        insertMember.run(groupId, trimmed, role);
        added++;
      }
    });
    
    insertMany();
    
    return { added, skipped };
  }
}

export const wechatGroupRepo = new WechatGroupRepository();
export const wechatGroupMemberRepo = new WechatGroupMemberRepository();

/**
 * Checkin Repository - 打卡数据访问层
 * 
 * 职责：封装打卡活动、参与者、记录的数据库访问逻辑
 */

import { BaseRepository } from './base.repository.js';
import db from '../db.js';
import type { CheckinEvent, CheckinParticipant, CheckinRecord } from '../../shared/types.js';

export class CheckinEventRepository extends BaseRepository<CheckinEvent> {
  constructor() {
    super('checkin_events');
  }
  
  /**
   * 获取活动统计信息
   */
  getEventStats(eventId: number): { participantCount: number; checkinCount: number; approvedCount: number } {
    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT p.id) as participantCount,
        COUNT(r.id) as checkinCount,
        SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) as approvedCount
      FROM checkin_participants p
      LEFT JOIN checkin_records r ON r.participant_id = p.id
      WHERE p.event_id = ?
    `).get(eventId) as any;
    
    return {
      participantCount: stats.participantCount || 0,
      checkinCount: stats.checkinCount || 0,
      approvedCount: stats.approvedCount || 0
    };
  }
  
  /**
   * 获取活动排行榜
   */
  getRanking(eventId: number, limit = 50): any[] {
    return db.prepare(`
      SELECT u.id, 
             COALESCE(NULLIF(u.name, ''), u.nickname, '') as display_name,
             u.child_name,
             u.avatar_url,
             COUNT(r.id) as checkin_count
      FROM wx_users u
      JOIN checkin_participants p ON p.wx_user_id = u.id
      JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
      WHERE p.event_id = ?
      GROUP BY u.id
      ORDER BY checkin_count DESC
      LIMIT ?
    `).all(eventId, limit) as any[];
  }
}

export class CheckinParticipantRepository extends BaseRepository<CheckinParticipant> {
  constructor() {
    super('checkin_participants');
  }
  
  /**
   * 检查用户是否已报名活动
   */
  isJoined(eventId: number, wxUserId: number): boolean {
    const result = db.prepare(
      'SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?'
    ).get(eventId, wxUserId);
    
    return !!result;
  }
  
  /**
   * 获取用户的参与记录
   */
  findByUser(wxUserId: number): CheckinParticipant[] {
    return db.prepare(
      'SELECT * FROM checkin_participants WHERE wx_user_id = ?'
    ).all(wxUserId) as CheckinParticipant[];
  }
}

export class CheckinRecordRepository extends BaseRepository<CheckinRecord> {
  constructor() {
    super('checkin_records');
  }
  
  /**
   * 获取待审核的记录
   */
  findPending(limit = 50): CheckinRecord[] {
    return db.prepare(
      "SELECT * FROM checkin_records WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?"
    ).all(limit) as CheckinRecord[];
  }
  
  /**
   * 获取用户的打卡记录
   */
  findByUser(wxUserId: number, options: { page?: number; limit?: number } = {}): { records: CheckinRecord[]; total: number } {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const total = db.prepare(`
      SELECT COUNT(*) as total FROM checkin_records r
      JOIN checkin_participants p ON r.participant_id = p.id
      WHERE p.wx_user_id = ?
    `).get(wxUserId) as any;
    
    const records = db.prepare(`
      SELECT r.*, p.event_id, e.name as event_name
      FROM checkin_records r
      JOIN checkin_participants p ON r.participant_id = p.id
      JOIN checkin_events e ON p.event_id = e.id
      WHERE p.wx_user_id = ?
      ORDER BY r.checkin_date DESC
      LIMIT ? OFFSET ?
    `).all(wxUserId, limit, offset) as CheckinRecord[];
    
    return { records, total: total.total };
  }
  
  /**
   * 计算连续打卡天数
   */
  calculateStreak(wxUserId: number): number {
    const records = db.prepare(`
      SELECT DISTINCT date(r.checkin_date) as checkin_date
      FROM checkin_records r
      JOIN checkin_participants p ON r.participant_id = p.id
      WHERE p.wx_user_id = ? AND r.status = 'approved'
      ORDER BY r.checkin_date DESC
    `).all(wxUserId) as { checkin_date: string }[];
    
    if (records.length === 0) return 0;
    
    let streak = 1;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // 如果最近一次打卡不是今天或昨天，则连续天数为0
    if (records[0].checkin_date !== today && records[0].checkin_date !== yesterday) {
      return 0;
    }
    
    for (let i = 1; i < records.length; i++) {
      const prevDate = new Date(records[i - 1].checkin_date);
      const currDate = new Date(records[i].checkin_date);
      const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  }
}

export const checkinEventRepo = new CheckinEventRepository();
export const checkinParticipantRepo = new CheckinParticipantRepository();
export const checkinRecordRepo = new CheckinRecordRepository();

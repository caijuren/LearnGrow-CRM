/**
 * Dashboard Service - 驾驶舱业务逻辑层
 * 
 * 职责：处理Dashboard统计数据的查询和计算，包括KPI指标、趋势数据、排行榜等
 */

import db from '../db.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { DashboardData, CustomerStage } from '../../shared/types.js';
import { cache, DASHBOARD_CACHE_TTL, DASHBOARD_CACHE_KEY } from '../cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function bjtToday(): string {
  const now = new Date();
  // Beijing time is UTC+8
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjt = new Date(utc + 8 * 3600000);
  return bjt.toISOString().split('T')[0];
}

function bjtDaysAgo(days: number): string {
  const today = bjtToday();
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function needFollowClause(): { sql: string; params: any[] } {
  const today = bjtToday();
  return {
    sql: `(next_talk_topic IS NOT NULL AND next_talk_topic != '' AND (last_follow_date IS NULL OR last_follow_date < ?))`,
    params: [today]
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  // 尝试从缓存获取
  const cached = cache.get<DashboardData>(DASHBOARD_CACHE_KEY);
  if (cached) {
    return cached;
  }

  const today = bjtToday();
  const yesterday = bjtDaysAgo(1);
  const sevenDaysAgo = bjtDaysAgo(7);
  const thirtyDaysAgo = bjtDaysAgo(30);

  // 核心指标
  const totalWxUsers = (db.prepare('SELECT COUNT(*) as c FROM wx_users').get() as any).c;
  const todayNewWxUsers = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(today) as any).c;
  const yesterdayNewWxUsers = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(yesterday) as any).c;
  
  // 打卡统计
  const totalCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved'").get() as any).c;
  const todayCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND date(checkin_date) = ?").get(today) as any).c;
  const weekCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND checkin_date >= ?").get(sevenDaysAgo) as any).c;
  
  // 活跃用户数（近 7 天有打卡的去重用户）
  const activeUsers7d = (db.prepare(`
    SELECT COUNT(DISTINCT p.wx_user_id) as c 
    FROM checkin_participants p
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    WHERE r.checkin_date >= ?
  `).get(sevenDaysAgo) as any).c;
  
  // 打卡率 = 今日打卡人数 / 已报名活动用户数
  const todayCheckers = (db.prepare(`
    SELECT COUNT(DISTINCT p.wx_user_id) as c
    FROM checkin_participants p
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    WHERE date(r.checkin_date) = ?
  `).get(today) as any).c;
  const totalParticipants = (db.prepare("SELECT COUNT(DISTINCT wx_user_id) as c FROM checkin_participants").get() as any).c;
  const checkinRate = totalParticipants > 0 ? Math.round((todayCheckers / totalParticipants) * 100 * 100) / 100 : 0;

  // 近 30 天趋势数据
  const newUserTrend = [];
  const checkinTrend = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = bjtDaysAgo(i);
    const newCount = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(dateStr) as any).c;
    const checkinCount = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND date(checkin_date) = ?").get(dateStr) as any).c;
    newUserTrend.push({ date: dateStr.slice(5), count: newCount || 0 });
    checkinTrend.push({ date: dateStr.slice(5), count: checkinCount || 0 });
  }

  // 用户阶段分布
  const stageStatsRaw = db.prepare("SELECT stage, COUNT(*) as count FROM wx_users GROUP BY stage").all() as any[];
  const allStages: CustomerStage[] = ['new_friend', 'initial_chat', 'interested', 'purchased', 'in_group', 'repurchased', 'silent'];
  const stageStats = allStages.map(s => {
    const found = stageStatsRaw.find(r => r.stage === s);
    return { stage: s, count: found ? found.count : 0 };
  });

  // 需跟进用户
  const needFollowWhere = needFollowClause();
  const needFollowRaw = db.prepare(`
    SELECT id, COALESCE(NULLIF(name, ''), nickname, child_name, '') as name, stage, wechat_id, wechat_account, importance, last_follow_date, next_talk_topic
    FROM wx_users
    WHERE ${needFollowWhere.sql}
    ORDER BY CASE importance WHEN 'vip' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             last_follow_date IS NULL DESC,
             last_follow_date ASC
    LIMIT 5
  `).all(...needFollowWhere.params) as any[];

  // 热门打卡活动排行
  const popularActivities = db.prepare(`
    SELECT a.name, 
           COUNT(DISTINCT p.wx_user_id) as participant_count,
           COUNT(r.id) as checkin_count,
           ROUND(CAST(COUNT(r.id) AS FLOAT) / MAX(COUNT(DISTINCT p.wx_user_id), 1), 1) as avg_checkins_per_user
    FROM checkin_events a
    JOIN checkin_participants p ON p.event_id = a.id
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    GROUP BY a.id
    ORDER BY checkin_count DESC
    LIMIT 10
  `).all() as any[];

  // 最新加入的用户
  const recentUsersRaw = db.prepare(`
    SELECT COALESCE(NULLIF(name, ''), nickname, child_name, '') as display_name,
           created_at, source, avatar_url
    FROM wx_users
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as any[];
  
  const recentUsers = recentUsersRaw.map((u: any) => {
    let validAvatarUrl = null;
    if (u.avatar_url) {
      const fileName = u.avatar_url.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        validAvatarUrl = u.avatar_url.replace(/^\/uploads\//, '/api/uploads/');
      }
    }
    return {
      ...u,
      avatar_url: validAvatarUrl,
    };
  });

  // 今日最新打卡记录
  const recentCheckins = db.prepare(`
    SELECT COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') as user_name,
           a.name as activity_name,
           r.checkin_date,
           r.status
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    JOIN wx_users u ON p.wx_user_id = u.id
    JOIN checkin_events a ON p.event_id = a.id
    WHERE date(r.checkin_date) = ?
    ORDER BY r.checkin_date DESC
    LIMIT 10
  `).all(today) as any[];

  // 用户来源渠道分析
  const sourceChannels = db.prepare(`
    SELECT source as channel, COUNT(*) as count
    FROM wx_users
    WHERE source IS NOT NULL AND source != ''
    GROUP BY source
    ORDER BY count DESC
  `).all() as any[];

  // 打卡达人榜
  const topCheckinUsersRaw = db.prepare(`
    SELECT u.id, 
           COALESCE(NULLIF(u.name, ''), u.nickname, '') as display_name,
           u.child_name,
           u.avatar_url,
           COUNT(r.id) as checkin_count
    FROM wx_users u
    JOIN checkin_participants p ON p.wx_user_id = u.id
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    GROUP BY u.id
    ORDER BY checkin_count DESC
    LIMIT 10
  `).all() as any[];
  
  const topCheckinUsers = topCheckinUsersRaw.map((u: any) => {
    // 检查头像文件是否真实存在
    let validAvatarUrl = null;
    if (u.avatar_url) {
      const fileName = u.avatar_url.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        validAvatarUrl = u.avatar_url.replace(/^\/uploads\//, '/api/uploads/');
      }
    }
    return {
      ...u,
      avatar_url: validAvatarUrl,
    };
  });

  const dashboardData = {
    stats: {
      total_wx_users: totalWxUsers,
      today_new_wx_users: todayNewWxUsers,
      yesterday_new_wx_users: yesterdayNewWxUsers,
      total_checkins: totalCheckins,
      today_checkins: todayCheckins,
      week_checkins: weekCheckins,
      active_users_7d: activeUsers7d,
      checkin_rate: checkinRate,
      total_participants: totalParticipants,
    },
    stageStats,
    needFollowUsers: needFollowRaw.map(c => ({
      ...c,
      stage: c.stage || 'new_friend',
      wechat_account: c.wechat_account || 'main',
    })),
    newUserTrend,
    checkinTrend,
    popularActivities,
    recentUsers,
    recentCheckins,
    sourceChannels,
    topCheckinUsers,
  };

  // 存入缓存
  cache.set(DASHBOARD_CACHE_KEY, dashboardData, { ttlMs: DASHBOARD_CACHE_TTL });

  return dashboardData;
}

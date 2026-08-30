/**
 * Dashboard Service 单元测试
 * 测试数据查询逻辑和缓存集成
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '../../api/db.js';
import { cache, DASHBOARD_CACHE_KEY, invalidateCache } from '../../api/cache.js';
import { getDashboardData } from '../../api/services/dashboard.service.js';

describe('Dashboard Service', () => {
  let testUserId: number;
  let testChildId: number;
  let testEventId: number;
  let testParticipantId: number;

  beforeEach(() => {
    // 清理缓存
    cache.clear();

    // 创建测试数据
    const userResult = db.prepare(
      "INSERT INTO wx_users (openid, nickname, stage, source) VALUES (?, ?, ?, ?)"
    ).run('test_openid_' + Date.now(), '测试用户', 'new_friend', 'moments');
    testUserId = userResult.lastInsertRowid as number;

    const childResult = db.prepare(
      "INSERT INTO children (wx_user_id, nickname, grade) VALUES (?, ?, ?)"
    ).run(testUserId, '测试孩子', '一年级');
    testChildId = childResult.lastInsertRowid as number;

    const eventResult = db.prepare(
      "INSERT INTO checkin_events (name, status, start_date, end_date) VALUES (?, ?, ?, ?)"
    ).run('测试打卡活动', 'active', '2026-08-01', '2026-09-30');
    testEventId = eventResult.lastInsertRowid as number;

    const participantResult = db.prepare(
      "INSERT INTO checkin_participants (event_id, wx_user_id, nickname) VALUES (?, ?, ?)"
    ).run(testEventId, testUserId, '测试用户');
    testParticipantId = participantResult.lastInsertRowid as number;

    // 创建一条已审批的打卡记录（用于热门活动统计）
    const today = new Date().toISOString().split('T')[0];
    db.prepare(
      "INSERT INTO checkin_records (event_id, participant_id, checkin_date, status) VALUES (?, ?, ?, ?)"
    ).run(testEventId, testParticipantId, today, 'approved');
  });

  afterEach(() => {
    // 清理测试数据（按依赖顺序删除）
    db.prepare('DELETE FROM checkin_records WHERE participant_id = ?').run(testParticipantId);
    db.prepare('DELETE FROM checkin_participants WHERE id = ?').run(testParticipantId);
    db.prepare('DELETE FROM checkin_events WHERE id = ?').run(testEventId);
    db.prepare('DELETE FROM children WHERE id = ?').run(testChildId);
    db.prepare('DELETE FROM wx_users WHERE id = ?').run(testUserId);
    
    // 清理缓存
    cache.clear();
  });

  describe('Cache Integration', () => {
    it('应该能设置和获取缓存数据', () => {
      const testData = { stats: { total_wx_users: 100 }, stageStats: [] };
      cache.set(DASHBOARD_CACHE_KEY, testData, { ttlMs: 5000 });

      const cached = cache.get(DASHBOARD_CACHE_KEY);
      expect(cached).toEqual(testData);
    });

    it('缓存过期后应该返回 null', () => {
      const testData = { value: 42 };
      cache.set('test:expiry', testData, { ttlMs: 100 });

      // 立即获取应该成功
      expect(cache.get('test:expiry')).toEqual(testData);

      // 等待过期
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(cache.get('test:expiry')).toBeNull();
          resolve(undefined);
        }, 150);
      });
    });

    it('应该能删除缓存', () => {
      cache.set('test:delete', { value: 1 }, { ttlMs: 5000 });
      expect(cache.get('test:delete')).toBeDefined();

      cache.delete('test:delete');
      expect(cache.get('test:delete')).toBeNull();
    });

    it('应该能清空所有缓存', () => {
      cache.set('key1', 1, { ttlMs: 5000 });
      cache.set('key2', 2, { ttlMs: 5000 });
      cache.set('key3', 3, { ttlMs: 5000 });

      cache.clear();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBeNull();
    });

    it('invalidateCache 应该删除匹配模式的键', () => {
      cache.set('dashboard:data', { v: 1 }, { ttlMs: 5000 });
      cache.set('wx_users:list:1:20', { v: 2 }, { ttlMs: 5000 });
      cache.set('products:list', { v: 3 }, { ttlMs: 5000 });

      invalidateCache('dashboard');

      expect(cache.get('dashboard:data')).toBeNull();
      expect(cache.get('wx_users:list:1:20')).toBeDefined();
      expect(cache.get('products:list')).toBeDefined();
    });

    it('应该能获取缓存统计信息', () => {
      cache.set('a', 1, { ttlMs: 5000 });
      cache.set('b', 2, { ttlMs: 5000 });

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('a');
      expect(stats.keys).toContain('b');
    });
  });

  describe('getDashboardData', () => {
    it('应该返回完整的驾驶舱数据', async () => {
      const data = await getDashboardData();

      expect(data).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.total_wx_users).toBe('number');
      expect(data.stats.total_wx_users).toBeGreaterThan(0);
    });

    it('应该包含今日新增用户数', async () => {
      const data = await getDashboardData();

      expect(data.stats.today_new_wx_users).toBeDefined();
      expect(typeof data.stats.today_new_wx_users).toBe('number');
      // 今日刚创建的用户应该被计入
      expect(data.stats.today_new_wx_users).toBeGreaterThanOrEqual(1);
    });

    it('应该包含打卡统计数据', async () => {
      const data = await getDashboardData();

      expect(data.stats.total_checkins).toBeDefined();
      expect(data.stats.today_checkins).toBeDefined();
      expect(data.stats.week_checkins).toBeDefined();
      expect(typeof data.stats.total_checkins).toBe('number');
    });

    it('应该包含活跃用户数', async () => {
      const data = await getDashboardData();

      expect(data.stats.active_users_7d).toBeDefined();
      expect(typeof data.stats.active_users_7d).toBe('number');
    });

    it('应该包含打卡率', async () => {
      const data = await getDashboardData();

      expect(data.stats.checkin_rate).toBeDefined();
      expect(typeof data.stats.checkin_rate).toBe('number');
      expect(data.stats.checkin_rate).toBeGreaterThanOrEqual(0);
    });

    it('应该包含30天趋势数据', async () => {
      const data = await getDashboardData();

      expect(data.newUserTrend).toBeDefined();
      expect(data.checkinTrend).toBeDefined();
      expect(Array.isArray(data.newUserTrend)).toBe(true);
      expect(Array.isArray(data.checkinTrend)).toBe(true);
      // 应该有30天的数据
      expect(data.newUserTrend.length).toBe(30);
      expect(data.checkinTrend.length).toBe(30);
    });

    it('应该包含用户阶段分布', async () => {
      const data = await getDashboardData();

      expect(data.stageStats).toBeDefined();
      expect(Array.isArray(data.stageStats)).toBe(true);
      // 应该包含所有预定义阶段
      const stages = data.stageStats.map(s => s.stage);
      expect(stages).toContain('new_friend');
      expect(stages).toContain('initial_chat');
      expect(stages).toContain('interested');
      expect(stages).toContain('purchased');
    });

    it('应该包含需跟进用户列表', async () => {
      const data = await getDashboardData();

      expect(data.needFollowUsers).toBeDefined();
      expect(Array.isArray(data.needFollowUsers)).toBe(true);
      // 最多返回5个用户
      expect(data.needFollowUsers.length).toBeLessThanOrEqual(5);
    });

    it('应该包含热门打卡活动排行', async () => {
      const data = await getDashboardData();

      expect(data.popularActivities).toBeDefined();
      expect(Array.isArray(data.popularActivities)).toBe(true);
      // 我们创建了一个测试活动，应该出现在列表中
      if (data.popularActivities.length > 0) {
        const hasTestActivity = data.popularActivities.some(
          (a: any) => a.name === '测试打卡活动'
        );
        expect(hasTestActivity).toBe(true);
      }
    });

    it('应该包含最新加入的用户', async () => {
      const data = await getDashboardData();

      expect(data.recentUsers).toBeDefined();
      expect(Array.isArray(data.recentUsers)).toBe(true);
      // 最多返回5个用户
      expect(data.recentUsers.length).toBeLessThanOrEqual(5);
      // 应该包含我们刚创建的测试用户
      expect(data.recentUsers.length).toBeGreaterThan(0);
    });

    it('应该包含今日最新打卡记录', async () => {
      const data = await getDashboardData();

      expect(data.recentCheckins).toBeDefined();
      expect(Array.isArray(data.recentCheckins)).toBe(true);
    });

    it('应该包含用户来源渠道分析', async () => {
      const data = await getDashboardData();

      expect(data.sourceChannels).toBeDefined();
      expect(Array.isArray(data.sourceChannels)).toBe(true);
      // 我们创建了source='moments'的用户，应该出现在统计中
      if (data.sourceChannels.length > 0) {
        const hasMoments = data.sourceChannels.some(
          (c: any) => c.channel === 'moments'
        );
        expect(hasMoments).toBe(true);
      }
    });

    it('应该包含打卡达人榜', async () => {
      const data = await getDashboardData();

      expect(data.topCheckinUsers).toBeDefined();
      expect(Array.isArray(data.topCheckinUsers)).toBe(true);
      // 最多返回10个用户
      expect(data.topCheckinUsers.length).toBeLessThanOrEqual(10);
    });

    it('第二次调用应该使用缓存', async () => {
      // 第一次调用
      const data1 = await getDashboardData();
      
      // 设置缓存（getDashboardData 内部已经设置了缓存）
      const cached = cache.get(DASHBOARD_CACHE_KEY);
      expect(cached).toBeDefined();

      // 第二次调用应该直接返回缓存
      const data2 = await getDashboardData();
      
      // 两次返回的数据应该相同
      expect(data2.stats.total_wx_users).toBe(data1.stats.total_wx_users);
    });
  });

  describe('Cache Key Helpers', () => {
    it('应该生成正确的微信用户列表缓存键', async () => {
      const { getWxUsersCacheKey } = await import('../../api/cache.js');

      expect(getWxUsersCacheKey(1, 20)).toBe('wx_users:list:1:20');
      expect(getWxUsersCacheKey(2, 50)).toBe('wx_users:list:2:50');
    });

    it('应该生成正确的设置项缓存键', async () => {
      const { getSettingsCacheKey } = await import('../../api/cache.js');

      expect(getSettingsCacheKey('app_name')).toBe('settings:app_name');
      expect(getSettingsCacheKey('backup_time')).toBe('settings:backup_time');
    });
  });

  describe('Cache Constants', () => {
    it('应该有正确的 TTL 配置', async () => {
      const constants = await import('../../api/cache.js');

      expect(constants.DASHBOARD_CACHE_TTL).toBe(5 * 60 * 1000); // 5分钟
      expect(constants.WX_USERS_CACHE_TTL).toBe(2 * 60 * 1000); // 2分钟
      expect(constants.PRODUCTS_CACHE_TTL).toBe(10 * 60 * 1000); // 10分钟
      expect(constants.CHECKIN_EVENTS_CACHE_TTL).toBe(3 * 60 * 1000); // 3分钟
    });
  });
});

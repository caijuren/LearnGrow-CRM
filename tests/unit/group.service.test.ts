/**
 * Group Service 单元测试
 * 测试微信群管理的业务逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '../../api/db.js';
import { listGroups, getGroupById, createGroup } from '../../api/services/group.service.js';

describe('Group Service', () => {
  let testGroupId: number;

  beforeEach(() => {
    // 创建测试群
    const result = db.prepare(
      "INSERT INTO wechat_groups (name, purpose, status) VALUES (?, ?, ?)"
    ).run('测试群', '打卡活动群', 'active');
    testGroupId = result.lastInsertRowid as number;
  });

  afterEach(() => {
    // 清理测试数据（先删除成员）
    db.prepare('DELETE FROM wechat_group_members WHERE group_id = ?').run(testGroupId);
    db.prepare('DELETE FROM wechat_groups WHERE id = ?').run(testGroupId);
  });

  describe('listGroups', () => {
    it('应该返回所有群列表', () => {
      const result = listGroups();

      // listGroups 返回 { groups, total } 对象
      expect(result).toHaveProperty('groups');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.groups)).toBe(true);
      expect(result.groups.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.groups.length);
    });

    it('应该能按状态过滤', () => {
      const result = listGroups({ status: 'active' });

      if (Array.isArray(result.groups)) {
        expect(result.groups.every((g: any) => g.status === 'active')).toBe(true);
      }
    });
  });

  describe('getGroupById', () => {
    it('应该能根据 ID 获取群信息', () => {
      const group = getGroupById(testGroupId);

      expect(group).not.toBeNull();
      expect(group?.name).toBe('测试群');
      expect(group?.purpose).toBe('打卡活动群');
    });

    it('不存在的 ID 应该返回 null', () => {
      const group = getGroupById(99999);
      expect(group).toBeNull();
    });
  });

  describe('createGroup', () => {
    it('应该能创建新群', () => {
      const newGroup = createGroup({
        name: '新群',
        purpose: '学习交流群',
        status: 'building',
      });

      expect(newGroup).toBeDefined();
      expect(newGroup.name).toBe('新群');

      // 验证数据库中已存在
      const saved = getGroupById(newGroup.id);
      expect(saved).not.toBeNull();
      expect(saved?.status).toBe('building');
    });

    it('缺少群名时应该抛出错误', () => {
      expect(() => {
        createGroup({
          name: '',
          purpose: 'test',
        });
      }).toThrow();
    });
  });
});

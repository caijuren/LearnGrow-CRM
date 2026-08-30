/**
 * Child Service 单元测试
 * 测试孩子档案管理的业务逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '../../api/db.js';
import { listChildren, getChildById, createChild, updateChild, deleteChild } from '../../api/services/child.service.js';

describe('Child Service', () => {
  let testWxUserId: number;
  let testChildId: number;

  beforeEach(() => {
    // 创建测试微信用户
    const wxUserResult = db.prepare(
      "INSERT INTO wx_users (openid, nickname) VALUES (?, ?)"
    ).run(`test_child_${Date.now()}`, '测试家长');
    testWxUserId = wxUserResult.lastInsertRowid as number;

    // 创建测试孩子
    const childResult = db.prepare(
      "INSERT INTO children (wx_user_id, nickname, gender, grade) VALUES (?, ?, ?, ?)"
    ).run(testWxUserId, '测试孩子', 'boy', '三年级');
    testChildId = childResult.lastInsertRowid as number;
  });

  afterEach(() => {
    // 清理测试数据（先删除子记录）
    db.prepare('DELETE FROM child_learning_progress WHERE child_id = ?').run(testChildId);
    db.prepare('DELETE FROM children WHERE id = ?').run(testChildId);
    db.prepare('DELETE FROM wx_users WHERE id = ?').run(testWxUserId);
  });

  describe('listChildren', () => {
    it('应该返回指定用户的的孩子列表', () => {
      const children = listChildren({ wx_user_id: testWxUserId });

      expect(children).toBeInstanceOf(Array);
      expect(children.length).toBeGreaterThan(0);
      expect(children[0].nickname).toBe('测试孩子');
    });

    it('没有 wx_user_id 时应该返回空数组', () => {
      const children = listChildren({});
      expect(children).toEqual([]);
    });

    it('不存在的用户应该返回空数组', () => {
      const children = listChildren({ wx_user_id: 99999 });
      expect(children).toEqual([]);
    });
  });

  describe('getChildById', () => {
    it('应该能根据 ID 获取孩子信息', () => {
      const child = getChildById(testChildId);

      expect(child).not.toBeNull();
      expect(child?.nickname).toBe('测试孩子');
      expect(child?.gender).toBe('boy');
      expect(child?.grade).toBe('三年级');
    });

    it('不存在的 ID 应该返回 null', () => {
      const child = getChildById(99999);
      expect(child).toBeNull();
    });
  });

  describe('createChild', () => {
    it('应该能创建新的孩子档案', () => {
      const newChild = createChild({
        wx_user_id: testWxUserId,
        nickname: '新孩子',
        gender: 'girl',
        grade: '一年级',
        region: '北京',
        textbook_version: '人教版',
      });

      expect(newChild).toBeDefined();
      expect(newChild.nickname).toBe('新孩子');
      expect(newChild.gender).toBe('girl');

      // 验证数据库中已存在
      const saved = getChildById(newChild.id);
      expect(saved).not.toBeNull();
      expect(saved?.region).toBe('北京');
    });

    it('缺少必填字段时应该抛出错误', () => {
      expect(() => {
        createChild({
          wx_user_id: testWxUserId,
          nickname: '', // 空昵称
          grade: '一年级',
        });
      }).toThrow();
    });
  });

  describe('updateChild', () => {
    it('应该能更新孩子信息', () => {
      const updated = updateChild(testChildId, {
        nickname: '更新后的名字',
        grade: '四年级',
        notes: '这是备注',
      });

      expect(updated).toBeDefined();
      expect(updated.nickname).toBe('更新后的名字');
      expect(updated.grade).toBe('四年级');

      // 验证数据库中的更改
      const saved = getChildById(testChildId);
      expect(saved?.notes).toBe('这是备注');
    });

    it('更新不存在的记录应该抛出错误', () => {
      expect(() => {
        updateChild(99999, { nickname: 'test' });
      }).toThrow();
    });
  });

  describe('deleteChild', () => {
    it('应该能删除孩子档案', () => {
      // deleteChild 没有返回值，直接执行删除
      deleteChild(testChildId);

      // 验证已删除
      const child = getChildById(testChildId);
      expect(child).toBeNull();
    });

    it('删除不存在的记录应该抛出错误', () => {
      expect(() => {
        deleteChild(99999);
      }).toThrow('孩子不存在');
    });
  });
});

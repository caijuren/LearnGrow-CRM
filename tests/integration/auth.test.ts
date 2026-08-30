/**
 * 认证接口集成测试
 * 测试登录、JWT验证、权限控制等核心功能
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import db from '../../api/db.js';

describe('Authentication API', () => {
  let testUserId: number;

  beforeAll(() => {
    // 创建测试用户
    const hashedPassword = bcrypt.hashSync('test123456', 10);
    const result = db.prepare(
      "INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)"
    ).run('testuser', hashedPassword, 'admin', '测试用户');
    testUserId = result.lastInsertRowid as number;
  });

  afterAll(() => {
    // 清理测试数据
    db.prepare('DELETE FROM users WHERE username = ?').run('testuser');
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回token', async () => {
      const response = await fetch('http://localhost:3456/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'test123456'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.token).toBeDefined();
      expect(data.data.user.username).toBe('testuser');
      expect(data.data.user.role).toBe('admin');
    });

    it('用户名或密码错误应返回401', async () => {
      const response = await fetch('http://localhost:3456/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword'
        })
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('错误');
    });

    it('空用户名或密码应返回400', async () => {
      const response = await fetch('http://localhost:3456/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '',
          password: ''
        })
      });

      expect(response.status).toBe(400);
    });

    it('不存在的用户应返回401', async () => {
      const response = await fetch('http://localhost:3456/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'test123456'
        })
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeAll(async () => {
      const loginResponse = await fetch('http://localhost:3456/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          password: 'test123456'
        })
      });
      const loginData = await loginResponse.json();
      authToken = loginData.data.token;
    });

    it('携带有效token应返回用户信息', async () => {
      const response = await fetch('http://localhost:3456/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.username).toBe('testuser');
      expect(data.data.role).toBe('admin');
    });

    it('无效token应返回401', async () => {
      const response = await fetch('http://localhost:3456/api/auth/me', {
        headers: {
          'Authorization': 'Bearer invalid_token'
        }
      });

      expect(response.status).toBe(401);
    });

    it('缺少token应返回401', async () => {
      const response = await fetch('http://localhost:3456/api/auth/me');

      expect(response.status).toBe(401);
    });
  });
});

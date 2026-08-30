/**
 * 认证服务 - v2.9.0 架构重构
 *
 * 提供用户认证、JWT生成/验证等业务逻辑
 */

import bcrypt from 'bcryptjs';
import db from '../db.js';

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    username: string;
    role: string;
    display_name: string;
  };
  error?: string;
}

/**
 * 用户登录验证
 * @param username 用户名
 * @param password 密码（明文）
 * @returns 登录结果，包含token和用户信息
 */
export async function loginUser(username: string, password: string): Promise<LoginResult> {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

  if (!user) {
    return {
      success: false,
      error: '用户名或密码错误'
    };
  }

  if (!bcrypt.compareSync(password, user.password)) {
    return {
      success: false,
      error: '用户名或密码错误'
    };
  }

  // 注意：JWT生成需要在Fastify实例中调用，这里返回用户信息供路由层生成token
  return {
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      display_name: user.display_name
    }
  };
}

/**
 * 获取用户详情
 * @param userId 用户ID
 * @returns 用户信息（不含密码）
 */
export function getUserById(userId: number) {
  return db.prepare(
    'SELECT id, username, role, display_name, created_at FROM users WHERE id = ?'
  ).get(userId) as any;
}

/**
 * 创建新用户
 * @param userData 用户数据
 * @returns 新用户ID
 */
export function createUser(userData: {
  username: string;
  password: string;
  role?: string;
  display_name?: string;
}): number {
  const hashedPassword = bcrypt.hashSync(userData.password, 10);
  const role = userData.role || 'operator';
  const displayName = userData.display_name || '';

  const result = db.prepare(`
    INSERT INTO users (username, password, role, display_name)
    VALUES (?, ?, ?, ?)
  `).run(userData.username, hashedPassword, role, displayName);

  return result.lastInsertRowid as number;
}

/**
 * 更新用户信息
 * @param userId 用户ID
 * @param updateData 要更新的字段
 */
export function updateUser(userId: number, updateData: {
  password?: string;
  role?: string;
  display_name?: string;
}): void {
  const fields: string[] = [];
  const params: any[] = [];

  if (updateData.password) {
    fields.push('password = ?');
    params.push(bcrypt.hashSync(updateData.password, 10));
  }
  if (updateData.role !== undefined) {
    fields.push('role = ?');
    params.push(updateData.role);
  }
  if (updateData.display_name !== undefined) {
    fields.push('display_name = ?');
    params.push(updateData.display_name);
  }

  if (fields.length > 0) {
    params.push(userId);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  }
}

/**
 * 删除用户
 * @param userId 用户ID
 */
export function deleteUser(userId: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/**
 * 列出所有用户
 * @returns 用户列表（不含密码）
 */
export function listUsers() {
  return db.prepare(
    'SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at DESC'
  ).all() as any[];
}

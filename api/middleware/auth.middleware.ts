/**
 * 认证中间件 - v2.9.0 架构重构
 *
 * 提供JWT验证、权限检查、登录限流等功能
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import db from '../db.js';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
}

// 登录限流配置
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15分钟
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * 检查登录限流
 * 防止暴力破解密码
 */
export function allowAdminLogin(request: FastifyRequest, reply: FastifyReply): boolean {
  const ip = request.ip;
  const now = Date.now();
  const current = adminLoginAttempts.get(ip);

  if (!current || current.resetAt <= now) {
    adminLoginAttempts.set(ip, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    return true;
  }

  if (current.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    reply.code(429).send({
      success: false,
      error: '登录尝试次数过多，请15分钟后再试'
    });
    return false;
  }

  current.count += 1;
  return true;
}

/**
 * JWT认证中间件（管理端）
 * 验证请求中的Bearer token，要求type=admin
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (_err) {
    return reply.code(401).send({
      success: false,
      error: '登录已过期，请重新登录'
    });
  }
  const payload = request.user as any;
  if (!payload || payload.type !== 'admin') {
    return reply.code(401).send({
      success: false,
      error: '登录已过期，请重新登录'
    });
  }
}

/**
 * 管理员权限检查
 * 仅允许admin角色访问
 */
export async function adminOnly(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);

  const user = request.user as AuthUser;
  if (user.role !== 'admin') {
    return reply.code(403).send({
      success: false,
      error: '权限不足，需要管理员权限'
    });
  }
}

/**
 * 运营人员及以上权限检查
 * 允许admin和operator访问
 */
export async function operatorOrAbove(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);

  const user = request.user as AuthUser;
  if (!['admin', 'operator'].includes(user.role)) {
    return reply.code(403).send({
      success: false,
      error: '权限不足，需要运营人员及以上权限'
    });
  }
}

/**
 * 微信小程序认证中间件
 *
 * 通过 @fastify/jwt 校验 Bearer Token（JWT payload: { wxUserId, type: 'wx' }），
 * 从数据库查询用户对象后挂载到 request.wxUser，并兼容写入 request.wxOpenid = user.openid。
 *
 * 旧实现错误地读取 x-wx-openid 请求头——客户端根本不会发送该头，会导致所有受保护接口 401。
 */
export async function wxAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (_err) {
    return reply.code(401).send({
      success: false,
      error: '请先登录'
    });
  }

  const payload = request.user as { type?: string; wxUserId?: number } | undefined;
  if (!payload || payload.type === 'admin') {
    return reply.code(401).send({
      success: false,
      error: '登录已过期，请重新登录'
    });
  }

  if (payload.wxUserId == null) {
    return reply.code(401).send({
      success: false,
      error: '登录已过期，请重新登录'
    });
  }

  const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(payload.wxUserId) as any;
  if (!user) {
    return reply.code(401).send({
      success: false,
      error: '用户不存在'
    });
  }

  (request as any).wxUser = user;
  (request as any).wxOpenid = user.openid; // 兼容旧路由对 wxOpenid 的读取
}

/**
 * 微信小程序可选认证中间件
 * 有合法 JWT 则验证并挂载用户信息，无 JWT 或 JWT 无效则静默放行（匿名浏览）。
 */
export async function wxOptionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (_err) {
    return;
  }

  const payload = request.user as { type?: string; wxUserId?: number } | undefined;
  if (!payload || payload.type === 'admin') return;
  if (payload.wxUserId == null) return;

  const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(payload.wxUserId) as any;
  if (user) {
    (request as any).wxUser = user;
    (request as any).wxOpenid = user.openid;
  }
}

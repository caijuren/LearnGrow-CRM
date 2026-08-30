/**
 * 认证中间件 - v2.9.0 架构重构
 *
 * 提供JWT验证、权限检查、登录限流等功能
 */

import { FastifyRequest, FastifyReply } from 'fastify';

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
 * JWT认证中间件
 * 验证请求中的Bearer token
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
 * 验证小程序用户的openid
 */
export function wxAuthMiddleware(
  request: any,
  reply: any
) {
  const openid = request.headers['x-wx-openid'];
  if (!openid) {
    return reply.code(401).send({
      success: false,
      error: '缺少微信认证信息'
    });
  }
  // 将openid附加到request对象
  request.wxOpenid = openid;
}

/**
 * 微信小程序可选认证中间件
 * 有token则验证，无token则放行
 */
export function wxOptionalAuthMiddleware(
  request: any,
  _reply: any
) {
  const openid = request.headers['x-wx-openid'];
  if (openid) {
    request.wxOpenid = openid;
  }
}

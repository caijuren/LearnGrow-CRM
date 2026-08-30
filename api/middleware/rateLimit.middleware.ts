/**
 * Rate Limiting Middleware - 限流中间件
 * 
 * 职责：提供API请求频率限制功能，防止滥用和DDoS攻击
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// 上传接口限流配置
const UPLOAD_WINDOW_MS = 60 * 1000; // 1分钟窗口
const UPLOAD_MAX = parseInt(process.env.UPLOAD_RATE_PER_MIN || '30', 10) || 30;
const uploadAttempts = new Map<number, { count: number; resetAt: number }>();

/**
 * 检查上传限流
 * @param wxUserId 微信用户ID
 * @returns 是否允许上传
 */
export function allowUpload(wxUserId: number): boolean {
  const now = Date.now();
  const current = uploadAttempts.get(wxUserId);
  
  if (!current || current.resetAt <= now) {
    uploadAttempts.set(wxUserId, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
    return true;
  }
  
  if (current.count >= UPLOAD_MAX) {
    return false;
  }
  
  current.count += 1;
  return true;
}

/**
 * 通用请求限流中间件
 * 基于IP地址进行限流
 */
export function createRateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message = '请求过于频繁，请稍后再试' } = options;
  const attempts = new Map<string, { count: number; resetAt: number }>();
  
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const ip = request.ip;
    const now = Date.now();
    const current = attempts.get(ip);
    
    if (!current || current.resetAt <= now) {
      attempts.set(ip, { count: 1, resetAt: now + windowMs });
      return;
    }
    
    if (current.count >= maxRequests) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      reply.header('Retry-After', String(retryAfter));
      return reply.code(429).send({
        success: false,
        error: message
      });
    }
    
    current.count += 1;
  };
}

/**
 * API限流中间件实例
 * 每分钟最多100次请求
 */
export const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'API请求过于频繁，请稍后再试'
});

/**
 * 登录限流中间件实例
 * 15分钟内最多10次尝试
 */
export const loginRateLimit = createRateLimitMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: '登录尝试次数过多，请15分钟后再试'
});

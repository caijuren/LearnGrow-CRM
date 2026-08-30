/**
 * Error Handler Middleware - 错误处理中间件
 * 
 * 职责：统一处理应用中的错误，提供友好的错误响应格式
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

/**
 * 全局错误处理器
 * 捕获所有未处理的异常和拒绝的Promise
 */
export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode || 500;
  
  // 记录错误日志（生产环境可接入Sentry等监控服务）
  console.error(`[ERROR] ${statusCode} - ${error.message}`, {
    url: request.url,
    method: request.method,
    params: request.params,
    query: request.query,
    body: request.body,
    stack: error.stack
  });
  
  // 开发环境返回详细错误信息
  const isDev = process.env.NODE_ENV !== 'production';
  
  reply.code(statusCode).send({
    success: false,
    error: getErrorMessage(statusCode, error.message),
    ...(isDev && {
      details: {
        message: error.message,
        stack: error.stack
      }
    })
  });
}

/**
 * 根据状态码获取友好的错误消息
 */
function getErrorMessage(statusCode: number, defaultMessage: string): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '登录已过期，请重新登录',
    403: '权限不足，无法执行此操作',
    404: '请求的资源不存在',
    409: '资源冲突，操作无法完成',
    429: '请求过于频繁，请稍后再试',
    500: '服务器内部错误，请稍后重试'
  };
  
  return messages[statusCode] || defaultMessage || '未知错误';
}

/**
 * 404 NotFound处理器
 * 当路由不存在时调用
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  reply.code(404).send({
    success: false,
    error: `接口 ${request.method} ${request.url} 不存在`
  });
}

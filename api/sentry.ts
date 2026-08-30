/**
 * Sentry 错误监控配置 - v3.2.0
 *
 * 集成 Sentry SDK 用于捕获和上报后端错误
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const isProduction = process.env.NODE_ENV === 'production';
const sentryDsn = process.env.SENTRY_DSN;

/**
 * 初始化 Sentry
 */
export function initSentry() {
  if (!sentryDsn) {
    console.warn('Sentry DSN not configured, error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || 'unknown',

    // 性能监控采样率（生产环境降低采样率以节省配额）
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // 启用性能分析
    integrations: [
      nodeProfilingIntegration(),
    ],

    // 性能分析采样率
    profilesSampleRate: isProduction ? 0.1 : 1.0,

    // 过滤敏感数据
    beforeSend(event) {
      // 移除可能的敏感信息
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      // 移除用户 PII 数据
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }

      return event;
    },

    // 忽略某些类型的错误
    ignoreErrors: [
      /Unauthorized/i,
      /Forbidden/i,
      /Not Found/i,
    ],
  });

  console.log('Sentry initialized successfully');
}

/**
 * 捕获异常并上报到 Sentry
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (context) {
    Sentry.setContext('custom', context);
  }
  Sentry.captureException(error);
}

/**
 * 捕获消息
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * 设置用户上下文
 */
export function setUser(user: { id: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    username: user.username,
  });
}

/**
 * 清除用户上下文
 */
export function clearUser() {
  Sentry.setUser(null);
}

/**
 * 添加面包屑（用于追踪错误发生前的操作序列）
 */
export function addBreadcrumb(message: string, category: string = 'default', level: Sentry.SeverityLevel = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
  });
}

/**
 * 启动事务（用于性能监控）
 */
export function startTransaction<T>(name: string, op: string = 'function', callback: () => T): T {
  return Sentry.startSpan({ name, op }, callback);
}

// 导出 Sentry 实例供直接使用
export { Sentry };

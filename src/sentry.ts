/**
 * Sentry 前端错误监控配置 - v3.2.0
 *
 * 集成 Sentry SDK 用于捕获和上报前端错误、性能数据
 */

import * as Sentry from '@sentry/react';

const isProduction = import.meta.env.PROD;
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * 初始化 Sentry
 */
export function initSentry() {
  if (!sentryDsn) {
    console.warn('Sentry DSN not configured, frontend error monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    release: import.meta.env.VITE_APP_VERSION || 'unknown',

    // 性能监控采样率
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // 会话回放（可选，需要额外配置）
    replaysSessionSampleRate: isProduction ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // 过滤敏感数据
    beforeSend(event) {
      // 移除可能的敏感信息
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }

      return event;
    },

    // 忽略某些类型的错误
    ignoreErrors: [
      /ResizeObserver loop limit exceeded/,
      /Non-Error promise rejection captured/,
    ],

    // React 集成
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });

  console.log('Sentry frontend initialized successfully');
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
 * 添加面包屑
 */
export function addBreadcrumb(message: string, category: string = 'default', level: Sentry.SeverityLevel = 'info') {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
  });
}

// 导出 Sentry 实例供直接使用
export { Sentry };

// 导出 ErrorBoundary 组件
export { ErrorBoundary } from '@sentry/react';

/**
 * Middleware Index - 中间件统一导出
 * 
 * 职责：提供所有中间件的统一导出入口
 */

// 认证中间件
export {
  allowAdminLogin,
  authMiddleware,
  adminOnly,
  operatorOrAbove,
  wxAuthMiddleware,
  wxOptionalAuthMiddleware,
  type AuthUser
} from './auth.middleware.js';

// 限流中间件
export {
  allowUpload,
  createRateLimitMiddleware,
  apiRateLimit,
  loginRateLimit
} from './rateLimit.middleware.js';

// 错误处理中间件
export {
  errorHandler,
  notFoundHandler
} from './errorHandler.middleware.js';

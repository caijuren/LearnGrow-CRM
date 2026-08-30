/**
 * Dashboard Routes - 驾驶舱路由层
 * 
 * 职责：处理Dashboard HTTP请求/响应，调用服务层获取统计数据
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { getDashboardData } from '../services/dashboard.service.js';

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 获取Dashboard统计数据
    router.get('/', async () => {
      const data = getDashboardData();
      return { success: true, data };
    });
  }, { prefix: '/api/dashboard' });
}

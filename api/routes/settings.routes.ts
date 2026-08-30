/**
 * Settings Routes - 系统设置路由层
 * 
 * 职责：处理系统设置相关的HTTP请求
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/auth.middleware.js';
import { getPointsSettings, updatePointsSettings } from '../services/settings.service.js';

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 获取积分设置（所有登录用户可查看）
    router.get('/points', async () => {
      const settings = getPointsSettings();
      return { success: true, data: settings };
    });
    
    // 更新积分设置（仅管理员）
    router.put('/points', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
      try {
        const settings = updatePointsSettings(request.body);
        return { success: true, data: settings };
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
  }, { prefix: '/api/settings' });
}

/**
 * 路由统一注册入口 - v2.9.0 架构重构
 *
 * 将所有路由模块统一注册到Fastify实例
 */

import { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth.routes.js';
import { registerWxUserRoutes } from './wxUser.routes.js';
import { registerCheckinRoutes } from './checkin.routes.js';
import { registerOrderRoutes } from './order.routes.js';
import { registerDashboardRoutes } from './dashboard.routes.js';
import { registerProductRoutes } from './product.routes.js';
import { registerChildRoutes } from './child.routes.js';
import { registerGroupRoutes } from './group.routes.js';
import { registerMaterialRoutes } from './material.routes.js';
import { registerSettingsRoutes } from './settings.routes.js';
import { registerBackupRoutes } from './backup.routes.js';

export async function registerAllRoutes(app: FastifyInstance) {
  // 系统接口
  app.get('/api/health', async () => ({ success: true, message: 'ok', version: process.env.npm_package_version || '0.0.0' }));
  app.get('/api/version', async () => ({ success: true, data: { version: process.env.npm_package_version || '0.0.0' } }));

  // 认证相关
  await registerAuthRoutes(app);

  // 微信用户管理
  await registerWxUserRoutes(app);

  // 打卡管理
  await registerCheckinRoutes(app);

  // 订单管理
  await registerOrderRoutes(app);

  // 驾驶舱
  await registerDashboardRoutes(app);

  // 产品管理
  await registerProductRoutes(app);

  // 孩子档案
  await registerChildRoutes(app);

  // 群组管理
  await registerGroupRoutes(app);

  // 素材管理
  await registerMaterialRoutes(app);

  // 系统设置
  await registerSettingsRoutes(app);

  // 备份管理
  await registerBackupRoutes(app);
}

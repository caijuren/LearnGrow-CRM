/**
 * Backup Routes - 备份管理路由层
 * 
 * 职责：处理数据备份相关的HTTP请求
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { adminOnly } from '../middleware/auth.middleware.js';
import { listBackups, createBackup } from '../services/backup.js';
import path from 'path';
import fs from 'fs';

export async function registerBackupRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', [authMiddleware, adminOnly]);
    
    // 获取备份列表
    router.get('/', async () => {
      const backups = listBackups().map(({ filePath, ...rest }) => rest);
      return { success: true, data: backups };
    });
    
    // 创建备份
    router.post('/', async (request: any, reply: any) => {
      try {
        const backup = await createBackup();
        return { success: true, data: { name: backup.name, size: backup.size, createdAt: backup.createdAt } };
      } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
      }
    });
    
    // 下载备份
    router.get('/download', async (request: any, reply: any) => {
      const { name } = request.query as any;
      if (!name) {
        return reply.code(400).send({ success: false, error: '缺少备份文件名' });
      }
      
      const filePath = path.join(process.env.BACKUP_DIR || './backups', name);
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ success: false, error: '备份文件不存在' });
      }
      
      return reply.download(filePath);
    });
  }, { prefix: '/api/admin/backups' });
}

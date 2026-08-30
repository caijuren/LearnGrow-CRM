/**
 * Child Routes - 孩子档案路由层
 * 
 * 职责：处理孩子档案相关的HTTP请求/响应
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { 
  listChildren, 
  getChildById, 
  createChild, 
  updateChild, 
  deleteChild,
  addChildProgress,
  advanceChildProgress,
  deleteChildProgress
} from '../services/child.service.js';

export async function registerChildRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 获取用户的所有孩子
    router.get('/', async (request: any) => {
      const { wx_user_id, customer_id } = request.query as any;
      const owner = wx_user_id || customer_id;
      
      if (!owner) {
        return { success: true, data: [] };
      }
      
      const children = listChildren({ wx_user_id: parseInt(owner) });
      return { success: true, data: children };
    });
    
    // 获取单个孩子详情（包含学习进度、订单、跟进记录）
    router.get('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const child = getChildById(id);
      
      if (!child) {
        return reply.code(404).send({ success: false, error: '孩子不存在' });
      }
      
      return { success: true, data: child };
    });
    
    // 创建孩子档案
    router.post('/', async (request: any, reply: any) => {
      try {
        const child = createChild(request.body);
        return reply.code(201).send({ success: true, data: child });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 更新孩子档案
    router.put('/:id', async (request: any, reply: any) => {
      try {
        const child = updateChild(parseInt(request.params.id), request.body);
        return { success: true, data: child };
      } catch (error: any) {
        if (error.message === '孩子不存在') {
          return reply.code(404).send({ success: false, error: error.message });
        }
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 删除孩子档案
    router.delete('/:id', async (request: any, reply: any) => {
      try {
        deleteChild(parseInt(request.params.id));
        return { success: true, data: null };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
    
    // 添加学习路径
    router.post('/:id/progress', async (request: any, reply: any) => {
      const childId = parseInt(request.params.id);
      const { path_id } = request.body;
      
      if (!path_id) {
        return reply.code(400).send({ success: false, error: '请选择学习路径' });
      }
      
      try {
        const progress = addChildProgress(childId, path_id);
        return reply.code(201).send({ success: true, data: progress });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 推进学习进度
    router.put('/:id/progress/:progressId/advance', async (request: any, reply: any) => {
      const childId = parseInt(request.params.id);
      const progressId = parseInt(request.params.progressId);
      
      try {
        const progress = advanceChildProgress(childId, progressId, request.body);
        return { success: true, data: progress };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
    
    // 删除学习进度记录
    router.delete('/:id/progress/:progressId', async (request: any, reply: any) => {
      const childId = parseInt(request.params.id);
      const progressId = parseInt(request.params.progressId);
      
      try {
        deleteChildProgress(childId, progressId);
        return { success: true, data: null };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
  }, { prefix: '/api/children' });
}

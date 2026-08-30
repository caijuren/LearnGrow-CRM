/**
 * Group Routes - 微信群组路由层
 * 
 * 职责：处理群组相关的HTTP请求/响应
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { 
  listGroups, 
  getGroupById, 
  createGroup, 
  updateGroup, 
  deleteGroup,
  batchImportMembers,
  addGroupMember,
  updateGroupMember,
  deleteGroupMember
} from '../services/group.service.js';

export async function registerGroupRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 群组列表
    router.get('/', async (request: any) => {
      const { status, search } = request.query as any;
      const result = listGroups({ status, search });
      return { success: true, data: result };
    });
    
    // 获取单个群组详情（包含成员）
    router.get('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const group = getGroupById(id);
      
      if (!group) {
        return reply.code(404).send({ success: false, error: '群不存在' });
      }
      
      return { success: true, data: group };
    });
    
    // 创建群组
    router.post('/', async (request: any, reply: any) => {
      try {
        const group = createGroup(request.body);
        return reply.code(201).send({ success: true, data: group });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 更新群组
    router.put('/:id', async (request: any, reply: any) => {
      try {
        const group = updateGroup(parseInt(request.params.id), request.body);
        return { success: true, data: group };
      } catch (error: any) {
        if (error.message === '群不存在') {
          return reply.code(404).send({ success: false, error: error.message });
        }
        throw error;
      }
    });
    
    // 删除群组
    router.delete('/:id', async (request: any, reply: any) => {
      try {
        deleteGroup(parseInt(request.params.id));
        return { success: true, data: null };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
    
    // 批量导入成员
    router.post('/:id/members/batch', async (request: any, reply: any) => {
      const groupId = parseInt(request.params.id);
      const { names, role = 'new' } = request.body;
      
      try {
        const result = batchImportMembers(groupId, names, role);
        return { success: true, data: result };
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 添加单个成员
    router.post('/:id/members', async (request: any, reply: any) => {
      const groupId = parseInt(request.params.id);
      
      try {
        const member = addGroupMember(groupId, request.body);
        return reply.code(201).send({ success: true, data: member });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 更新成员信息
    router.put('/:id/members/:memberId', async (request: any, reply: any) => {
      const groupId = parseInt(request.params.id);
      const memberId = parseInt(request.params.memberId);
      
      try {
        const member = updateGroupMember(groupId, memberId, request.body);
        return { success: true, data: member };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
    
    // 删除成员
    router.delete('/:id/members/:memberId', async (request: any, reply: any) => {
      const groupId = parseInt(request.params.id);
      const memberId = parseInt(request.params.memberId);
      
      try {
        deleteGroupMember(groupId, memberId);
        return { success: true, data: null };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
  }, { prefix: '/api/wechat-groups' });
}

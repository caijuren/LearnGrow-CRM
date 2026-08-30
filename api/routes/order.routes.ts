/**
 * Order Routes - 订单路由层
 * 
 * 职责：处理HTTP请求/响应，参数验证，调用服务层处理业务逻辑
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { listOrders, createOrder, deleteOrder } from '../services/order.service.js';

export async function registerOrderRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 订单列表
    router.get('/', async (request: any) => {
      const { wx_user_id, customer_id, page = '1', limit = '20' } = request.query as any;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      
      const owner = wx_user_id || customer_id;
      const result = listOrders({
        wx_user_id: owner ? parseInt(owner) : undefined,
        page: pageNum,
        limit: limitNum
      });
      
      return { success: true, data: result };
    });
    
    // 创建订单（通过微信用户）
    router.post('/:id/orders', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { product_id, amount, order_type, remark, shipping_note, child_id } = request.body;
      
      if (!product_id) {
        return reply.code(400).send({ success: false, error: '请选择产品' });
      }
      
      try {
        const order = await createOrder({
          wx_user_id: id,
          product_id,
          amount,
          order_type,
          remark,
          shipping_note,
          child_id
        });
        
        return reply.code(201).send({ success: true, data: order });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 删除订单
    router.delete('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      
      try {
        const order = deleteOrder(id);
        return { success: true, data: order };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
  }, { prefix: '/api/orders' });
}

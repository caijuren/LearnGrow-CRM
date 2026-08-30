/**
 * Product Routes - 产品路由层
 * 
 * 职责：处理产品相关的HTTP请求/响应
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { listProducts, getAllOnSaleProducts, createProduct, updateProduct, deleteProduct } from '../services/product.service.js';

export async function registerProductRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 产品列表（支持筛选和分页）
    router.get('/', async (request: any) => {
      const { tier, category, page = '1', limit = '50' } = request.query as any;
      const result = listProducts({
        tier,
        category,
        page: parseInt(page),
        limit: parseInt(limit)
      });
      
      return { success: true, data: result };
    });
    
    // 获取所有在售产品（简化版）
    router.get('/all', async () => {
      const products = getAllOnSaleProducts();
      return { success: true, data: products };
    });
    
    // 创建产品
    router.post('/', async (request: any, reply: any) => {
      try {
        const product = createProduct(request.body);
        return reply.code(201).send({ success: true, data: product });
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 更新产品
    router.put('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      
      try {
        const product = updateProduct(id, request.body);
        if (!product) {
          return reply.code(404).send({ success: false, error: '商品不存在' });
        }
        return { success: true, data: product };
      } catch (error: any) {
        if (error.message === '没有需要更新的字段') {
          return reply.code(400).send({ success: false, error: error.message });
        }
        throw error;
      }
    });
    
    // 删除产品
    router.delete('/:id', async (request: any) => {
      const id = parseInt(request.params.id);
      deleteProduct(id);
      return { success: true, data: null };
    });
  }, { prefix: '/api/products' });
}

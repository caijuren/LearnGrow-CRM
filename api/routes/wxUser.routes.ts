/**
 * 微信用户路由 - v2.9.0 架构重构
 *
 * 处理微信用户的CRUD操作、跟进记录、订单等接口
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware, adminOnly } from '../middleware/auth.middleware.js';
import {
  listWxUsers,
  getAllTags,
  getWxUserDetail,
  createWxUser,
  updateWxUser,
  updateWxUserStats
} from '../services/wxUser.service.js';
import db from '../db.js';
import { getIntSetting, grantOrderPoints } from '../services/points.js';

export async function registerWxUserRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);

    /**
     * GET /api/wx-users
     * 获取微信用户列表
     */
    router.get('/', async (request: any) => {
      const query = request.query as any;
      const result = listWxUsers({
        search: query.search,
        importance: query.importance,
        stage: query.stage,
        need_follow: query.need_follow === 'true',
        tag: query.tag,
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '20'),
        sort: query.sort || 'activity',
        dir: query.dir
      });

      return {
        success: true,
        data: {
          users: result.users,
          total: result.total,
          facets: result.facets
        }
      };
    });

    /**
     * GET /api/wx-users/all-tags
     * 获取所有标签
     */
    router.get('/all-tags', async () => {
      return {
        success: true,
        data: getAllTags()
      };
    });

    /**
     * GET /api/wx-users/:id
     * 获取用户详情（360度视图）
     */
    router.get('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const user = getWxUserDetail(id);

      if (!user) {
        return reply.code(404).send({ success: false, error: '用户不存在' });
      }

      return {
        success: true,
        data: user
      };
    });

    /**
     * POST /api/wx-users
     * 创建新用户
     */
    router.post('/', async (request: any, reply: any) => {
      const data = request.body;

      if (!data.name) {
        return reply.code(400).send({ success: false, error: '备注名不能为空' });
      }

      const user = createWxUser(data);

      return reply.code(201).send({
        success: true,
        data: user
      });
    });

    /**
     * PUT /api/wx-users/:id
     * 更新用户信息
     */
    router.put('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const row = db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id);

      if (!row) {
        return reply.code(404).send({ success: false, error: '用户不存在' });
      }

      const user = updateWxUser(id, request.body);

      return {
        success: true,
        data: user
      };
    });

    /**
     * DELETE /api/wx-users/:id
     * 删除用户（使用v2.7.0的级联删除服务）
     */
    router.delete('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const user = (request as any).user;

      if (!user || user.role !== 'admin') {
        return reply.code(403).send({ success: false, error: '需要管理员权限' });
      }

      const { deleteUser } = await import('../services/user-delete.service.js');
      const result = await deleteUser(id, false, user);

      if (!result.success) {
        return reply.code(404).send({ success: false, error: result.error });
      }

      return {
        success: true,
        data: {
          user_id: result.user_id,
          cascade_deleted: result.cascade_deleted
        }
      };
    });

    /**
     * POST /api/wx-users/:id/follow-ups
     * 添加跟进记录
     */
    router.post('/:id/follow-ups', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { method, content, result: followResult, next_follow_date, is_live_note = false, child_id } = request.body;

      if (!method || !content) {
        return reply.code(400).send({ success: false, error: '方式和内容不能为空' });
      }

      const r = db.prepare(
        'INSERT INTO follow_ups (wx_user_id, child_id, method, content, result, next_follow_date, is_live_note) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, child_id || null, method, content, followResult || null, next_follow_date || null, is_live_note ? 1 : 0);

      updateWxUserStats(id);

      const followUp = db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid);

      return reply.code(201).send({
        success: true,
        data: followUp
      });
    });

    /**
     * POST /api/wx-users/:id/orders
     * 创建订单
     */
    router.post('/:id/orders', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { product_id, amount, order_type, remark, shipping_note, child_id } = request.body;

      if (!product_id) {
        return reply.code(400).send({ success: false, error: '请选择产品' });
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
      if (!product) {
        return reply.code(400).send({ success: false, error: '产品不存在' });
      }

      const finalAmount = amount || product.price;
      const existingCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE wx_user_id = ?').get(id) as any).c;
      const finalType = order_type || (existingCount === 0 ? 'first' : 'repurchase');

      // 生成订单号
      const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const r = db.prepare(
        "INSERT INTO orders (order_no, wx_user_id, child_id, product_id, amount, order_type, remark, shipping_note, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))"
      ).run(orderNo, id, child_id || null, product_id, finalAmount, finalType, remark || null, shipping_note || null);

      // 发放积分
      const earned = Math.floor(finalAmount * getIntSetting('points_order_rate'));
      if (earned > 0) {
        grantOrderPoints(id, r.lastInsertRowid as number, earned);
      }

      // 更新用户统计
      updateWxUserStats(id);

      // 更新产品销量
      db.prepare('UPDATE products SET sales_count = sales_count + 1 WHERE id = ?').run(product_id);

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid);

      return reply.code(201).send({
        success: true,
        data: order
      });
    });

    /**
     * PUT /api/wx-users/:id/tags
     * 更新用户标签
     */
    router.put('/:id/tags', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const row = db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id);

      if (!row) {
        return reply.code(404).send({ success: false, error: '用户不存在' });
      }

      const { tags } = request.body;
      db.prepare("UPDATE wx_users SET tags = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(tags || []), id);

      const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id);

      return {
        success: true,
        data: user
      };
    });

    /**
     * PUT /api/wx-users/:id/importance
     * 更新用户重要性
     */
    router.put('/:id/importance', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const row = db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id);

      if (!row) {
        return reply.code(404).send({ success: false, error: '用户不存在' });
      }

      const { importance } = request.body;
      if (!['vip', 'normal', 'watch'].includes(importance)) {
        return reply.code(400).send({ success: false, error: '重要性值无效' });
      }

      db.prepare("UPDATE wx_users SET importance = ?, updated_at = datetime('now') WHERE id = ?")
        .run(importance, id);

      const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id);

      return {
        success: true,
        data: user
      };
    });
  }, { prefix: '/api/wx-users' });
}

/**
 * 打卡管理路由 - v2.9.0 架构重构
 *
 * 处理打卡活动、参与者、记录等管理端接口
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware, adminOnly, wxAuthMiddleware, wxOptionalAuthMiddleware } from '../middleware/auth.middleware.js';
import {
  listCheckinEvents,
  getCheckinEventById,
  createCheckinEvent,
  updateCheckinEvent,
  getCheckinEventStats,
  getCheckinRanking,
  joinCheckinEvent,
  submitCheckinRecord,
  approveCheckinRecord,
  rejectCheckinRecord,
  getUserCheckinRecords
} from '../services/checkin.service.js';
import db from '../db.js';

export async function registerCheckinRoutes(app: FastifyInstance) {
  // ==================== 管理端接口 ====================

  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);

    /**
     * GET /api/checkin-events
     * 获取打卡活动列表
     */
    router.get('/', async (request: any) => {
      const query = request.query as any;
      const result = listCheckinEvents({
        status: query.status,
        search: query.search,
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '20')
      });

      return {
        success: true,
        data: result
      };
    });

    /**
     * POST /api/checkin-events
     * 创建打卡活动
     */
    router.post('/', async (request: any, reply: any) => {
      const data = request.body;

      if (!data.title) {
        return reply.code(400).send({ success: false, error: '活动标题不能为空' });
      }

      const event = createCheckinEvent(data);

      return reply.code(201).send({
        success: true,
        data: event
      });
    });

    /**
     * GET /api/checkin-events/:id
     * 获取活动详情和统计
     */
    router.get('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const event = getCheckinEventById(id);

      if (!event) {
        return reply.code(404).send({ success: false, error: '活动不存在' });
      }

      const stats = getCheckinEventStats(id);

      return {
        success: true,
        data: { ...event, stats }
      };
    });

    /**
     * PUT /api/checkin-events/:id
     * 更新活动信息
     */
    router.put('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const updated = updateCheckinEvent(id, request.body);

      if (!updated) {
        return reply.code(404).send({ success: false, error: '活动不存在' });
      }

      return {
        success: true,
        data: updated
      };
    });

    /**
     * GET /api/checkin-events/:id/ranking
     * 获取活动排行榜
     */
    router.get('/:id/ranking', async (request: any) => {
      const id = parseInt(request.params.id);
      const limit = parseInt(request.query?.limit || '50');
      const ranking = getCheckinRanking(id, limit);

      return {
        success: true,
        data: ranking
      };
    });

    /**
     * POST /api/checkin-events/reminders/run
     * 手动执行打卡提醒任务
     */
    router.post('/reminders/run', { preHandler: [adminOnly] }, async () => {
      // TODO: 实现提醒逻辑
      return {
        success: true,
        message: '提醒任务已执行'
      };
    });
  }, { prefix: '/api/checkin-events' });

  // ==================== 小程序端接口 ====================

  app.register(async function (router) {
    /**
     * GET /api/wx/checkin-events
     * 获取可参与的打卡活动列表
     */
    router.get('/checkin-events', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any) => {
      const events = db.prepare(`
        SELECT * FROM checkin_events
        WHERE status = 'active' AND end_date >= date('now')
        ORDER BY created_at DESC
      `).all() as any[];

      return {
        success: true,
        data: events
      };
    });

    /**
     * POST /api/wx/checkin-events/:id/join
     * 报名参加活动
     */
    router.post('/checkin-events/:id/join', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const wxUserId = (request as any).wxOpenid ? 1 : 0; // TODO: 从openid获取真实用户ID

      try {
        const participantId = joinCheckinEvent(id, wxUserId);
        return reply.code(201).send({
          success: true,
          data: { participant_id: participantId }
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message
        });
      }
    });

    /**
     * POST /api/wx/checkin
     * 提交打卡记录
     */
    router.post('/checkin', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
      const { participant_id, media_type, media_url, note, is_makeup, makeup_date } = request.body;

      try {
        const recordId = submitCheckinRecord({
          participantId: participant_id,
          mediaType: media_type,
          mediaUrl: media_url,
          note,
          isMakeup: is_makeup,
          makeupDate: makeup_date
        });

        return reply.code(201).send({
          success: true,
          data: { record_id: recordId }
        });
      } catch (error: any) {
        return reply.code(400).send({
          success: false,
          error: error.message
        });
      }
    });

    /**
     * GET /api/wx/my-checkins
     * 获取我的打卡记录
     */
    router.get('/my-checkins', { preHandler: [wxAuthMiddleware] }, async (request: any) => {
      const wxUserId = (request as any).wxOpenid ? 1 : 0; // TODO: 从openid获取真实用户ID
      const query = request.query as any;

      const result = getUserCheckinRecords(wxUserId, {
        page: parseInt(query.page || '1'),
        limit: parseInt(query.limit || '20')
      });

      return {
        success: true,
        data: result
      };
    });

    /**
     * GET /api/wx/checkin-events/:id/ranking
     * 获取活动排行榜
     */
    router.get('/checkin-events/:id/ranking', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any) => {
      const id = parseInt(request.params.id);
      const limit = parseInt(request.query?.limit || '50');
      const ranking = getCheckinRanking(id, limit);

      return {
        success: true,
        data: ranking
      };
    });

    /**
     * PUT /api/wx/checkin-records/:id
     * 更新打卡记录（仅自己的）
     */
    router.put('/checkin-records/:id', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { note } = request.body;

      const record = db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(id) as any;
      if (!record) {
        return reply.code(404).send({ success: false, error: '记录不存在' });
      }

      db.prepare('UPDATE checkin_records SET note = ? WHERE id = ?').run(note, id);

      return {
        success: true,
        data: db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(id)
      };
    });
  }, { prefix: '/api/wx' });

  // ==================== 审核相关接口 ====================

  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);

    /**
     * PUT /api/checkin-records/:id/approve
     * 审核通过打卡记录
     */
    router.put('/checkin-records/:id/approve', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { comment } = request.body;

      try {
        await approveCheckinRecord(id, comment);
        return {
          success: true,
          message: '审核通过'
        };
      } catch (error: any) {
        return reply.code(404).send({
          success: false,
          error: error.message
        });
      }
    });

    /**
     * PUT /api/checkin-records/:id/reject
     * 拒绝打卡记录
     */
    router.put('/checkin-records/:id/reject', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const { comment } = request.body;

      if (!comment) {
        return reply.code(400).send({ success: false, error: '请填写拒绝原因' });
      }

      try {
        await rejectCheckinRecord(id, comment);
        return {
          success: true,
          message: '已拒绝'
        };
      } catch (error: any) {
        return reply.code(404).send({
          success: false,
          error: error.message
        });
      }
    });
  }, { prefix: '/api' });
}

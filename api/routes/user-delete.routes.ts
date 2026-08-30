/**
 * 用户数据删除接口 - v2.7.0 安全合规加固
 * 
 * DELETE /api/wx-users/:id
 * 功能: 删除微信用户及其关联数据（支持软删除和硬删除）
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authMiddleware, adminOnly, type AuthUser } from '../services/auth.js';
import { deleteUser, batchSoftDeleteUsers, getExpiredSoftDeletedUsers, purgeExpiredSoftDeletedUsers } from '../services/user-delete.service.js';

export async function registerUserDeleteRoutes(fastify: FastifyInstance) {
  // 注册认证中间件
  fastify.addHook('preHandler', authMiddleware);

  /**
   * 删除单个用户
   * DELETE /api/wx-users/:id
   */
  fastify.delete('/wx-users/:id', {
    preHandler: [adminOnly],
    schema: {
      summary: '删除微信用户',
      description: '删除指定用户及其所有关联数据。默认软删除，可通过参数选择硬删除。',
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: '用户ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          hard_delete: { 
            type: 'boolean', 
            default: false,
            description: '是否硬删除（物理删除），默认false为软删除'
          },
          reason: {
            type: 'string',
            maxLength: 500,
            description: '删除原因（可选）'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user_id: { type: 'integer' },
                hard_delete: { type: 'boolean' },
                cascade_deleted: {
                  type: 'object',
                  properties: {
                    children: { type: 'integer' },
                    checkin_participants: { type: 'integer' },
                    checkin_records: { type: 'integer' },
                    orders: { type: 'integer' },
                    follow_ups: { type: 'integer' },
                    points_ledger: { type: 'integer' },
                    checkin_likes: { type: 'integer' },
                    badge_achievements: { type: 'integer' }
                  }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: number };
    const { hard_delete = false, reason } = request.body as { hard_delete?: boolean; reason?: string };
    const user = (request as any).user as AuthUser;

    try {
      const result = await deleteUser(id, hard_delete, user);

      if (!result.success) {
        return reply.code(404).send({
          success: false,
          error: result.error || '删除失败'
        });
      }

      // 记录操作日志
      fastify.log.info({
        action: hard_delete ? 'USER_HARD_DELETED' : 'USER_SOFT_DELETED',
        user_id: id,
        operator: user.username,
        reason,
        cascade_deleted: result.cascade_deleted
      });

      return reply.send({
        success: true,
        data: {
          user_id: result.user_id,
          hard_delete: result.hard_delete,
          cascade_deleted: result.cascade_deleted
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: '服务器内部错误'
      });
    }
  });

  /**
   * 批量软删除用户
   * POST /api/wx-users/batch-delete
   */
  fastify.post('/wx-users/batch-delete', {
    preHandler: [adminOnly],
    schema: {
      summary: '批量软删除用户',
      description: '批量软删除多个用户，用于清理测试数据或违规用户',
      body: {
        type: 'object',
        properties: {
          user_ids: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
            maxItems: 100,
            description: '要删除的用户ID列表（最多100个）'
          },
          reason: {
            type: 'string',
            maxLength: 500,
            description: '批量删除原因'
          }
        },
        required: ['user_ids']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                succeeded: { type: 'integer' },
                failed: { type: 'integer' },
                results: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      user_id: { type: 'integer' },
                      success: { type: 'boolean' },
                      error: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { user_ids, reason } = request.body as { user_ids: number[]; reason?: string };
    const user = (request as any).user as AuthUser;

    try {
      const results = await batchSoftDeleteUsers(user_ids, user);
      
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      // 记录操作日志
      fastify.log.info({
        action: 'BATCH_USER_SOFT_DELETED',
        user_count: user_ids.length,
        operator: user.username,
        reason,
        succeeded,
        failed
      });

      return reply.send({
        success: true,
        data: {
          total: user_ids.length,
          succeeded,
          failed,
          results
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: '服务器内部错误'
      });
    }
  });

  /**
   * 查询待清理的过期软删除用户
   * GET /api/wx-users/expired-deletions
   */
  fastify.get('/wx-users/expired-deletions', {
    preHandler: [adminOnly],
    schema: {
      summary: '查询待清理的过期软删除用户',
      description: '查询超过保留期的软删除用户，可用于定期清理任务',
      querystring: {
        type: 'object',
        properties: {
          retention_days: {
            type: 'integer',
            default: 90,
            minimum: 7,
            maximum: 365,
            description: '保留天数（默认90天）'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  nickname: { type: 'string' },
                  deleted_at: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { retention_days = 90 } = request.query as { retention_days?: number };

    try {
      const expiredUsers = getExpiredSoftDeletedUsers(retention_days);

      return reply.send({
        success: true,
        data: expiredUsers
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: '服务器内部错误'
      });
    }
  });

  /**
   * 永久清除过期的软删除用户
   * POST /api/wx-users/purge-expired
   */
  fastify.post('/wx-users/purge-expired', {
    preHandler: [adminOnly],
    schema: {
      summary: '永久清除过期的软删除用户',
      description: '将超过保留期的软删除用户进行硬删除，释放存储空间',
      body: {
        type: 'object',
        properties: {
          retention_days: {
            type: 'integer',
            default: 90,
            minimum: 7,
            maximum: 365,
            description: '保留天数（默认90天）'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                purged_count: { type: 'integer' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { retention_days = 90 } = request.body as { retention_days?: number };
    const user = (request as any).user as AuthUser;

    try {
      const purgedCount = await purgeExpiredSoftDeletedUsers(retention_days, user);

      // 记录操作日志
      fastify.log.info({
        action: 'PURGE_EXPIRED_USERS',
        purged_count: purgedCount,
        retention_days,
        operator: user.username
      });

      return reply.send({
        success: true,
        data: {
          purged_count: purgedCount
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: '服务器内部错误'
      });
    }
  });
}

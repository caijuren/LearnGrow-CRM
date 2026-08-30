/**
 * 认证路由 - v2.9.0 架构重构
 *
 * 处理管理端登录、用户信息获取等认证相关接口
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { allowAdminLogin, authMiddleware, type AuthUser } from '../middleware/auth.middleware.js';
import { loginUser, getUserById } from '../services/auth.service.js';

export async function registerAuthRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/login
   * 管理端登录接口
   */
  app.post('/api/auth/login', {
    schema: {
      tags: ['认证'],
      summary: '管理端登录',
      description: '使用用户名和密码登录管理后台，返回JWT token',
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', description: '用户名' },
          password: { type: 'string', format: 'password', description: '密码' }
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
                token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    username: { type: 'string' },
                    role: { type: 'string' },
                    display_name: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        429: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    // 检查登录限流
    if (!allowAdminLogin(request, reply)) return;

    // 验证请求参数
    const parsed = z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    }).safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        error: '用户名和密码不能为空'
      });
    }

    const { username, password } = parsed.data;

    // 调用服务层进行登录验证
    const result = await loginUser(username, password);

    if (!result.success) {
      return reply.code(401).send({
        success: false,
        error: result.error
      });
    }

    // 生成JWT token
    const token = app.jwt.sign({
      id: result.user!.id,
      username: result.user!.username,
      role: result.user!.role
    });

    return {
      success: true,
      data: {
        token,
        user: result.user
      }
    };
  });

  /**
   * GET /api/auth/me
   * 获取当前登录用户信息
   */
  app.get('/api/auth/me', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['认证'],
      summary: '获取当前用户信息',
      description: '返回当前登录用户的详细信息',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                role: { type: 'string' },
                display_name: { type: 'string' },
                created_at: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
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
    const user = request.user as AuthUser;
    const userInfo = getUserById(user.id);

    if (!userInfo) {
      return reply.code(404).send({
        success: false,
        error: '用户不存在'
      });
    }

    return {
      success: true,
      data: userInfo
    };
  });
}

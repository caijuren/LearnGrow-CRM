import type { FastifyRequest, FastifyReply } from 'fastify';

const JWT_SECRET = process.env.JWT_SECRET || 'learngrow-crm-secret-key-change-in-production';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'assistant';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; username: string; role: string };
    user: AuthUser;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ success: false, error: '登录已过期，请重新登录' });
  }
}

export async function adminOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user as AuthUser | undefined;
  if (!user || user.role !== 'admin') {
    reply.status(403).send({ success: false, error: '权限不足，仅管理员可操作' });
  }
}

export { JWT_SECRET };

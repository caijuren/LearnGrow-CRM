import type { FastifyRequest, FastifyReply } from 'fastify';

const DEFAULT_JWT_SECRET = 'learngrow-crm-secret-key-change-in-production';

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    if (!secret || secret === DEFAULT_JWT_SECRET || secret.length < 32) {
      throw new Error('生产环境必须配置长度至少32位的 JWT_SECRET');
    }
  }
  return secret || DEFAULT_JWT_SECRET;
}

const JWT_SECRET = resolveJwtSecret();

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'assistant';
}

export interface WxAuthUser {
  wxUserId: number;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id?: number; username?: string; role?: string; wxUserId?: number; type?: string };
    user: AuthUser | WxAuthUser;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
    return;
  }
  const user = request.user as { type?: string } | undefined;
  if (!user || user.type !== 'admin') {
    reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
    return;
  }
}

export async function adminOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user as AuthUser | undefined;
  if (!user || user.role !== 'admin') {
    reply.code(403).send({ success: false, error: '权限不足，仅管理员可操作' });
    return;
  }
}

export { JWT_SECRET };

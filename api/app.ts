/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const, no-empty, @typescript-eslint/no-unused-vars */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';
import { adminOnly, authMiddleware, JWT_SECRET, type AuthUser } from './services/auth.js';
import { AUTO_BACKUP_TIME, backupsDir, createBackup, dataDir, isValidBackupName, listBackups, scanMediaReferences } from './services/backup.js';
import { getIntSetting, grantCheckinPoints, grantOrderPoints, grantPoints, revokeByRef } from './services/points.js';
import { getEventShareLink } from './services/wx-share.js';
import db from './db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';
import type { WxUser, Product, FollowUp, TodoItem, CustomerSuggestion, WxUser360, LiveCustomerCard, DashboardData, OrderWithProduct, OrderWithWxUser, WechatGroup, WechatGroupMember, Child, ChildWithProgress, ChildLearningProgress, LearningPath, LearningStage, Textbook, CheckinEvent, CheckinParticipant, CheckinRecord, CheckinParticipantStats, CheckinEventDetail, CustomerStage, Material, MaterialCategory } from '../shared/types.js';
import { metricsMiddleware, registerMetricsRoutes } from './middleware/metrics.middleware.js';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function ok<T>(data: T) {
  return { success: true as const, data };
}

const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();

// 上传接口限流：每个用户每分钟最多 N 次（默认 30，可用环境变量 UPLOAD_RATE_PER_MIN 覆盖）
const UPLOAD_WINDOW_MS = 60 * 1000;
const UPLOAD_MAX = parseInt(process.env.UPLOAD_RATE_PER_MIN || '30', 10) || 30;
const uploadAttempts = new Map<number, { count: number; resetAt: number }>();
function allowUpload(wxUserId: number): boolean {
  const now = Date.now();
  const current = uploadAttempts.get(wxUserId);
  if (!current || current.resetAt <= now) {
    uploadAttempts.set(wxUserId, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
    return true;
  }
  if (current.count >= UPLOAD_MAX) return false;
  current.count += 1;
  return true;
}

function allowAdminLogin(request: FastifyRequest, reply: FastifyReply): boolean {
  const now = Date.now();
  const key = request.ip;
  const current = adminLoginAttempts.get(key);

  if (!current || current.resetAt <= now) {
    adminLoginAttempts.set(key, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
    return true;
  }

  if (current.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    reply.header('Retry-After', String(retryAfter));
    reply.code(429).send({ success: false, error: '登录尝试过于频繁，请稍后再试' });
    return false;
  }

  current.count += 1;
  return true;
}

function detectImageExtension(buffer: Buffer): '.jpg' | '.png' | '.gif' | '.webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) return '.gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return '.webp';
  return null;
}

type MediaType = 'image' | 'video';
type MediaExt = '.jpg' | '.png' | '.gif' | '.webp' | '.mp4' | '.mov';

function detectMedia(buffer: Buffer): { type: MediaType; ext: MediaExt } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { type: 'image', ext: '.jpg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image', ext: '.png' };
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) return { type: 'image', ext: '.gif' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { type: 'image', ext: '.webp' };

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').replace(/\0/g, '').trim();
    if (brand === 'qt' || brand.startsWith('qt')) return { type: 'video', ext: '.mov' };
    return { type: 'video', ext: '.mp4' };
  }

  return null;
}

function mapWxUser(c: any): WxUser {
  return {
    ...c,
    tags: parseJson(c.tags, [] as string[]),
    stage: c.stage || 'new_friend',
    wechat_account: c.wechat_account || 'main',
  };
}

function mapProduct(p: any): Product {
  return { ...p, related_product_ids: parseJson(p.related_product_ids, [] as number[]), is_on_sale: !!p.is_on_sale };
}

function mapFollowUp(f: any): FollowUp {
  return { ...f, is_live_note: !!f.is_live_note };
}

function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${dateStr}${random}`;
}

function displayName(u: { display_name?: string | null; name?: string | null; nickname?: string | null; child_name?: string | null }): string {
  return u.display_name || u.name || u.nickname || (u.child_name ? `${u.child_name}家长` : '') || '微信用户';
}

function getParentName(name: string | null | undefined): string {
  return (name || '家长').split('-')[0];
}

function getWxUserSuggestions(wxUserId: number, user: WxUser): CustomerSuggestion[] {
  const suggestions: CustomerSuggestion[] = [];
  const pname = getParentName(displayName(user));
  const orders = db.prepare(`SELECT o.*, p.name as product_name, p.tier as product_tier, p.related_product_ids FROM orders o JOIN products p ON o.product_id = p.id WHERE o.wx_user_id = ? ORDER BY o.purchase_date DESC`).all(wxUserId) as any[];
  const allProducts = (db.prepare('SELECT * FROM products WHERE is_on_sale = 1').all() as any[]).map(mapProduct);

  if (orders.length === 0) {
    const trafficProducts = allProducts.filter(p => p.tier === 'traffic');
    if (trafficProducts.length > 0) {
      const p = trafficProducts[0];
      suggestions.push({ type: 'new_customer', title: '新家长，推引流款', reason: '还没买过资料，先从低价福利款建立信任', product: p, script: `${pname}你好呀~我是直播间的XX老师，感谢你加我！给你准备了个新人福利，${p.name}只要${p.price}元，特别适合孩子打基础，要不要带一份？` });
    }
  } else {
    const lastOrder = orders[0];
    const lastProduct = allProducts.find(p => p.id === lastOrder.product_id);
    if (lastProduct?.related_product_ids && lastProduct.related_product_ids.length > 0) {
      for (const rid of lastProduct.related_product_ids) {
        const related = allProducts.find(p => p.id === rid);
        if (related && !orders.some(o => o.product_id === rid)) {
          suggestions.push({ type: 'related', title: `搭配${related.name}效果更好`, reason: `买过${lastProduct.name}的家长经常一起买${related.name}`, product: related, script: `对了${pname}，你上次拿的${lastProduct.name}搭配${related.name}效果特别好！${related.selling_points}，孩子学起来更系统，要不要一起带一份？` });
          break;
        }
      }
    }
    const mainBought = orders.some(o => o.product_tier === 'main');
    const premiumBought = orders.some(o => o.product_tier === 'premium');
    if (user.importance === 'vip' && mainBought && !premiumBought) {
      const premium = allProducts.find(p => p.tier === 'premium' && !orders.some(o => o.product_id === p.id));
      if (premium) suggestions.push({ type: 'upsell', title: '推荐VIP专属服务', reason: '是重点家长，已经买过主力资料，可以推荐1对1规划服务', product: premium, script: `${pname}，跟你说个特别好的服务，我们这个${premium.name}反馈特别好，${premium.selling_points}，我第一时间想到你家孩子，给你留个名额？` });
    }
    if (user.last_follow_date) {
      const daysSinceFollow = Math.floor((Date.now() - new Date(user.last_follow_date).getTime()) / 86400000);
      if (daysSinceFollow >= 15) suggestions.push({ type: 'reconnect', title: '好久没聊了，打个招呼', reason: `已经${Math.floor(daysSinceFollow)}天没联系了，问问孩子最近学习情况`, script: `${pname}好久没聊啦~孩子最近学习咋样？有没有遇到什么问题？我这边新到了点好资料，有空来直播间看看呀！` });
    }
    const consideringFollowUp = db.prepare(`SELECT * FROM follow_ups WHERE wx_user_id = ? AND result = 'considering' AND date >= date('now', '-7 days') ORDER BY date DESC LIMIT 1`).get(wxUserId) as any;
    if (consideringFollowUp) {
      const daysSince = Math.floor((Date.now() - new Date(consideringFollowUp.date).getTime()) / 86400000);
      if (daysSince >= 3) suggestions.push({ type: 'considering', title: '上次说考虑的，回访一下', reason: `${Math.floor(daysSince)}天前说"考虑一下"，该回访了`, script: `${pname}，上次你说考虑的那个资料，现在想得咋样啦？孩子学习不等人，有啥疑问随时问我哈~` });
    }
  }
  return suggestions;
}

// 以东八区（北京时间）为准的日期工具，避免 UTC 与本地日期在 00:00-08:00 之间错位导致跨天判断错误
const BJT_MS = 8 * 3600 * 1000;
function bjtDateStr(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function bjtToday(): string {
  return bjtDateStr(Date.now() + BJT_MS);
}
function bjtDaysAgo(n: number): string {
  return bjtDateStr(Date.now() + BJT_MS - n * 86400000);
}

/**
 * 「需跟进」= 加了好友却一次没跟过（给 3 天缓冲），或上次跟进距今满 7 天。
 * 用括号包住两个条件，否则 SQL 里 OR 的优先级会把它们拆成三条独立条件。
 */
function needFollowClause(): { sql: string; params: string[] } {
  return {
    sql: `(
      (last_follow_date IS NULL AND COALESCE(wechat_add_date, substr(created_at, 1, 10)) <= ?)
      OR (last_follow_date IS NOT NULL AND last_follow_date <= ?)
    )`,
    params: [bjtDaysAgo(3), bjtDaysAgo(7)],
  };
}

function getTodos(): TodoItem[] {
  const todos: TodoItem[] = [];
  const today = bjtToday();
  const users = (db.prepare('SELECT * FROM wx_users').all() as any[]).map(mapWxUser);

  for (const u of users) {
    if (u.importance === 'vip') {
      const uname = displayName(u);
      const daysSinceFollow = u.last_follow_date ? Math.floor((Date.now() - new Date(u.last_follow_date).getTime()) / 86400000) : 999;
      if (daysSinceFollow >= 7) todos.push({ id: `vip_${u.id}`, type: 'vip_follow', priority: 'high', wx_user_id: u.id, wx_user_name: uname, title: `${uname} - 重点家长跟进`, description: `已经${Math.floor(daysSinceFollow)}天没联系了，重点家长要常维护`, suggested_script: `${getParentName(uname)}最近咋样呀？上次给孩子拿的资料用得还好不？` });
    }
  }

  const reminders = db.prepare(`SELECT f.*, COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') AS user_name FROM follow_ups f JOIN wx_users u ON f.wx_user_id = u.id WHERE f.next_follow_date IS NOT NULL AND date(f.next_follow_date) <= date(?) ORDER BY f.next_follow_date ASC`).all(today) as any[];
  for (const r of reminders) todos.push({ id: `reminder_${r.id}`, type: 'reminder', priority: 'high', wx_user_id: r.wx_user_id, wx_user_name: r.user_name, title: `${r.user_name} - 跟进提醒`, description: r.content, due_date: r.next_follow_date, follow_up_id: r.id });

  const considering = db.prepare(`SELECT f.*, COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') AS user_name FROM follow_ups f JOIN wx_users u ON f.wx_user_id = u.id WHERE f.result = 'considering' AND julianday('now') - julianday(f.date) >= 3 AND NOT EXISTS (SELECT 1 FROM follow_ups f2 WHERE f2.wx_user_id = f.wx_user_id AND f2.date > f.date)`).all() as any[];
  for (const r of considering) {
    if (!todos.some(t => t.wx_user_id === r.wx_user_id && t.type === 'considering')) todos.push({ id: `considering_${r.id}`, type: 'considering', priority: 'medium', wx_user_id: r.wx_user_id, wx_user_name: r.user_name, title: `${r.user_name} - 说考虑中，该回访了`, description: r.content, follow_up_id: r.id, suggested_script: `${getParentName(r.user_name)}，上次你说考虑的那个资料，现在想得咋样啦？` });
  }

  for (const u of users) {
    const daysSinceFollow = u.last_follow_date ? Math.floor((Date.now() - new Date(u.last_follow_date).getTime()) / 86400000) : 999;
    if (u.order_count === 0 && daysSinceFollow >= 15 && !todos.some(t => t.wx_user_id === u.id)) {
      const uname = displayName(u);
      todos.push({ id: `silent_${u.id}`, type: 'long_time_no_talk', priority: 'low', wx_user_id: u.id, wx_user_name: uname, title: `${uname} - 好久没联系了`, description: `${Math.floor(daysSinceFollow)}天没互动了，打个招呼问问孩子情况吧`, suggested_script: `${getParentName(uname)}好久没聊啦~孩子最近学习咋样？` });
    }
  }

  todos.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority]) - ({ high: 0, medium: 1, low: 2 }[b.priority]));
  return todos;
}

function updateWxUserStats(wxUserId: number) {
  const orders = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt, MAX(purchase_date) as last_date FROM orders WHERE wx_user_id = ?").get(wxUserId) as any;
  const lastFollow = db.prepare("SELECT MAX(date) as last_date FROM follow_ups WHERE wx_user_id = ?").get(wxUserId) as any;
  db.prepare("UPDATE wx_users SET total_spent = ?, order_count = ?, last_order_date = ?, last_follow_date = ?, updated_at = datetime('now') WHERE id = ?").run(orders.total || 0, orders.cnt || 0, orders.last_date || null, lastFollow.last_date || null, wxUserId);
}

function updateProductSales(productId: number) {
  const count = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE product_id = ?").get(productId) as any).c;
  db.prepare("UPDATE products SET sales_count = ? WHERE id = ?").run(count, productId);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    return String(pkg.version || 'dev');
  } catch {
    return 'dev';
  }
})();
const app = Fastify({ trustProxy: true, logger: { level: 'info', transport: { target: 'pino-pretty', options: { translateTime: 'HH:mm:ss Z', ignore: 'pid,hostname' } } } });

// 注册Swagger文档
await app.register(swagger, {
  openapi: {
    info: {
      title: 'LearnGrow CRM API',
      description: '乐学长打卡系统API文档 - 教育私域运营管理系统',
      version: APP_VERSION,
    },
    servers: [
      {
        url: 'http://localhost:3456',
        description: '本地开发环境',
      },
      {
        url: 'https://your-production-domain.com',
        description: '生产环境',
      },
    ],
    tags: [
      { name: '认证', description: '用户登录和认证相关接口' },
      { name: '微信用户', description: '微信用户管理接口' },
      { name: '打卡', description: '打卡活动、记录和参与者管理' },
      { name: '订单', description: '订单管理和积分计算' },
      { name: '产品', description: '产品管理接口' },
      { name: '孩子档案', description: '孩子学习档案管理' },
      { name: '微信群', description: '微信群管理接口' },
      { name: '素材库', description: '素材库管理接口' },
      { name: '系统', description: '系统配置和健康检查' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

// Swagger UI 仅非生产环境注册，生产环境不暴露接口文档
if (process.env.NODE_ENV !== 'production') {
  await app.register(swaggerUi, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });
}

await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: JWT_SECRET, sign: { expiresIn: '7d' } });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

// 注册指标收集中间件
app.addHook('onRequest', metricsMiddleware);

await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: '/api/uploads/',
  decorateReply: false,
});

// Keep the path returned by existing check-in records available to clients.
await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: '/uploads/',
  decorateReply: false,
});

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
  });
}

app.get('/api/health', async () => ({ success: true, message: 'ok', version: APP_VERSION }));
app.get('/api/version', async () => ok({ version: APP_VERSION }));

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
      401: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          error: { type: 'string' }
        }
      }
    }
  }
}, async (request, reply) => {
  if (!allowAdminLogin(request, reply)) return;
  const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400 as any).send({ success: false, error: '用户名和密码不能为空' });
  }
  const { username, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) return reply.code(401).send({ success: false, error: '用户名或密码错误' });
  if (!bcrypt.compareSync(password, user.password)) return reply.code(401).send({ success: false, error: '用户名或密码错误' });
  const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role, type: 'admin' });
  return ok({ token, user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
});

app.get('/api/auth/me', { preHandler: [authMiddleware] }, async (request, reply) => {
  const user = db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get((request.user as AuthUser).id) as any;
  if (!user) return reply.code(404).send({ success: false, error: '用户不存在' });
  return ok(user);
});

app.get('/api/dashboard', { preHandler: [authMiddleware] }, async () => {
  const today = bjtToday();
  const yesterday = bjtDaysAgo(1);
  const sevenDaysAgo = bjtDaysAgo(7);
  const thirtyDaysAgo = bjtDaysAgo(30);

  // 核心指标
  const totalWxUsers = (db.prepare('SELECT COUNT(*) as c FROM wx_users').get() as any).c;
  const todayNewWxUsers = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(today) as any).c;
  const yesterdayNewWxUsers = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(yesterday) as any).c;
  
  // 打卡统计
  const totalCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved'").get() as any).c;
  const todayCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND date(checkin_date) = ?").get(today) as any).c;
  const weekCheckins = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND checkin_date >= ?").get(sevenDaysAgo) as any).c;
  
  // 活跃用户数（近 7 天有打卡的去重用户）
  const activeUsers7d = (db.prepare(`
    SELECT COUNT(DISTINCT p.wx_user_id) as c 
    FROM checkin_participants p
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    WHERE r.checkin_date >= ?
  `).get(sevenDaysAgo) as any).c;
  
  // 打卡率 = 今日打卡人数 / 已报名活动用户数
  const todayCheckers = (db.prepare(`
    SELECT COUNT(DISTINCT p.wx_user_id) as c
    FROM checkin_participants p
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    WHERE date(r.checkin_date) = ?
  `).get(today) as any).c;
  const totalParticipants = (db.prepare("SELECT COUNT(DISTINCT wx_user_id) as c FROM checkin_participants").get() as any).c;
  const checkinRate = totalParticipants > 0 ? Math.round((todayCheckers / totalParticipants) * 100 * 100) / 100 : 0;

  // 近 30 天趋势数据
  const newUserTrend = [];
  const checkinTrend = [];
  for (let i = 29; i >= 0; i--) {
    const dateStr = bjtDaysAgo(i);
    const newCount = (db.prepare("SELECT COUNT(*) as c FROM wx_users WHERE date(created_at) = ?").get(dateStr) as any).c;
    const checkinCount = (db.prepare("SELECT COUNT(*) as c FROM checkin_records WHERE status = 'approved' AND date(checkin_date) = ?").get(dateStr) as any).c;
    newUserTrend.push({ date: dateStr.slice(5), count: newCount || 0 });
    checkinTrend.push({ date: dateStr.slice(5), count: checkinCount || 0 });
  }

  // 用户阶段分布
  const stageStatsRaw = db.prepare("SELECT stage, COUNT(*) as count FROM wx_users GROUP BY stage").all() as any[];
  const allStages: CustomerStage[] = ['new_friend', 'initial_chat', 'interested', 'purchased', 'in_group', 'repurchased', 'silent'];
  const stageStats = allStages.map(s => {
    const found = stageStatsRaw.find(r => r.stage === s);
    return { stage: s, count: found ? found.count : 0 };
  });

  // 需跟进用户
  const needFollowWhere = needFollowClause();
  const needFollowRaw = db.prepare(`
    SELECT id, COALESCE(NULLIF(name, ''), nickname, child_name, '') as name, stage, wechat_id, wechat_account, importance, last_follow_date, next_talk_topic
    FROM wx_users
    WHERE ${needFollowWhere.sql}
    ORDER BY CASE importance WHEN 'vip' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             last_follow_date IS NULL DESC,
             last_follow_date ASC
    LIMIT 5
  `).all(...needFollowWhere.params) as any[];

  // 热门打卡活动排行
  const popularActivities = db.prepare(`
    SELECT a.name, 
           COUNT(DISTINCT p.wx_user_id) as participant_count,
           COUNT(r.id) as checkin_count,
           ROUND(CAST(COUNT(r.id) AS FLOAT) / MAX(COUNT(DISTINCT p.wx_user_id), 1), 1) as avg_checkins_per_user
    FROM checkin_events a
    JOIN checkin_participants p ON p.event_id = a.id
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    GROUP BY a.id
    ORDER BY checkin_count DESC
    LIMIT 10
  `).all() as any[];

  // 最新加入的用户
  const recentUsersRaw = db.prepare(`
    SELECT COALESCE(NULLIF(name, ''), nickname, child_name, '') as display_name,
           created_at, source, avatar_url
    FROM wx_users
    ORDER BY created_at DESC
    LIMIT 5
  `).all() as any[];
  
  const recentUsers = recentUsersRaw.map((u: any) => {
    let validAvatarUrl = null;
    if (u.avatar_url) {
      const fileName = u.avatar_url.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        validAvatarUrl = u.avatar_url.replace(/^\/uploads\//, '/api/uploads/');
      }
    }
    return {
      ...u,
      avatar_url: validAvatarUrl,
    };
  });

  // 今日最新打卡记录
  const recentCheckins = db.prepare(`
    SELECT COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') as user_name,
           a.name as activity_name,
           r.checkin_date,
           r.status
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    JOIN wx_users u ON p.wx_user_id = u.id
    JOIN checkin_events a ON p.event_id = a.id
    WHERE date(r.checkin_date) = ?
    ORDER BY r.checkin_date DESC
    LIMIT 10
  `).all(today) as any[];

  // 用户来源渠道分析
  const sourceChannels = db.prepare(`
    SELECT source as channel, COUNT(*) as count
    FROM wx_users
    WHERE source IS NOT NULL AND source != ''
    GROUP BY source
    ORDER BY count DESC
  `).all() as any[];

  // 打卡达人榜
  const topCheckinUsersRaw = db.prepare(`
    SELECT u.id, 
           COALESCE(NULLIF(u.name, ''), u.nickname, '') as display_name,
           u.child_name,
           u.avatar_url,
           COUNT(r.id) as checkin_count
    FROM wx_users u
    JOIN checkin_participants p ON p.wx_user_id = u.id
    JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
    GROUP BY u.id
    ORDER BY checkin_count DESC
    LIMIT 10
  `).all() as any[];
  
  const topCheckinUsers = topCheckinUsersRaw.map((u: any) => {
    // 检查头像文件是否真实存在
    let validAvatarUrl = null;
    if (u.avatar_url) {
      const fileName = u.avatar_url.replace('/uploads/', '');
      const filePath = path.join(uploadsDir, fileName);
      if (fs.existsSync(filePath)) {
        validAvatarUrl = u.avatar_url.replace(/^\/uploads\//, '/api/uploads/');
      }
    }
    return {
      ...u,
      avatar_url: validAvatarUrl,
    };
  });

  return ok({
    stats: {
      total_wx_users: totalWxUsers,
      today_new_wx_users: todayNewWxUsers,
      yesterday_new_wx_users: yesterdayNewWxUsers,
      total_checkins: totalCheckins,
      today_checkins: todayCheckins,
      week_checkins: weekCheckins,
      active_users_7d: activeUsers7d,
      checkin_rate: checkinRate,
      total_participants: totalParticipants,
    },
    stageStats,
    needFollowUsers: needFollowRaw.map(c => ({
      ...c,
      stage: c.stage || 'new_friend',
      wechat_account: c.wechat_account || 'main',
    })),
    newUserTrend,
    checkinTrend,
    popularActivities,
    recentUsers,
    recentCheckins,
    sourceChannels,
    topCheckinUsers,
  } satisfies DashboardData);
});

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  const DISPLAY_NAME = "COALESCE(NULLIF(name, ''), nickname, child_name, '')";

  const SEARCH_COLS = '(name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR child_name LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)';
  /** 占位符个数跟着 SEARCH_COLS 走，增删可搜字段不用再改第二处 */
  const SEARCH_PLACEHOLDERS = (SEARCH_COLS.match(/\?/g) || []).length;

  interface WxUserQuery { search?: string; importance?: string; stage?: string; need_follow?: string; tag?: string; page?: string; limit?: string; sort?: string; dir?: string }

  /** 每人报名过几次活动、打过几次卡（只算审核通过的）、最近一次打卡在哪天 */
  const ACTIVITY_JOIN = `
    LEFT JOIN (
      SELECT p.wx_user_id AS uid,
             COUNT(DISTINCT p.id) AS signup_count,
             COUNT(r.id) AS checkin_count,
             MAX(r.checkin_date) AS last_checkin_date
      FROM checkin_participants p
      LEFT JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
      WHERE p.wx_user_id IS NOT NULL
      GROUP BY p.wx_user_id
    ) act ON act.uid = u.id`;

  /** 列头可点的排序：键名 -> 排序表达式、默认方向、次级排序键 */
  const SORTS: Record<string, { by: string; dir: 'ASC' | 'DESC'; then: string }> = {
    activity: { by: 'MAX(COALESCE(substr(u.last_login_at, 1, 10), \'\'), COALESCE(act.last_checkin_date, \'\'))', dir: 'DESC', then: 'COALESCE(act.checkin_count, 0) DESC' },
    joined: { by: 'u.created_at', dir: 'DESC', then: 'u.id DESC' },
    points: { by: 'u.points', dir: 'DESC', then: 'u.id DESC' },
  };

  function buildWhere(f: WxUserQuery): { sql: string; params: any[] } {
    let sql = ' WHERE 1=1';
    const params: any[] = [];
    if (f.search) { sql += ` AND ${SEARCH_COLS}`; params.push(...Array(SEARCH_PLACEHOLDERS).fill(`%${f.search}%`)); }
    if (f.importance) { sql += ' AND importance = ?'; params.push(f.importance); }
    if (f.stage) { sql += ' AND stage = ?'; params.push(f.stage); }
    if (f.need_follow === 'true') { const nf = needFollowClause(); sql += ` AND ${nf.sql}`; params.push(...nf.params); }
    if (f.tag) { sql += ' AND tags LIKE ?'; params.push(`%"${f.tag}"%`); }
    return { sql, params };
  }

  router.get('/', async (request: any) => {
    const active = (request.query || {}) as WxUserQuery;
    const pageNum = parseInt(active.page || '1'), limitNum = parseInt(active.limit || '20'), offset = (pageNum - 1) * limitNum;
    const { sql: where, params } = buildWhere(active);
    const total = (db.prepare(`SELECT COUNT(*) as total FROM wx_users${where}`).get(...params) as any).total;
    const sort = SORTS[active.sort || 'activity'] || SORTS.activity;
    const dir = active.dir === 'asc' ? 'ASC' : active.dir === 'desc' ? 'DESC' : sort.dir;
    const rows = (db.prepare(
      `SELECT u.*, ${DISPLAY_NAME} AS display_name,
              COALESCE(act.signup_count, 0) AS signup_count,
              COALESCE(act.checkin_count, 0) AS checkin_count,
              act.last_checkin_date AS last_checkin_date
       FROM wx_users u${ACTIVITY_JOIN}${where}
       ORDER BY ${sort.by} ${dir}, ${sort.then}, u.id DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset) as any[]).map(mapWxUser);

    // 每个选项的命中人数：应用其他条件、忽略该选项自身的限制，这样计数随筛选联动
    const groupCount = (col: 'importance' | 'stage') => {
      const q = buildWhere({ ...active, [col]: undefined });
      const grouped = db.prepare(`SELECT ${col} AS k, COUNT(*) AS c FROM wx_users${q.sql} GROUP BY ${col}`).all(...q.params) as { k: string | null; c: number }[];
      const out: Record<string, number> = {};
      for (const g of grouped) if (g.k) out[g.k] = g.c;
      return out;
    };
    const nfQuery = buildWhere({ ...active, need_follow: 'true' });
    const needFollowCount = (db.prepare(`SELECT COUNT(*) AS c FROM wx_users${nfQuery.sql}`).get(...nfQuery.params) as any).c;

    return ok({
      users: rows,
      total,
      facets: { importance: groupCount('importance'), stage: groupCount('stage'), need_follow: needFollowCount },
    });
  });

  router.get('/all-tags', async () => {
    const all = db.prepare('SELECT tags FROM wx_users').all() as any[];
    const tagSet = new Set<string>();
    all.forEach(c => parseJson(c.tags, [] as string[]).forEach((t: string) => tagSet.add(t)));
    return ok(Array.from(tagSet).sort());
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const row = db.prepare(`SELECT *, ${DISPLAY_NAME} AS display_name FROM wx_users WHERE id = ?`).get(id) as any;
    if (!row) return reply.code(404).send({ success: false, error: '用户不存在' });
    const user = mapWxUser(row);
    const ordersRaw = db.prepare(`SELECT o.*, p.name as product_name, p.tier as product_tier FROM orders o JOIN products p ON o.product_id = p.id WHERE o.wx_user_id = ? ORDER BY o.purchase_date DESC`).all(id) as any[];
    const followUps = (db.prepare('SELECT * FROM follow_ups WHERE wx_user_id = ? ORDER BY date DESC, created_at DESC').all(id) as any[]).map(mapFollowUp);
    const children = (db.prepare('SELECT * FROM children WHERE wx_user_id = ? ORDER BY created_at DESC').all(id) as any[]).map((ch: any) => ({
      ...ch,
      weak_subjects: parseJson<string[]>(ch.weak_subjects, []),
    }));
    return ok({ ...user, children, orders: ordersRaw as OrderWithProduct[], follow_ups: followUps, suggestions: getWxUserSuggestions(id, user) } satisfies WxUser360);
  });

  router.post('/', async (request: any, reply: any) => {
    const { name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account = 'main', douyin_nickname, source, importance = 'normal', stage = 'new_friend', tags = [], remark, next_talk_topic } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '备注名不能为空' });
    const r = db.prepare(`INSERT INTO wx_users (openid, name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, tags, remark, next_talk_topic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      `manual_${randomUUID()}`, name, nickname || null, phone || null, wechat_id || null, wechat_remark || null, wechat_add_date || null, wechat_account, douyin_nickname || null, source || 'other', importance, stage, JSON.stringify(tags), remark || null, next_talk_topic || null
    );
    return reply.code(201).send(ok(mapWxUser(db.prepare('SELECT * FROM wx_users WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '用户不存在' });
    const { name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, tags, remark, next_talk_topic } = request.body;
    const fields: string[] = [], params: any[] = [];
    const editable = { name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, remark, next_talk_topic };
    for (const [key, value] of Object.entries(editable)) {
      if (value !== undefined) { fields.push(`${key} = ?`); params.push(value); }
    }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE wx_users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapWxUser(db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id)));
  });

  // v2.7.0: 使用新的用户删除服务（支持级联删除和审计日志）
  router.delete('/:id', async (request: any, reply: any) => {
    const { registerUserDeleteRoutes } = await import('./routes/user-delete.routes.js');
    // 注意: 这里简化处理，实际应该直接在主路由中注册
    const id = parseInt(request.params.id);
    const user = (request as any).user;
    
    if (!user || user.role !== 'admin') {
      return reply.code(403).send({ success: false, error: '需要管理员权限' });
    }
    
    const { deleteUser } = await import('./services/user-delete.service.js');
    const result = await deleteUser(id, false, user);
    
    if (!result.success) {
      return reply.code(404).send({ success: false, error: result.error });
    }
    
    return reply.send({ 
      success: true, 
      data: {
        user_id: result.user_id,
        cascade_deleted: result.cascade_deleted
      }
    });
  });

  router.post('/:id/follow-ups', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { method, content, result, next_follow_date, is_live_note = false, child_id } = request.body;
    if (!method || !content) return reply.code(400).send({ success: false, error: '方式和内容不能为空' });
    const r = db.prepare('INSERT INTO follow_ups (wx_user_id, child_id, method, content, result, next_follow_date, is_live_note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, child_id || null, method, content, result || null, next_follow_date || null, is_live_note ? 1 : 0);
    updateWxUserStats(id);
    return reply.code(201).send(ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.post('/:id/orders', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { product_id, amount, order_type, remark, shipping_note, child_id } = request.body;
    if (!product_id) return reply.code(400).send({ success: false, error: '请选择产品' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!product) return reply.code(400).send({ success: false, error: '产品不存在' });
    const finalAmount = amount || product.price;
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE wx_user_id = ?').get(id) as any).c;
    const finalType = order_type || (existingCount === 0 ? 'first' : 'repurchase');
    const r = db.prepare("INSERT INTO orders (order_no, wx_user_id, child_id, product_id, amount, order_type, remark, shipping_note, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))").run(generateOrderNo(), id, child_id || null, product_id, finalAmount, finalType, remark || null, shipping_note || null);
    const earned = Math.floor(finalAmount * getIntSetting('points_order_rate'));
    if (earned > 0) grantOrderPoints(id, r.lastInsertRowid as number, earned);
    updateWxUserStats(id);
    updateProductSales(product_id);
    return reply.code(201).send(ok(db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.get('/:id/suggestions', async (request: any) => {
    const id = parseInt(request.params.id);
    return ok(getWxUserSuggestions(id, mapWxUser(db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id))));
  });

  router.put('/:id/tags', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '用户不存在' });
    const { tags } = request.body;
    db.prepare("UPDATE wx_users SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(tags || []), id);
    return ok(mapWxUser(db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id)));
  });

  router.put('/:id/importance', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wx_users WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '用户不存在' });
    const { importance } = request.body;
    if (!['vip', 'normal', 'watch'].includes(importance)) return reply.code(400).send({ success: false, error: '重要性值无效' });
    db.prepare("UPDATE wx_users SET importance = ?, updated_at = datetime('now') WHERE id = ?").run(importance, id);
    return ok(mapWxUser(db.prepare('SELECT * FROM wx_users WHERE id = ?').get(id)));
  });
}, { prefix: '/api/wx-users' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { tier, category, page = '1', limit = '50' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    let sql = 'SELECT * FROM products WHERE 1=1', params: any[] = [];
    if (tier) { sql += ' AND tier = ?'; params.push(tier); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    sql += " ORDER BY CASE tier WHEN 'traffic' THEN 1 WHEN 'main' THEN 2 ELSE 3 END, sales_count DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);
    const products = (db.prepare(sql).all(...params) as any[]).map(mapProduct);
    let countSql = 'SELECT COUNT(*) as total FROM products WHERE 1=1', cparams: any[] = [];
    if (tier) { countSql += ' AND tier = ?'; cparams.push(tier); }
    if (category) { countSql += ' AND category = ?'; cparams.push(category); }
    return ok({ products, total: (db.prepare(countSql).get(...cparams) as any).total });
  });

  router.get('/all', async () => ok((db.prepare('SELECT id, name, price, tier FROM products WHERE is_on_sale = 1 ORDER BY name').all() as any[]).map(mapProduct)));

  router.post('/', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const { name, tier = 'main', category, price, commission_percent = 0, selling_points, related_product_ids = [], description, is_on_sale = true } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '商品名不能为空' });
    const r = db.prepare('INSERT INTO products (name, tier, category, price, commission_percent, selling_points, related_product_ids, description, is_on_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, tier, category || null, price || 0, commission_percent || 0, selling_points || null, JSON.stringify(related_product_ids), description || null, is_on_sale ? 1 : 0);
    return reply.code(201).send(ok(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '商品不存在' });
    const { name, tier, category, price, commission_percent, selling_points, related_product_ids, description, is_on_sale } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (tier !== undefined) { fields.push('tier = ?'); params.push(tier); }
    if (category !== undefined) { fields.push('category = ?'); params.push(category); }
    if (price !== undefined) { fields.push('price = ?'); params.push(price); }
    if (commission_percent !== undefined) { fields.push('commission_percent = ?'); params.push(commission_percent); }
    if (selling_points !== undefined) { fields.push('selling_points = ?'); params.push(selling_points); }
    if (related_product_ids !== undefined) { fields.push('related_product_ids = ?'); params.push(JSON.stringify(related_product_ids)); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (is_on_sale !== undefined) { fields.push('is_on_sale = ?'); params.push(is_on_sale ? 1 : 0); }
    params.push(id);
    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)));
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any) => { db.prepare('DELETE FROM products WHERE id = ?').run(parseInt(request.params.id)); return ok(null); });
}, { prefix: '/api/products' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/', async (request: any) => {
    const { wx_user_id, customer_id, page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    let sql = `SELECT o.*, COALESCE(NULLIF(c.name, ''), c.nickname, c.child_name, '') as wx_user_name, p.name as product_name, p.tier as product_tier FROM orders o JOIN wx_users c ON o.wx_user_id = c.id JOIN products p ON o.product_id = p.id WHERE 1=1`, params: any[] = [];
    const owner = wx_user_id || customer_id;
    if (owner) { sql += ' AND o.wx_user_id = ?'; params.push(owner); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'; params.push(limitNum, offset);
    return ok({ orders: db.prepare(sql).all(...params), total: (db.prepare('SELECT COUNT(*) as total FROM orders').get() as any).total });
  });
  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any) => {
    const id = parseInt(request.params.id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    if (order) {
      revokeByRef(order.wx_user_id, 'order', id);
      updateWxUserStats(order.wx_user_id);
      updateProductSales(order.product_id);
    }
    return ok(null);
  });
}, { prefix: '/api/orders' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/customer/:cid', async (request: any) => ok((db.prepare('SELECT * FROM follow_ups WHERE wx_user_id = ? ORDER BY date DESC, created_at DESC').all(parseInt(request.params.cid)) as any[]).map(mapFollowUp)));
  router.get('/wx-user/:uid', async (request: any) => ok((db.prepare('SELECT * FROM follow_ups WHERE wx_user_id = ? ORDER BY date DESC, created_at DESC').all(parseInt(request.params.uid)) as any[]).map(mapFollowUp)));
  router.get('/', async (request: any) => {
    const { page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    return ok({ follow_ups: (db.prepare(`SELECT f.*, COALESCE(NULLIF(c.name, ''), c.nickname, c.child_name, '') as wx_user_name FROM follow_ups f JOIN wx_users c ON f.wx_user_id = c.id ORDER BY f.date DESC, f.created_at DESC LIMIT ? OFFSET ?`).all(limitNum, offset) as any[]).map(mapFollowUp) });
  });
  router.put('/:id', async (request: any) => {
    const id = parseInt(request.params.id);
    const { method, content, result, date, next_follow_date } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (method !== undefined) { fields.push('method = ?'); params.push(method); }
    if (content !== undefined) { fields.push('content = ?'); params.push(content); }
    if (result !== undefined) { fields.push('result = ?'); params.push(result); }
    if (date !== undefined) { fields.push('date = ?'); params.push(date); }
    if (next_follow_date !== undefined) { fields.push('next_follow_date = ?'); params.push(next_follow_date); }
    params.push(id);
    db.prepare(`UPDATE follow_ups SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(id)));
  });
  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any) => {
    const id = parseInt(request.params.id);
    const f = db.prepare('SELECT wx_user_id FROM follow_ups WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM follow_ups WHERE id = ?').run(id);
    if (f) updateWxUserStats(f.wx_user_id);
    return ok(null);
  });
}, { prefix: '/api/follow-ups' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.addHook('preHandler', adminOnly);
  router.get('/', async () => ok(db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at DESC').all()));
  router.post('/', async (request: any, reply: any) => {
    const { username, password, role = 'assistant', display_name } = request.body;
    if (!username || !password) return reply.code(400).send({ success: false, error: '用户名和密码不能为空' });
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return reply.code(409).send({ success: false, error: '用户名已存在' });
    const r = db.prepare('INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)').run(username, bcrypt.hashSync(password, 10), role, display_name || null);
    return reply.code(201).send(ok(db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get(r.lastInsertRowid)));
  });
  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '用户不存在' });
    const { password, role, display_name } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (password) { fields.push('password = ?'); params.push(bcrypt.hashSync(password, 10)); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (display_name !== undefined) { fields.push('display_name = ?'); params.push(display_name); }
    if (fields.length > 0) {
      params.push(id);
      db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }
    return ok(db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get(id));
  });
  router.delete('/:id', async (request: any) => { db.prepare('DELETE FROM users WHERE id = ?').run(parseInt(request.params.id)); return ok(null); });
}, { prefix: '/api/users' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/todos', async () => ok(getTodos()));
}, { prefix: '/api/actions' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/search', async (request: any) => {
    const q = (request.query as any).q || '';
    if (!q || q.length < 1) return ok([]);
    const users = (db.prepare('SELECT * FROM wx_users WHERE name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR douyin_nickname LIKE ? LIMIT 20').all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as any[]).map(mapWxUser);
    const results: LiveCustomerCard[] = [];
    for (const u of users) {
      const recentOrders = db.prepare('SELECT p.name as product_name, o.purchase_date, o.amount FROM orders o JOIN products p ON o.product_id = p.id WHERE o.wx_user_id = ? ORDER BY o.purchase_date DESC LIMIT 3').all(u.id) as any[];
      const recentFollowUp = db.prepare('SELECT content, date FROM follow_ups WHERE wx_user_id = ? ORDER BY date DESC LIMIT 1').get(u.id) as any;
      const children = db.prepare('SELECT id, nickname, grade FROM children WHERE wx_user_id = ? ORDER BY created_at DESC').all(u.id) as any[];
      results.push({ id: u.id, name: displayName(u), nickname: u.nickname, avatar: u.avatar_url, importance: u.importance, tags: u.tags, total_spent: u.total_spent, order_count: u.order_count, last_order_date: u.last_order_date, last_follow_date: u.last_follow_date, recent_orders: recentOrders, recent_follow_up: recentFollowUp ? { content: recentFollowUp.content, date: recentFollowUp.date } : null, suggestions: getWxUserSuggestions(u.id, u).slice(0, 2), children: children.length > 0 ? children : undefined });
    }
    return ok(results);
  });
  router.post('/quick-note', async (request: any, reply: any) => {
    const { wx_user_id, customer_id, content, child_id } = request.body;
    const owner = wx_user_id || customer_id;
    if (!owner || !content) return reply.code(400).send({ success: false, error: '用户和内容不能为空' });
    const r = db.prepare("INSERT INTO follow_ups (wx_user_id, child_id, method, content, is_live_note) VALUES (?, ?, 'live', ?, 1)").run(owner, child_id || null, content);
    updateWxUserStats(owner);
    return reply.code(201).send(ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid))));
  });
}, { prefix: '/api/live' });

function mapGroup(g: any): WechatGroup {
  return { ...g, tags: parseJson(g.tags, [] as string[]) };
}

function mapGroupMember(m: any): WechatGroupMember {
  return { ...m, tags: parseJson(m.tags, [] as string[]) };
}

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { status, search } = request.query as any;
    let sql = 'SELECT * FROM wechat_groups WHERE 1=1';
    const params: any[] = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (search) { sql += ' AND (name LIKE ? OR purpose LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY created_at DESC';
    const groups = (db.prepare(sql).all(...params) as any[]).map(mapGroup);
    return ok({ groups, total: groups.length });
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const g = db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(id);
    if (!g) return reply.code(404).send({ success: false, error: '群不存在' });
    const group = mapGroup(g);
    const members = (db.prepare('SELECT * FROM wechat_group_members WHERE group_id = ? ORDER BY activity_score DESC, created_at DESC').all(id) as any[]).map(mapGroupMember);
    group.active_members = members;
    return ok(group);
  });

  router.post('/', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const { name, purpose, description, member_count = 0, status = 'active', tags = [], group_rules, owner_note, notes } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '群名称不能为空' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO wechat_groups (name, purpose, description, member_count, status, tags, group_rules, owner_note, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, purpose || null, description || null, member_count || 0, status, JSON.stringify(tags), group_rules || null, owner_note || null, notes || null, now, now);
    return reply.code(201).send(ok(mapGroup(db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '群不存在' });
    const { name, purpose, description, member_count, status, tags, group_rules, owner_note, notes } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (purpose !== undefined) { fields.push('purpose = ?'); params.push(purpose); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (member_count !== undefined) { fields.push('member_count = ?'); params.push(member_count); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (group_rules !== undefined) { fields.push('group_rules = ?'); params.push(group_rules); }
    if (owner_note !== undefined) { fields.push('owner_note = ?'); params.push(owner_note); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE wechat_groups SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapGroup(db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(id)));
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '群不存在' });
    db.prepare('DELETE FROM wechat_group_members WHERE group_id = ?').run(id);
    db.prepare('DELETE FROM wechat_groups WHERE id = ?').run(id);
    return ok(null);
  });

  router.post('/:id/members/batch', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.code(404).send({ success: false, error: '群不存在' });
    const { names, role = 'new' } = request.body;
    if (!names || !Array.isArray(names) || names.length === 0) return reply.code(400).send({ success: false, error: '请输入要导入的昵称列表' });
    
    const insertMember = db.prepare(`
      INSERT OR IGNORE INTO wechat_group_members (group_id, wechat_name, role, tags, activity_score)
      VALUES (?, ?, ?, '[]', 50)
    `);
    
    let added = 0, skipped = 0;
    const insertMany = db.transaction(() => {
      for (const name of names) {
        const trimmed = String(name).trim();
        if (!trimmed) { skipped++; continue; }
        const existing = db.prepare('SELECT id FROM wechat_group_members WHERE group_id = ? AND wechat_name = ?').get(groupId, trimmed);
        if (existing) { skipped++; continue; }
        insertMember.run(groupId, trimmed, role);
        added++;
      }
    });
    insertMany();
    
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    
    return ok({ added, skipped, total: names.length });
  });

  router.post('/:id/members', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.code(404).send({ success: false, error: '群不存在' });
    const { wechat_name, nickname, role = 'active', tags = [], wx_user_id, activity_score = 50, remark } = request.body;
    if (!wechat_name) return reply.code(400).send({ success: false, error: '微信昵称不能为空' });
    const r = db.prepare(`
      INSERT INTO wechat_group_members (group_id, wechat_name, nickname, role, tags, wx_user_id, activity_score, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, wechat_name, nickname || null, role, JSON.stringify(tags), wx_user_id || null, activity_score || 50, remark || null);
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    return reply.code(201).send(ok(mapGroupMember(db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id/members/:memberId', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    const memberId = parseInt(request.params.memberId);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.code(404).send({ success: false, error: '群不存在' });
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.code(404).send({ success: false, error: '成员不存在' });
    const { wechat_name, nickname, role, tags, wx_user_id, activity_score, remark } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (wechat_name !== undefined) { fields.push('wechat_name = ?'); params.push(wechat_name); }
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (wx_user_id !== undefined) { fields.push('wx_user_id = ?'); params.push(wx_user_id); }
    if (activity_score !== undefined) { fields.push('activity_score = ?'); params.push(activity_score); }
    if (remark !== undefined) { fields.push('remark = ?'); params.push(remark); }
    params.push(memberId);
    db.prepare(`UPDATE wechat_group_members SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapGroupMember(db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(memberId)));
  });

  router.delete('/:id/members/:memberId', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    const memberId = parseInt(request.params.memberId);
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.code(404).send({ success: false, error: '成员不存在' });
    db.prepare('DELETE FROM wechat_group_members WHERE id = ?').run(memberId);
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    return ok(null);
  });
}, { prefix: '/api/wechat-groups' });

/** 本地时区的 YYYY-MM-DD：toISOString 会把深夜的北京时间算到前一天，日期字段不能用它 */
function localDateText(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapChild(ch: any): Child {
  return { ...ch, weak_subjects: parseJson<string[]>(ch.weak_subjects, []) };
}

function mapPath(p: any): LearningPath {
  return { ...p, is_active: !!p.is_active };
}

function mapStage(s: any): LearningStage {
  return { ...s, target_product_ids: parseJson<number[]>(s.target_product_ids, []) };
}

function mapProgress(pr: any): ChildLearningProgress {
  return pr;
}

function mapTextbook(t: any): Textbook {
  return { ...t, is_default: !!t.is_default };
}

function mapMaterial(m: any): Material {
  return {
    ...m,
    tags: parseJson(m.tags, [] as string[]),
    url: `/uploads/${m.filename}`,
  };
}

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { wx_user_id, customer_id } = request.query as any;
    const owner = wx_user_id || customer_id;
    if (!owner) return ok([]);
    return ok((db.prepare('SELECT * FROM children WHERE wx_user_id = ? ORDER BY created_at DESC').all(parseInt(owner)) as any[]).map(mapChild));
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const ch = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as any;
    if (!ch) return reply.code(404).send({ success: false, error: '孩子不存在' });
    const child = mapChild(ch);
    const progressRaw = db.prepare(`
      SELECT cp.*, lp.name as path_name, ls.name as current_stage_name
      FROM child_learning_progress cp
      JOIN learning_paths lp ON cp.path_id = lp.id
      LEFT JOIN learning_stages ls ON cp.current_stage_id = ls.id
      WHERE cp.child_id = ?
      ORDER BY cp.updated_at DESC
    `).all(id) as any[];
    const progress = progressRaw.map(mapProgress);
    const ordersRaw = db.prepare(`
      SELECT o.*, p.name as product_name, p.tier as product_tier
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.child_id = ?
      ORDER BY o.purchase_date DESC
    `).all(id) as any[];
    const orders = ordersRaw;
    const followUpsRaw = db.prepare(`
      SELECT * FROM follow_ups WHERE child_id = ? ORDER BY date DESC
    `).all(id) as any[];
    const follow_ups = followUpsRaw.map(mapFollowUp);
    return ok({ ...child, learning_progress: progress, orders, follow_ups } satisfies ChildWithProgress);
  });

  router.post('/', async (request: any, reply: any) => {
    const { wx_user_id, customer_id, nickname, gender, birth_date, grade, region, textbook_version, weak_subjects = [], notes } = request.body;
    const owner = wx_user_id || customer_id;
    if (!owner || !nickname || !grade) return reply.code(400).send({ success: false, error: '家长ID、昵称和年级不能为空' });
    if (!db.prepare('SELECT id FROM wx_users WHERE id = ?').get(owner)) return reply.code(404).send({ success: false, error: '用户不存在' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO children (wx_user_id, nickname, gender, birth_date, grade, grade_as_of, region, textbook_version, weak_subjects, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(owner, nickname, gender || null, birth_date || null, grade, localDateText(), region || null, textbook_version || null, JSON.stringify(weak_subjects), notes || null, now, now);
    return reply.code(201).send(ok(mapChild(db.prepare('SELECT * FROM children WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const stored = db.prepare('SELECT id, grade FROM children WHERE id = ?').get(id) as any;
    if (!stored) return reply.code(404).send({ success: false, error: '孩子不存在' });
    const { nickname, gender, birth_date, grade, region, textbook_version, weak_subjects, notes, confirm_grade } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (gender !== undefined) { fields.push('gender = ?'); params.push(gender); }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); params.push(birth_date); }
    // 只在年级真的换过时续确认日期；否则改个备注就会把「待确认」提示悄悄抹掉
    if (grade !== undefined && grade !== stored.grade) {
      fields.push('grade = ?'); params.push(grade);
      fields.push('grade_as_of = ?'); params.push(localDateText());
    } else if (confirm_grade) {
      fields.push('grade_as_of = ?'); params.push(localDateText());
    }
    if (region !== undefined) { fields.push('region = ?'); params.push(region); }
    if (textbook_version !== undefined) { fields.push('textbook_version = ?'); params.push(textbook_version); }
    if (weak_subjects !== undefined) { fields.push('weak_subjects = ?'); params.push(JSON.stringify(weak_subjects)); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapChild(db.prepare('SELECT * FROM children WHERE id = ?').get(id)));
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '孩子不存在' });
    db.prepare('DELETE FROM child_learning_progress WHERE child_id = ?').run(id);
    db.prepare('DELETE FROM children WHERE id = ?').run(id);
    return ok(null);
  });

  router.post('/:id/progress', async (request: any, reply: any) => {
    const childId = parseInt(request.params.id);
    const { path_id } = request.body;
    if (!path_id) return reply.code(400).send({ success: false, error: '请选择学习路径' });
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(childId)) return reply.code(404).send({ success: false, error: '孩子不存在' });
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(path_id)) return reply.code(404).send({ success: false, error: '学习路径不存在' });
    const existing = db.prepare('SELECT id FROM child_learning_progress WHERE child_id = ? AND path_id = ?').get(childId, path_id);
    if (existing) return reply.code(409).send({ success: false, error: '该学习路径已添加' });
    const firstStage = db.prepare('SELECT id FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC LIMIT 1').get(path_id) as any;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO child_learning_progress (child_id, path_id, current_stage_id, status, start_date, updated_at)
      VALUES (?, ?, ?, 'in_progress', date('now'), ?)
    `).run(childId, path_id, firstStage?.id || null, now);
    return reply.code(201).send(ok(mapProgress(db.prepare('SELECT * FROM child_learning_progress WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id/progress/:progressId/advance', async (request: any, reply: any) => {
    const childId = parseInt(request.params.id);
    const progressId = parseInt(request.params.progressId);
    const { completed_date, notes, next_stage_id } = request.body;
    const progress = db.prepare('SELECT * FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId) as any;
    if (!progress) return reply.code(404).send({ success: false, error: '进度记录不存在' });
    let nextStageId = next_stage_id;
    let status = progress.status;
    if (nextStageId === undefined && progress.current_stage_id) {
      const stages = db.prepare('SELECT id, order_index FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC').all(progress.path_id) as any[];
      const currentIdx = stages.findIndex(s => s.id === progress.current_stage_id);
      if (currentIdx >= 0 && currentIdx < stages.length - 1) {
        nextStageId = stages[currentIdx + 1].id;
      } else {
        nextStageId = null;
        status = 'completed';
      }
    }
    const fields: string[] = [], params: any[] = [];
    if (completed_date !== undefined) { fields.push('completed_date = ?'); params.push(completed_date); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
    fields.push('current_stage_id = ?'); params.push(nextStageId || null);
    fields.push('status = ?'); params.push(status);
    fields.push("updated_at = datetime('now')");
    params.push(progressId);
    db.prepare(`UPDATE child_learning_progress SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapProgress(db.prepare('SELECT * FROM child_learning_progress WHERE id = ?').get(progressId)));
  });

  router.delete('/:id/progress/:progressId', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const childId = parseInt(request.params.id);
    const progressId = parseInt(request.params.progressId);
    if (!db.prepare('SELECT id FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId)) return reply.code(404).send({ success: false, error: '进度记录不存在' });
    db.prepare('DELETE FROM child_learning_progress WHERE id = ?').run(progressId);
    return ok(null);
  });
}, { prefix: '/api/children' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { subject, is_active } = request.query as any;
    let sql = 'SELECT * FROM learning_paths WHERE 1=1', params: any[] = [];
    if (subject) { sql += ' AND subject = ?'; params.push(subject); }
    if (is_active !== undefined) { sql += ' AND is_active = ?'; params.push(is_active === 'true' ? 1 : 0); }
    sql += ' ORDER BY created_at DESC';
    const paths = (db.prepare(sql).all(...params) as any[]).map(mapPath);
    for (const p of paths) {
      (p as any).stages = (db.prepare('SELECT * FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC').all(p.id) as any[]).map(mapStage);
    }
    return ok(paths);
  });

  router.post('/', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const { name, subject, description, is_active = true, stages = [] } = request.body;
    if (!name || !subject) return reply.code(400).send({ success: false, error: '名称和学科不能为空' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO learning_paths (name, subject, description, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, subject, description || null, is_active ? 1 : 0, now, now);
    const pathId = r.lastInsertRowid as number;
    const insertStage = db.prepare(`
      INSERT INTO learning_stages (path_id, order_index, name, description, duration_days, target_product_ids, key_milestones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStages = db.transaction((stagesList: any[]) => {
      stagesList.forEach((s, i) => {
        insertStage.run(pathId, i, s.name, s.description || null, s.duration_days || null, JSON.stringify(s.target_product_ids || []), s.key_milestones || null);
      });
    });
    if (stages.length > 0) insertStages(stages);
    const path = mapPath(db.prepare('SELECT * FROM learning_paths WHERE id = ?').get(pathId));
    (path as any).stages = (db.prepare('SELECT * FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC').all(pathId) as any[]).map(mapStage);
    return reply.code(201).send(ok(path));
  });

  router.put('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '学习路径不存在' });
    const { name, subject, description, is_active, stages } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (subject !== undefined) { fields.push('subject = ?'); params.push(subject); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE learning_paths SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    if (stages !== undefined) {
      db.prepare('DELETE FROM learning_stages WHERE path_id = ?').run(id);
      const insertStage = db.prepare(`
        INSERT INTO learning_stages (path_id, order_index, name, description, duration_days, target_product_ids, key_milestones)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stages.forEach((s: any, i: number) => {
        insertStage.run(id, i, s.name, s.description || null, s.duration_days || null, JSON.stringify(s.target_product_ids || []), s.key_milestones || null);
      });
    }
    const path = mapPath(db.prepare('SELECT * FROM learning_paths WHERE id = ?').get(id));
    (path as any).stages = (db.prepare('SELECT * FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC').all(id) as any[]).map(mapStage);
    return ok(path);
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '学习路径不存在' });
    db.prepare('DELETE FROM child_learning_progress WHERE path_id = ?').run(id);
    db.prepare('DELETE FROM learning_stages WHERE path_id = ?').run(id);
    db.prepare('DELETE FROM learning_paths WHERE id = ?').run(id);
    return ok(null);
  });
}, { prefix: '/api/learning-paths' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/regions', async () => {
    const regions = db.prepare('SELECT DISTINCT region FROM textbooks ORDER BY region').all() as { region: string }[];
    return ok(regions.map(r => r.region));
  });

  router.get('/', async (request: any) => {
    const { region } = request.query as any;
    let sql = 'SELECT * FROM textbooks WHERE 1=1', params: any[] = [];
    if (region) { sql += ' AND region = ?'; params.push(region); }
    sql += ' ORDER BY region, subject, grade';
    return ok((db.prepare(sql).all(...params) as any[]).map(mapTextbook));
  });
}, { prefix: '/api/textbooks' });

function calculateStreaks(records: { checkin_date: string; is_makeup?: number | boolean }[], startDate: string, endDate: string, makeupCountsForStreak = false) {
  const dateSet = new Set(records.map(r => r.checkin_date));
  const streakDateSet = new Set(records.filter(r => makeupCountsForStreak || !r.is_makeup).map(r => r.checkin_date));
  const checkedDates = Array.from(dateSet).sort();
  
  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;
  
  const today = bjtToday();
  const end = endDate < today ? endDate : today;
  
  let d = new Date(startDate);
  const endD = new Date(end);
  const allDates: string[] = [];
  while (d <= endD) {
    allDates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  
  for (let i = allDates.length - 1; i >= 0; i--) {
    if (streakDateSet.has(allDates[i])) {
      tempStreak++;
      if (i === allDates.length - 1 || currentStreak > 0) {
        currentStreak = tempStreak;
      }
    } else {
      if (currentStreak === 0 && i === allDates.length - 1) {
      } else {
        break;
      }
      tempStreak = 0;
    }
  }
  
  tempStreak = 0;
  for (const dateStr of allDates) {
    if (streakDateSet.has(dateStr)) {
      tempStreak++;
      maxStreak = Math.max(maxStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }
  
  return { checkin_days: checkedDates.length, current_streak: currentStreak, max_streak: maxStreak, checked_dates: checkedDates };
}

function normalizeBoolean(value: any): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function dateDiffDays(later: string, earlier: string): number {
  const laterDate = new Date(`${later}T00:00:00`);
  const earlierDate = new Date(`${earlier}T00:00:00`);
  return Math.round((laterDate.getTime() - earlierDate.getTime()) / 86400000);
}

function getMakeupRuleError(event: any, participantId: number, checkinDate: string, today: string) {
  if (!event.allow_makeup) return '本活动不支持补卡';
  if (checkinDate >= today) return '只能补过去漏打的日期';
  if (checkinDate < event.start_date || checkinDate > event.end_date) return '补卡日期不在活动范围内';

  const windowDays = Number(event.makeup_window_days || 0);
  if (windowDays <= 0 || dateDiffDays(today, checkinDate) > windowDays) {
    return `只能补最近${windowDays || 0}天内的漏打`;
  }

  const makeupLimit = Number(event.makeup_limit_per_user || 0);
  const usedMakeups = (db.prepare(`
    SELECT COUNT(*) as count FROM checkin_records
    WHERE event_id = ? AND participant_id = ? AND is_makeup = 1
  `).get(event.id, participantId) as any).count;
  if (makeupLimit <= 0 || usedMakeups >= makeupLimit) {
    return `每人最多可补卡${makeupLimit || 0}次`;
  }

  return null;
}

function canMakeupDate(event: any, participantId: number, checkinDate: string, today: string, checkedDates: Set<string>) {
  if (checkedDates.has(checkinDate)) return false;
  return !getMakeupRuleError(event, participantId, checkinDate, today);
}

function mapCheckinEvent(e: any): CheckinEvent {
  return { ...e };
}

function mapCheckinParticipant(p: any): CheckinParticipant {
  return { ...p };
}

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { status } = request.query as any;
    // 状态必须根据 end_date 动态计算（北京时间），不能依赖数据库静态 status 字段
    const today = bjtToday();
    let sql = `SELECT e.*, g.name as group_name, 
      (SELECT COUNT(*) FROM checkin_participants WHERE event_id = e.id) as participant_count,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days,
      CASE WHEN e.end_date < ? THEN 'ended' ELSE 'active' END AS status
      FROM checkin_events e LEFT JOIN wechat_groups g ON e.group_id = g.id WHERE e.is_deleted = 0`;
    const params: any[] = [today];
    if (status === 'active') { sql += ' AND e.end_date >= ?'; params.push(today); }
    else if (status === 'ended') { sql += ' AND e.end_date < ?'; params.push(today); }
    sql += ' ORDER BY e.created_at DESC';
    const events = db.prepare(sql).all(...params) as any[];
    return ok({ events, total: events.length });
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const event = db.prepare(`SELECT e.*, g.name as group_name,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days
      FROM checkin_events e LEFT JOIN wechat_groups g ON e.group_id = g.id WHERE e.id = ? AND e.is_deleted = 0`).get(id) as any;
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

    const participantsRaw = db.prepare(`
      SELECT p.*, wu.avatar_url
      FROM checkin_participants p
      LEFT JOIN wx_users wu ON p.wx_user_id = wu.id
      WHERE p.event_id = ?
      ORDER BY p.joined_at ASC
    `).all(id) as any[];
    const recordsRaw = db.prepare('SELECT * FROM checkin_records WHERE event_id = ?').all(id) as any[];
    
    const calendar: { date: string; count: number }[] = [];
    const calendarMap = new Map<string, number>();
    for (const r of recordsRaw) {
      calendarMap.set(r.checkin_date, (calendarMap.get(r.checkin_date) || 0) + 1);
    }
    
    let d = new Date(event.start_date);
    const endD = new Date(event.end_date);
    while (d <= endD) {
      const dateStr = d.toISOString().split('T')[0];
      calendar.push({ date: dateStr, count: calendarMap.get(dateStr) || 0 });
      d.setDate(d.getDate() + 1);
    }

    const participants: CheckinParticipantStats[] = participantsRaw.map(p => {
      const pRecords = recordsRaw.filter(r => r.participant_id === p.id);
      const approvedRecords = pRecords.filter(r => r.status === 'approved');
      const stats = calculateStreaks(approvedRecords, event.start_date, event.end_date, !!event.makeup_counts_for_streak);
      const lastRecord = pRecords.sort((a, b) => b.checkin_date.localeCompare(a.checkin_date))[0];
      return {
        participant: {
          ...mapCheckinParticipant(p),
          checkin_days: stats.checkin_days,
          current_streak: stats.current_streak,
          max_streak: stats.max_streak,
          last_checkin_date: lastRecord?.checkin_date || null,
        },
        records: pRecords as CheckinRecord[],
        ...stats,
      };
    });

    participants.sort((a, b) => b.checkin_days - a.checkin_days);

    return ok({
      ...mapCheckinEvent(event),
      group_name: event.group_name,
      participant_count: participantsRaw.length,
      total_days: event.total_days,
      participants,
      calendar,
    } satisfies CheckinEventDetail);
  });

  router.post('/', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const {
      name,
      group_id,
      start_date,
      end_date,
      signup_deadline,
      required_text,
      reward_rules,
      allow_makeup = 0,
      makeup_window_days = 3,
      makeup_limit_per_user = 3,
      makeup_requires_review = 1,
      makeup_counts_for_streak = 0,
      status = 'active',
    } = request.body;
    if (!name || !start_date || !end_date) return reply.code(400).send({ success: false, error: '活动名称、开始日期和结束日期不能为空' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO checkin_events (
        name, group_id, start_date, end_date, signup_deadline, required_text, reward_rules,
        allow_makeup, makeup_window_days, makeup_limit_per_user, makeup_requires_review, makeup_counts_for_streak,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      group_id || null,
      start_date,
      end_date,
      signup_deadline || start_date,
      required_text || null,
      reward_rules || null,
      normalizeBoolean(allow_makeup),
      Number(makeup_window_days) || 3,
      Number(makeup_limit_per_user) || 3,
      normalizeBoolean(makeup_requires_review),
      normalizeBoolean(makeup_counts_for_streak),
      status,
      now,
      now
    );
    
    const autoImportMembers = normalizeBoolean(request.body.auto_import_members);
    if (group_id && autoImportMembers) {
      const members = db.prepare(`
        SELECT gm.id, gm.wechat_name, gm.nickname, gm.wx_user_id, u.child_name
        FROM wechat_group_members gm LEFT JOIN wx_users u ON gm.wx_user_id = u.id
        WHERE gm.group_id = ?
      `).all(group_id) as any[];
      const insertParticipant = db.prepare(`
        INSERT INTO checkin_participants (event_id, member_id, wx_user_id, nickname, child_name)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertMembers = db.transaction((mems: any[]) => {
        for (const m of mems) {
          insertParticipant.run(r.lastInsertRowid, m.id, m.wx_user_id || null, m.nickname || m.wechat_name, m.child_name || null);
        }
      });
      insertMembers(members);
    }
    
    return reply.code(201).send(ok(mapCheckinEvent(db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(id)) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    const {
      name,
      group_id,
      start_date,
      end_date,
      signup_deadline,
      required_text,
      reward_rules,
      allow_makeup,
      makeup_window_days,
      makeup_limit_per_user,
      makeup_requires_review,
      makeup_counts_for_streak,
      status,
    } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (group_id !== undefined) { fields.push('group_id = ?'); params.push(group_id); }
    if (start_date !== undefined) { fields.push('start_date = ?'); params.push(start_date); }
    if (end_date !== undefined) { fields.push('end_date = ?'); params.push(end_date); }
    if (signup_deadline !== undefined) { fields.push('signup_deadline = ?'); params.push(signup_deadline || null); }
    if (required_text !== undefined) { fields.push('required_text = ?'); params.push(required_text); }
    if (reward_rules !== undefined) { fields.push('reward_rules = ?'); params.push(reward_rules); }
    if (allow_makeup !== undefined) { fields.push('allow_makeup = ?'); params.push(normalizeBoolean(allow_makeup)); }
    if (makeup_window_days !== undefined) { fields.push('makeup_window_days = ?'); params.push(Number(makeup_window_days) || 3); }
    if (makeup_limit_per_user !== undefined) { fields.push('makeup_limit_per_user = ?'); params.push(Number(makeup_limit_per_user) || 3); }
    if (makeup_requires_review !== undefined) { fields.push('makeup_requires_review = ?'); params.push(normalizeBoolean(makeup_requires_review)); }
    if (makeup_counts_for_streak !== undefined) { fields.push('makeup_counts_for_streak = ?'); params.push(normalizeBoolean(makeup_counts_for_streak)); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE checkin_events SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`).run(...params);
    return ok(mapCheckinEvent(db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(id)));
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(id);
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    db.prepare("UPDATE checkin_events SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(id);
    return ok(null);
  });

  router.get('/deleted', async () => {
    const events = db.prepare(`SELECT e.*, g.name as group_name,
      (SELECT COUNT(*) FROM checkin_participants WHERE event_id = e.id) as participant_count,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days
      FROM checkin_events e LEFT JOIN wechat_groups g ON e.group_id = g.id WHERE e.is_deleted = 1 ORDER BY e.deleted_at DESC`).all() as any[];
    return ok({ events, total: events.length });
  });

  router.put('/:id/restore', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 1').get(id);
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在或未被删除' });
    db.prepare("UPDATE checkin_events SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    return ok(mapCheckinEvent(db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(id)));
  });

  router.delete('/:id/permanent', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 1').get(id);
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在或不在回收站中' });
    db.prepare('DELETE FROM checkin_records WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM checkin_participants WHERE event_id = ?').run(id);
    db.prepare('DELETE FROM checkin_events WHERE id = ?').run(id);
    return ok(null);
  });

  router.post('/:id/participants', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId)) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    const { member_id, wx_user_id, nickname, child_name } = request.body;
    if (!nickname) return reply.code(400).send({ success: false, error: '昵称不能为空' });
    const r = db.prepare(`
      INSERT INTO checkin_participants (event_id, member_id, wx_user_id, nickname, child_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventId, member_id || null, wx_user_id || null, nickname, child_name || null);
    return reply.code(201).send(ok(mapCheckinParticipant(db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.delete('/:id/participants/:pid', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const pid = parseInt(request.params.pid);
    if (!db.prepare('SELECT id FROM checkin_participants WHERE id = ? AND event_id = ?').get(pid, eventId)) return reply.code(404).send({ success: false, error: '参与者不存在' });
    db.prepare('DELETE FROM checkin_records WHERE participant_id = ?').run(pid);
    db.prepare('DELETE FROM checkin_participants WHERE id = ?').run(pid);
    return ok(null);
  });

  router.post('/:id/checkin', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    const { participant_id, checkin_date, note } = request.body;
    if (!participant_id || !checkin_date) return reply.code(400).send({ success: false, error: '参与者和日期不能为空' });
    if (!db.prepare('SELECT id FROM checkin_participants WHERE id = ? AND event_id = ?').get(participant_id, eventId)) return reply.code(404).send({ success: false, error: '参与者不存在' });
    
    const existing = db.prepare('SELECT id FROM checkin_records WHERE event_id = ? AND participant_id = ? AND checkin_date = ?').get(eventId, participant_id, checkin_date);
    if (existing) {
      db.prepare('UPDATE checkin_records SET note = ? WHERE id = ?').run(note || null, (existing as any).id);
      return ok(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get((existing as any).id));
    }
    
    const r = db.prepare(`
      INSERT INTO checkin_records (event_id, participant_id, checkin_date, note)
      VALUES (?, ?, ?, ?)
    `).run(eventId, participant_id, checkin_date, note || null);
    const participantWx = db.prepare('SELECT wx_user_id FROM checkin_participants WHERE id = ?').get(participant_id) as any;
    if (participantWx?.wx_user_id) {
      grantCheckinPoints(participantWx.wx_user_id, r.lastInsertRowid as number);
    }
    return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.delete('/:id/checkin/:rid', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const rid = parseInt(request.params.rid);
    const record = db.prepare('SELECT * FROM checkin_records WHERE id = ? AND event_id = ?').get(rid, eventId) as any;
    if (!record) return reply.code(404).send({ success: false, error: '打卡记录不存在' });
    db.prepare('DELETE FROM checkin_records WHERE id = ?').run(rid);
    const participant = db.prepare('SELECT wx_user_id FROM checkin_participants WHERE id = ?').get(record.participant_id) as any;
    if (participant?.wx_user_id) {
      revokeByRef(participant.wx_user_id, 'checkin_record', rid);
    }
    return ok(null);
  });

  router.post('/:id/batch-checkin', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    const { checkin_date, participant_ids, note } = request.body;
    if (!checkin_date || !participant_ids || !Array.isArray(participant_ids)) return reply.code(400).send({ success: false, error: '日期和参与者列表不能为空' });
    
    const insertRecord = db.prepare(`
      INSERT OR IGNORE INTO checkin_records (event_id, participant_id, checkin_date, note)
      VALUES (?, ?, ?, ?)
    `);
    const insertBatch = db.transaction((pids: number[]) => {
      for (const pid of pids) {
        const res = insertRecord.run(eventId, pid, checkin_date, note || null);
        if (res.changes > 0) {
          const participantWx = db.prepare('SELECT wx_user_id FROM checkin_participants WHERE id = ?').get(pid) as any;
          if (participantWx?.wx_user_id) {
            grantCheckinPoints(participantWx.wx_user_id, res.lastInsertRowid as number);
          }
        }
      }
    });
    insertBatch(participant_ids);
    return ok({ checked_count: participant_ids.length });
  });
}, { prefix: '/api/checkin-events' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { category, search, product_id } = request.query as any;
    let sql = `SELECT m.*, p.name as product_name, u.display_name as uploader_name FROM materials m LEFT JOIN products p ON m.product_id = p.id LEFT JOIN users u ON m.uploaded_by = u.id WHERE 1=1`;
    const params: any[] = [];
    if (category && category !== 'all') { sql += ' AND m.category = ?'; params.push(category); }
    if (product_id) { sql += ' AND m.product_id = ?'; params.push(product_id); }
    if (search) { sql += ' AND (m.original_name LIKE ? OR m.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY m.created_at DESC';
    return ok((db.prepare(sql).all(...params) as any[]).map(mapMaterial));
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const m = db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name FROM materials m LEFT JOIN products p ON m.product_id = p.id LEFT JOIN users u ON m.uploaded_by = u.id WHERE m.id = ?`).get(id) as any;
    if (!m) return reply.code(404).send({ success: false, error: '资料不存在' });
    return ok(mapMaterial(m));
  });

  router.post('/upload', async (request: any, reply: any) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ success: false, error: '未收到文件' });

    const { category = 'other', description, tags: tagsStr, product_id } = data.fields as any;
    const cat = (category?.value || 'other') as MaterialCategory;
    const validCats: MaterialCategory[] = ['sales', 'internal', 'product', 'planning', 'other'];
    if (!validCats.includes(cat)) return reply.code(400).send({ success: false, error: '无效的分类' });

    const ext = path.extname(data.filename).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);

    const writeStream = fs.createWriteStream(filePath);
    await new Promise<void>((resolve, reject) => {
      data.file.pipe(writeStream);
      data.file.on('end', resolve);
      data.file.on('error', reject);
      writeStream.on('error', reject);
    });

    const stats = fs.statSync(filePath);
    const tags = tagsStr?.value ? JSON.parse(tagsStr.value) : [];
    const pid = product_id?.value ? parseInt(product_id.value) : null;
    const userId = (request.user as AuthUser).id;

    const result = db.prepare(`
      INSERT INTO materials (filename, original_name, file_path, file_size, mime_type, category, tags, description, product_id, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uniqueName, data.filename, filePath, stats.size, data.mimetype, cat, JSON.stringify(tags), description?.value || null, pid, userId);

    const material = db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name FROM materials m LEFT JOIN products p ON m.product_id = p.id LEFT JOIN users u ON m.uploaded_by = u.id WHERE m.id = ?`).get(result.lastInsertRowid) as any;
    return ok(mapMaterial(material));
  });

  router.patch('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM materials WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '资料不存在' });
    const { category, description, tags, product_id } = request.body as any;
    const updates: string[] = [];
    const params: any[] = [];
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (product_id !== undefined) { updates.push('product_id = ?'); params.push(product_id || null); }
    if (updates.length === 0) return ok(null);
    updates.push('updated_at = datetime(\'now\')');
    params.push(id);
    db.prepare(`UPDATE materials SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const m = db.prepare(`SELECT m.*, p.name as product_name, u.display_name as uploader_name FROM materials m LEFT JOIN products p ON m.product_id = p.id LEFT JOIN users u ON m.uploaded_by = u.id WHERE m.id = ?`).get(id) as any;
    return ok(mapMaterial(m));
  });

  router.post('/:id/download', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
    if (!m) return reply.code(404).send({ success: false, error: '资料不存在' });
    db.prepare('UPDATE materials SET download_count = download_count + 1 WHERE id = ?').run(id);
    return ok({ download_count: m.download_count + 1 });
  });

  router.delete('/:id', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const m = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
    if (!m) return reply.code(404).send({ success: false, error: '资料不存在' });
    try { fs.unlinkSync(m.file_path); } catch {}
    db.prepare('DELETE FROM materials WHERE id = ?').run(id);
    return ok(null);
  });
}, { prefix: '/api/materials' });

async function wxAuthMiddleware(request: any, reply: any) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return reply.code(401).send({ success: false, error: '请先登录' });
    const decoded = app.jwt.verify(token) as any;
    if (decoded.type === 'admin') return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
    const isWxToken = decoded.type === 'wx' || (!decoded.type && decoded.wxUserId != null);
    if (!isWxToken) return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
    const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(decoded.wxUserId) as any;
    if (!user) return reply.code(401).send({ success: false, error: '用户不存在' });
    request.wxUser = user;
  } catch (e) {
    return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
  }
}

async function wxOptionalAuthMiddleware(request: any, _reply: any) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return;
    const decoded = app.jwt.verify(token) as any;
    if (decoded.type === 'admin') return;
    const isWxToken = decoded.type === 'wx' || (!decoded.type && decoded.wxUserId != null);
    if (!isWxToken) return;
    const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(decoded.wxUserId) as any;
    if (user) {
      request.wxUser = user;
    }
  } catch (e) {
  }
}

/**
 * 将微信 jscode2session 的错误码转换为用户可理解的提示。
 * 审核过程中最常见的 40013 / 40125 实际意味着：服务器端 WX_APPID / WX_SECRET
 * 与小程序后台登记的 AppID 不匹配，或者 AppSecret 填错/过期。这里把这类配置
 * 错误描述得更具体，避免被审核系统笼统地归类为"openid有误"。
 */
function wxLoginErrorMessage(errcode: number, rawmsg?: string) {
  const map: Record<number, string> = {
    40029: '登录凭证已失效，请退出重试',
    40163: '登录凭证已使用，请退出重试',
    40013: '系统配置异常，请稍后重试（AppID不匹配）',
    40125: '系统配置异常，请稍后重试（AppSecret无效）',
    45011: '登录请求过于频繁，请稍后再试',
    [-1]: '微信服务繁忙，请稍后重试'
  };
  const friendly = map[errcode];
  if (friendly) return friendly;
  // 未知错误尽量带上原始微信错误码，便于日志定位，避免审核写成"openid有误"
  return `微信登录失败(${errcode ?? 'unknown'})，请稍后重试`;
}

app.post('/api/wx/login', async (request: any, reply: any) => {
  const { code, nickname, avatar_url, child_name } = request.body || {};

  let openid: string;
  const WX_APPID = process.env.WX_APPID;
  const WX_SECRET = process.env.WX_SECRET || process.env.WX_APPSECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!WX_APPID || !WX_SECRET) {
    request.log.error('微信登录配置缺失：WX_APPID 或 WX_SECRET 未设置');
    if (isProduction) return reply.code(500).send({ success: false, error: '系统配置异常，请稍后重试' });
    openid = `dev_${code || randomUUID()}`;
  } else if (!code) {
    if (isProduction) return reply.code(400).send({ success: false, error: '缺少微信登录凭证，请重启小程序' });
    openid = `dev_${randomUUID()}`;
  } else {
    let data: any;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(
          `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(WX_APPID)}` +
          `&secret=${encodeURIComponent(WX_SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`,
          { signal: controller.signal, method: 'GET' }
        );
      } finally {
        clearTimeout(timeout);
      }

      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch (_parseErr) {
        // WeChat 非 JSON 响应（例如代理/网络拦截返回 HTML 错误页）
        request.log.error(
          { wxAppidPrefix: WX_APPID.slice(0, 6), httpStatus: res.status, bodyPreview: rawText.slice(0, 200) },
          '微信 jscode2session 返回非 JSON 响应'
        );
        if (isProduction) {
          return reply.code(502).send({ success: false, error: '微信登录服务暂不可用，请稍后重试' });
        }
      }

      // 日志脱敏：AppID/Secret 前缀足以定位；session_key 永不落盘；code 截断
      request.log.info(
        {
          wxAppidPrefix: WX_APPID.slice(0, 6),
          wxCodePrefix: (code || '').substring(0, 8),
          hasOpenid: Boolean(data?.openid),
          openidPrefix: data?.openid ? String(data.openid).slice(0, 8) : undefined,
          errcode: data?.errcode,
          errmsg: data?.errmsg,
          httpStatus: res.status
        },
        '微信 jscode2session 响应'
      );
    } catch (e: any) {
      request.log.error(
        { err: e?.message || String(e), aborted: e?.name === 'AbortError' },
        '调用微信 jscode2session 失败'
      );
      if (isProduction) {
        const msg = e?.name === 'AbortError'
          ? '微信登录请求超时，请稍后重试'
          : '微信登录服务暂不可用，请稍后重试';
        return reply.code(502).send({ success: false, error: msg });
      }
    }

    if (!data) {
      // 非生产环境兜底
      openid = `dev_${code}`;
    } else if (typeof data.openid === 'string' && data.openid.length > 0) {
      openid = data.openid;
    } else if (isProduction) {
      // 关键：把微信返回的错误码和错误信息记入 error 级别日志，
      // 这样线上可以直接定位是 AppID 配错 (40013) 还是 Code 重复使用 (40163)
      request.log.error(
        {
          wxAppidPrefix: WX_APPID.slice(0, 6),
          wxErrcode: data.errcode,
          wxErrmsg: data.errmsg,
          codeLength: code.length
        },
        '微信 jscode2session 返回错误 — 未能拿到 openid'
      );
      return reply.code(400).send({
        success: false,
        error: wxLoginErrorMessage(Number(data.errcode), data.errmsg)
      });
    } else {
      openid = `dev_${code}`;
    }
  }

  let user = db.prepare('SELECT * FROM wx_users WHERE openid = ?').get(openid) as any;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  if (user) {
    // 只更新登录时间，不覆盖用户已设置的昵称/头像/孩子名字
    db.prepare('UPDATE wx_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, user.id);
    user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(user.id);
  } else {
    const r = db.prepare(`
      INSERT INTO wx_users (openid, nickname, avatar_url, child_name, last_login_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(openid, nickname || '微信用户', avatar_url || null, child_name || null, now, now, now);
    user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(r.lastInsertRowid);
  }

  const token = app.jwt.sign({ wxUserId: user.id, type: 'wx' }, { expiresIn: '30d' });
  return ok({
    token,
    user: {
      id: user.id,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      child_name: user.child_name,
    },
  });
});

app.post('/api/wx/update-profile', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const { nickname, avatar_url, child_name } = request.body || {};

  // 更新头像时强制非空
  if (avatar_url !== undefined && !avatar_url) {
    return reply.code(400).send({ success: false, error: '请从微信头像中选择头像' });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (nickname !== undefined) { updates.push('nickname = ?'); params.push(nickname); }
  if (avatar_url !== undefined) { updates.push('avatar_url = ?'); params.push(avatar_url); }
  if (child_name !== undefined) { updates.push('child_name = ?'); params.push(child_name); }
  updates.push('updated_at = datetime(\'now\')');
  params.push(user.id);
  if (updates.length > 0) {
    db.prepare(`UPDATE wx_users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // 同步更新已加入打卡活动的昵称和孩子名，避免后台显示旧数据
  if (nickname !== undefined || child_name !== undefined) {
    const pFields: string[] = [];
    const pParams: any[] = [];
    if (nickname !== undefined) { pFields.push('nickname = ?'); pParams.push(nickname); }
    if (child_name !== undefined) { pFields.push('child_name = ?'); pParams.push(child_name); }
    pParams.push(user.id);
    db.prepare(`UPDATE checkin_participants SET ${pFields.join(', ')} WHERE wx_user_id = ?`).run(...pParams);
  }

  const updated = db.prepare('SELECT id, nickname, avatar_url, child_name FROM wx_users WHERE id = ?').get(user.id);
  return ok(updated);
});

app.get('/api/wx/user-info', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const userInfo = db.prepare('SELECT id, nickname, avatar_url, child_name, points FROM wx_users WHERE id = ?').get(user.id);
  return ok(userInfo);
});

app.get('/api/wx/my-points', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const row = db.prepare('SELECT points FROM wx_users WHERE id = ?').get(user.id) as any;
  const items = db.prepare(`
    SELECT id, amount, type, note, created_at
    FROM points_ledger
    WHERE wx_user_id = ?
    ORDER BY id DESC
    LIMIT 50
  `).all(user.id);
  return ok({ balance: row?.points ?? 0, items });
});

app.get('/api/wx/checkin-events', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any) => {
  const user = request.wxUser;
  const today = bjtToday();
  const events = db.prepare(`
    SELECT e.*, 
      (SELECT COUNT(*) FROM checkin_participants WHERE event_id = e.id) as participant_count,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days
    FROM checkin_events e
    WHERE e.is_deleted = 0
      AND e.status = 'active'
      AND (
        (e.start_date > date('now') AND e.start_date <= date('now', '+14 days'))
        OR (e.start_date <= date('now') AND e.end_date >= date('now'))
        OR (e.end_date < date('now') AND e.end_date >= date('now', '-5 days'))
      )
    ORDER BY e.start_date ASC
  `).all() as any[];

  const result = events.map(e => {
    const daysLeft = Math.ceil((new Date(e.end_date).getTime() - new Date(today).getTime()) / 86400000);
    let eventStatus: string;
    if (e.start_date > today) {
      eventStatus = 'upcoming';
    } else if (e.end_date >= today) {
      eventStatus = 'ongoing';
    } else {
      eventStatus = 'expired';
    }
    let isJoined = false;
    let myCheckinDays = 0;
    let myCurrentStreak = 0;
    let todayChecked = false;
    
    if (user) {
      const participant = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(e.id, user.id) as any;
      if (participant) {
        isJoined = true;
        const records = db.prepare('SELECT checkin_date, is_makeup FROM checkin_records WHERE participant_id = ? AND status = ?').all(participant.id, 'approved') as { checkin_date: string; is_makeup?: number }[];
        const stats = calculateStreaks(records, e.start_date, e.end_date, !!e.makeup_counts_for_streak);
        myCheckinDays = stats.checkin_days;
        myCurrentStreak = stats.current_streak;
        todayChecked = records.some(r => r.checkin_date === today);
      }
    }

    return {
      id: e.id,
      name: e.name,
      start_date: e.start_date,
      end_date: e.end_date,
      signup_deadline: e.signup_deadline || e.start_date,
      required_text: e.required_text,
      reward_rules: e.reward_rules,
      status: e.status,
      event_status: eventStatus,
      can_signup: today < (e.signup_deadline || e.start_date),
      participant_count: e.participant_count,
      total_days: e.total_days,
      days_left: daysLeft,
      is_joined: isJoined,
      my_checkin_days: myCheckinDays,
      my_current_streak: myCurrentStreak,
      today_checked: todayChecked,
      can_makeup: !!e.allow_makeup,
      makeup_window_days: e.makeup_window_days,
      makeup_remaining: e.makeup_limit_per_user,
    };
  });

  return ok(result);
});

app.post('/api/wx/checkin-events/:id/join', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
  if (event.status !== 'active') return reply.code(400).send({ success: false, error: '活动已结束' });

  const today = bjtToday();
  const signupDeadline = event.signup_deadline || event.start_date;
  if (today >= signupDeadline) return reply.code(400).send({ success: false, error: '报名已截止，无法加入' });

  const existing = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(eventId, user.id);
  if (existing) return reply.code(409).send({ success: false, error: '您已加入该活动' });
  
  const nickname = user.nickname || '微信用户';
  const r = db.prepare(`
    INSERT INTO checkin_participants (event_id, wx_user_id, nickname, child_name)
    VALUES (?, ?, ?, ?)
  `).run(eventId, user.id, nickname, user.child_name || null);
  
  return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(r.lastInsertRowid)));
});

app.get('/api/wx/checkin-events/:id/share-link', async (request: any, reply: any) => {
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

  try {
    const link = getEventShareLink(eventId, request.query?.env_version);
    return ok(link);
  } catch (e: any) {
    request.log.error({ err: e }, '生成分享链接失败');
    return reply.code(502).send({ success: false, error: e.message || '分享链接生成失败' });
  }
});

app.post('/api/wx/checkin', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const { event_id, note, image_url, image_hash, checkin_date, display_name, media_type } = request.body || {};

  if (!event_id) return reply.code(400).send({ success: false, error: '活动不能为空' });
  if (!image_url || !String(image_url).trim()) {
    return reply.code(400).send({ success: false, error: '请上传打卡图片或视频' });
  }

  const finalMediaType = media_type === 'video' ? 'video' : 'image';

  const today = bjtToday();
  const targetDate = checkin_date || today;
  const isMakeup = targetDate !== today;

  const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(event_id) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
  if (event.status !== 'active') return reply.code(400).send({ success: false, error: '活动已结束' });

  const participant = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(event_id, user.id) as any;
  if (!participant) return reply.code(400).send({ success: false, error: '请先加入活动' });

  // 校验并同步孩子名：登录时已要求填写，缺失时提示补充
  if (!user.child_name || !String(user.child_name).trim()) {
    return reply.code(400).send({ success: false, error: '请先补充孩子名称', code: 'CHILD_NAME_REQUIRED' });
  }
  if (!participant.child_name) {
    db.prepare('UPDATE checkin_participants SET child_name = ? WHERE id = ?').run(user.child_name, participant.id);
    participant.child_name = user.child_name;
  }

  // 自动填充打卡显示名：优先使用用户传入的，否则用「昵称（孩子名）」
  const autoDisplayName = participant.child_name
    ? `${participant.nickname || user.nickname || '微信用户'}（${participant.child_name}）`
    : (participant.nickname || user.nickname || '微信用户');
  const finalDisplayName = display_name && String(display_name).trim()
    ? String(display_name).trim()
    : autoDisplayName;
  
  if (targetDate < event.start_date || targetDate > event.end_date) {
    return reply.code(400).send({ success: false, error: '不在活动时间范围内' });
  }
  if (targetDate > today) {
    return reply.code(400).send({ success: false, error: '不能提前打卡' });
  }
  if (!isMakeup && today > event.end_date) {
    return reply.code(400).send({ success: false, error: '活动已结束' });
  }
  if (isMakeup) {
    const makeupError = getMakeupRuleError(event, participant.id, targetDate, today);
    if (makeupError) return reply.code(400).send({ success: false, error: makeupError });
  }
  
  const existing = db.prepare('SELECT * FROM checkin_records WHERE event_id = ? AND participant_id = ? AND checkin_date = ?').get(event_id, participant.id, targetDate);
  if (existing) {
    if ((existing as any).status === 'rejected') {
      const recordStatus = isMakeup && event.makeup_requires_review ? 'pending' : 'approved';
      db.prepare(`
        UPDATE checkin_records
        SET note = ?, image_url = ?, image_hash = ?, media_type = ?, is_makeup = ?, status = ?, display_name = ?, review_note = NULL, reviewed_by = NULL, reviewed_at = NULL, created_at = datetime('now')
        WHERE id = ?
      `).run(note || null, image_url || null, image_hash || null, finalMediaType, isMakeup ? 1 : 0, recordStatus, display_name || null, (existing as any).id);
      let pointsEarned = 0;
      if (recordStatus === 'approved') {
        const grant = grantCheckinPoints(user.id, (existing as any).id);
        pointsEarned = grant ? grant.points_earned : 0;
      }
      return ok({
        ...(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get((existing as any).id) as object),
        checkin_number: null,
        pending_review: recordStatus === 'pending',
        new_badges: [],
        points_earned: pointsEarned
      });
    }
    return reply.code(400).send({ success: false, error: isMakeup ? '该日期已经提交过打卡' : '今日已打卡，明天再来吧~' });
  }
  
  const previousRecords = db.prepare('SELECT checkin_date, is_makeup FROM checkin_records WHERE event_id = ? AND participant_id = ? AND status = ? ORDER BY checkin_date DESC').all(event_id, participant.id, 'approved') as any[];
  const checkinCount = previousRecords.length + 1;
  const recordStatus = isMakeup && event.makeup_requires_review ? 'pending' : 'approved';
  
  const r = db.prepare(`
    INSERT INTO checkin_records (event_id, participant_id, checkin_date, note, image_url, image_hash, media_type, is_makeup, status, display_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event_id, participant.id, targetDate, note || null, image_url || null, image_hash || null, finalMediaType, isMakeup ? 1 : 0, recordStatus, finalDisplayName);

  let pointsEarned = 0;
  if (recordStatus === 'approved') {
    const grant = grantCheckinPoints(user.id, r.lastInsertRowid as number);
    pointsEarned = grant ? grant.points_earned : 0;
  }

  const newBadges: any[] = [];
  const allApprovedRecords = recordStatus === 'approved'
    ? [...previousRecords, { checkin_date: targetDate, is_makeup: isMakeup ? 1 : 0 }]
    : previousRecords;
  const allBadges = db.prepare('SELECT * FROM checkin_badges WHERE event_id = ?').all(event_id) as any[];
  
  if (recordStatus === 'approved' && allBadges.length > 0) {
    const streakStats = calculateStreaks(allApprovedRecords, event.start_date, event.end_date, !!event.makeup_counts_for_streak);
    
    for (const badge of allBadges) {
      const alreadyAchieved = db.prepare('SELECT id FROM checkin_badge_achievements WHERE badge_id = ? AND participant_id = ?').get(badge.id, participant.id);
      if (alreadyAchieved) continue;
      
      let achieved = false;
      if (badge.type === 'total' && streakStats.checkin_days >= badge.target_days) {
        achieved = true;
      } else if (badge.type === 'streak' && streakStats.current_streak >= badge.target_days) {
        achieved = true;
      } else if (badge.type === 'milestone' && checkinCount >= badge.target_days) {
        achieved = true;
      }
      
      if (achieved) {
        db.prepare('INSERT INTO checkin_badge_achievements (badge_id, participant_id) VALUES (?, ?)').run(badge.id, participant.id);
        newBadges.push(badge);
      }
    }
  }
  
  return reply.code(201).send(ok({
    ...(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(r.lastInsertRowid) as object),
    checkin_number: checkinCount,
    pending_review: recordStatus === 'pending',
    new_badges: newBadges,
    points_earned: pointsEarned,
  }));
});

app.get('/api/wx/my-checkins', { preHandler: [wxAuthMiddleware] }, async (request: any) => {
  const user = request.wxUser;
  const participants = db.prepare(`
    SELECT p.*, e.*, p.id AS id, g.name as group_name,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days
    FROM checkin_participants p
    JOIN checkin_events e ON p.event_id = e.id AND e.is_deleted = 0
    LEFT JOIN wechat_groups g ON e.group_id = g.id
    WHERE p.wx_user_id = ?
    ORDER BY e.status ASC, e.end_date DESC
  `).all(user.id) as any[];

  const result = participants.map(p => {
    const records = db.prepare('SELECT * FROM checkin_records WHERE participant_id = ? ORDER BY checkin_date DESC').all(p.id) as any[];
    const approvedRecords = records.filter(r => r.status === 'approved');
    const stats = calculateStreaks(approvedRecords, p.start_date, p.end_date, !!p.makeup_counts_for_streak);
    
    const calendar: {
      date: string;
      checked: boolean;
      status: string | null;
      review_note: string | null;
      is_makeup: boolean;
      can_makeup: boolean;
      missed: boolean;
    }[] = [];
    const recordByDate = new Map(records.map(r => [r.checkin_date, r]));
    const approvedDates = new Set(approvedRecords.map(r => r.checkin_date));
    const today = bjtToday();
    let d = new Date(p.start_date);
    const endD = new Date(p.end_date);
    while (d <= endD) {
      const dateStr = d.toISOString().split('T')[0];
      const record = recordByDate.get(dateStr);
      const missed = dateStr < today && !record;
      calendar.push({
        date: dateStr,
        checked: approvedDates.has(dateStr),
        status: record?.status || null,
        review_note: record?.review_note || null,
        is_makeup: !!record?.is_makeup,
        can_makeup: missed && canMakeupDate(p, p.id, dateStr, today, new Set(recordByDate.keys())),
        missed,
      });
      d.setDate(d.getDate() + 1);
    }

    return {
      event: {
        id: p.event_id,
        name: p.name,
        group_name: p.group_name,
        start_date: p.start_date,
        end_date: p.end_date,
        required_text: p.required_text,
        reward_rules: p.reward_rules,
        allow_makeup: p.allow_makeup,
        makeup_window_days: p.makeup_window_days,
        makeup_limit_per_user: p.makeup_limit_per_user,
        makeup_requires_review: p.makeup_requires_review,
        makeup_counts_for_streak: p.makeup_counts_for_streak,
        status: p.status,
        total_days: p.total_days,
      },
      participant: {
        id: p.id,
        nickname: p.nickname,
        child_name: p.child_name,
        joined_at: p.joined_at,
      },
      records: records.map(r => ({
        id: r.id,
        checkin_date: r.checkin_date,
        note: r.note,
        image_url: r.image_url,
        image_hash: r.image_hash,
        media_type: r.media_type || 'image',
        display_name: r.display_name,
        status: r.status,
        review_note: r.review_note,
        is_makeup: !!r.is_makeup,
        created_at: r.created_at,
      })),
      checkin_days: stats.checkin_days,
      current_streak: stats.current_streak,
      max_streak: stats.max_streak,
      calendar,
    };
  });

  return ok(result);
});

app.get('/api/wx/checkin-events/:id/ranking', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

  const participants = db.prepare(`
    SELECT p.*, wu.avatar_url
    FROM checkin_participants p
    LEFT JOIN wx_users wu ON p.wx_user_id = wu.id
    WHERE p.event_id = ?
  `).all(eventId) as any[];
  const records = db.prepare('SELECT * FROM checkin_records WHERE event_id = ?').all(eventId) as any[];

  const me = user ? db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(eventId, user.id) as any : null;

  const ranking = participants.map(p => {
    const pRecords = records.filter(r => r.participant_id === p.id && r.status === 'approved');
    const stats = calculateStreaks(pRecords, event.start_date, event.end_date, !!event.makeup_counts_for_streak);
    return {
      participant_id: p.id,
      nickname: p.nickname,
      avatar_url: p.avatar_url,
      checkin_days: stats.checkin_days,
      current_streak: stats.current_streak,
      is_me: me ? p.id === me.id : false,
    };
  });

  ranking.sort((a, b) => {
    if (b.checkin_days !== a.checkin_days) return b.checkin_days - a.checkin_days;
    return b.current_streak - a.current_streak;
  });

  const result = ranking.map((r, i) => ({
    rank: i + 1,
    nickname: r.nickname,
    avatar_url: r.avatar_url,
    checkin_days: r.checkin_days,
    current_streak: r.current_streak,
    is_me: r.is_me,
  }));

  return ok(result);
});

app.put('/api/wx/checkin-records/:id', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const recordId = parseInt(request.params.id);
  const { image_url, image_hash, note, media_type } = request.body || {};

  if (!image_url || !String(image_url).trim()) {
    return reply.code(400).send({ success: false, error: '请上传打卡图片或视频' });
  }

  const finalMediaType = media_type === 'video' ? 'video' : 'image';

  const record = db.prepare(`
    SELECT r.*, e.status as event_status, e.start_date, e.end_date, e.makeup_requires_review, p.wx_user_id
    FROM checkin_records r
    JOIN checkin_events e ON r.event_id = e.id
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE r.id = ?
  `).get(recordId) as any;

  if (!record) return reply.code(404).send({ success: false, error: '打卡记录不存在' });
  if (record.wx_user_id !== user.id) return reply.code(403).send({ success: false, error: '只能修改自己的打卡' });

  const today = bjtToday();
  if (record.checkin_date !== today) {
    return reply.code(400).send({ success: false, error: '只能修改今天的打卡记录' });
  }
  if (record.event_status !== 'active') {
    return reply.code(400).send({ success: false, error: '活动已结束' });
  }

  const newStatus = record.is_makeup && record.makeup_requires_review ? 'pending' : 'approved';

  db.prepare(`
    UPDATE checkin_records
    SET image_url = ?, image_hash = COALESCE(?, image_hash), media_type = ?, note = ?, status = ?, review_note = NULL, reviewed_by = NULL, reviewed_at = NULL, created_at = datetime('now')
    WHERE id = ?
  `).run(image_url, image_hash || null, finalMediaType, note || null, newStatus, recordId);

  return ok({
    ...(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId) as object),
    pending_review: newStatus === 'pending'
  });
});

app.get('/api/wx/checkin-events/:id/feed', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

  const records = db.prepare(`
    SELECT r.id, r.checkin_date, r.note, r.image_url, r.media_type, r.created_at, r.is_makeup, r.display_name,
           p.nickname, wu.avatar_url
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    LEFT JOIN wx_users wu ON p.wx_user_id = wu.id
    WHERE r.event_id = ? AND r.status = 'approved'
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 12
  `).all(eventId) as any[];

  const recordIds = records.map(r => r.id);
  const likeCounts = new Map<number, number>();
  const likedIds = new Set<number>();

  if (recordIds.length > 0) {
    const placeholders = recordIds.map(() => '?').join(',');
    const counts = db.prepare(`
      SELECT record_id, COUNT(*) as count
      FROM checkin_record_likes
      WHERE record_id IN (${placeholders})
      GROUP BY record_id
    `).all(...recordIds) as any[];
    for (const row of counts) likeCounts.set(row.record_id, row.count);

    if (user) {
      const liked = db.prepare(`
        SELECT record_id
        FROM checkin_record_likes
        WHERE wx_user_id = ? AND record_id IN (${placeholders})
      `).all(user.id, ...recordIds) as any[];
      for (const row of liked) likedIds.add(row.record_id);
    }
  }

  return ok(records.map(r => ({
    id: r.id,
    checkin_date: r.checkin_date,
    note: r.note,
    image_url: r.image_url,
    media_type: r.media_type || 'image',
    created_at: r.created_at,
    is_makeup: !!r.is_makeup,
    nickname: r.nickname,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    like_count: likeCounts.get(r.id) || 0,
    liked_by_me: likedIds.has(r.id),
  })));
});

app.post('/api/wx/checkin-records/:id/like', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const recordId = parseInt(request.params.id);
  const record = db.prepare('SELECT id FROM checkin_records WHERE id = ? AND status = ?').get(recordId, 'approved') as any;
  if (!record) return reply.code(404).send({ success: false, error: '打卡记录不存在或未通过审核' });

  const existing = db.prepare('SELECT id FROM checkin_record_likes WHERE record_id = ? AND wx_user_id = ?').get(recordId, user.id) as any;
  let liked = false;
  if (existing) {
    db.prepare('DELETE FROM checkin_record_likes WHERE id = ?').run(existing.id);
  } else {
    db.prepare('INSERT INTO checkin_record_likes (record_id, wx_user_id) VALUES (?, ?)').run(recordId, user.id);
    liked = true;
  }

  const likeCount = (db.prepare('SELECT COUNT(*) as count FROM checkin_record_likes WHERE record_id = ?').get(recordId) as any).count;
  return ok({ liked, like_count: likeCount });
});

app.get('/api/wx/checkin-events/:id/reminder', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

  const reminder = db.prepare('SELECT * FROM checkin_reminders WHERE wx_user_id = ? AND event_id = ?').get(user.id, eventId) as any;
  const template = db.prepare(`
    SELECT template_id FROM wx_subscribe_templates
    WHERE scene = ? AND is_active = 1
    ORDER BY id DESC LIMIT 1
  `).get('checkin_reminder') as any;

  return ok({
    is_enabled: reminder ? !!reminder.is_enabled : false,
    remind_time: reminder?.remind_time || '20:00',
    template_id: template?.template_id || null,
  });
});

app.post('/api/wx/checkin-events/:id/reminder', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const eventId = parseInt(request.params.id);
  const { is_enabled, remind_time = '20:00' } = request.body || {};
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(remind_time)) return reply.code(400).send({ success: false, error: '提醒时间格式无效' });

  db.prepare(`
    INSERT INTO checkin_reminders (wx_user_id, event_id, remind_time, is_enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(wx_user_id, event_id) DO UPDATE SET
      remind_time = excluded.remind_time,
      is_enabled = excluded.is_enabled,
      updated_at = datetime('now')
  `).run(user.id, eventId, remind_time, normalizeBoolean(is_enabled));

  const reminder = db.prepare('SELECT * FROM checkin_reminders WHERE wx_user_id = ? AND event_id = ?').get(user.id, eventId) as any;
  return ok({
    is_enabled: !!reminder.is_enabled,
    remind_time: reminder.remind_time,
  });
});

app.post('/api/wx/upload-media', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  if (!allowUpload(request.wxUser.id)) {
    return reply.code(429).send({ success: false, error: '上传太频繁，请稍后再试' });
  }
  const data = await request.file();
  if (!data) return reply.code(400).send({ success: false, error: '未收到媒体文件' });

  let buffer: Buffer;
  try {
    buffer = await data.toBuffer();
  } catch {
    return reply.code(413).send({ success: false, error: '文件不能超过 50MB' });
  }
  if (data.file.truncated || buffer.length === 0) return reply.code(413).send({ success: false, error: '文件不能超过 50MB' });

  const media = detectMedia(buffer);
  if (!media) return reply.code(400).send({ success: false, error: '仅支持 JPG/PNG/GIF/WEBP/MP4/MOV 格式' });

  const maxSize = media.type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return reply.code(413).send({ success: false, error: media.type === 'image' ? '图片不能超过 10MB' : '视频不能超过 50MB' });
  }

  const mediaHash = createHash('sha256').update(buffer).digest('hex');
  const today = bjtToday();
  const userId = request.wxUser.id;

  const sameDayRecord = db.prepare(`
    SELECT r.id, r.checkin_date, r.display_name, r.note
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.wx_user_id = ? AND r.image_hash = ? AND r.checkin_date = ?
    LIMIT 1
  `).get(userId, mediaHash, today) as any;

  const similarRecord = sameDayRecord ? null : db.prepare(`
    SELECT r.id, r.checkin_date, r.display_name, r.note
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.wx_user_id = ? AND r.image_hash = ? AND r.checkin_date != ?
    ORDER BY r.checkin_date DESC
    LIMIT 1
  `).get(userId, mediaHash, today) as any;

  const uniqueName = `checkin_${randomUUID()}${media.ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  await fs.promises.writeFile(filePath, buffer);

  return ok({
    url: `/uploads/${uniqueName}`,
    media_type: media.type,
    media_hash: mediaHash,
    same_day_duplicate: !!sameDayRecord,
    similar_record: similarRecord ? {
      checkin_date: similarRecord.checkin_date,
      display_name: similarRecord.display_name,
      note: similarRecord.note
    } : null
  });
});

// 保留旧版图片上传接口兼容旧客户端
app.post('/api/wx/upload-image', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  if (!allowUpload(request.wxUser.id)) {
    return reply.code(429).send({ success: false, error: '上传太频繁，请稍后再试' });
  }
  const data = await request.file();
  if (!data) return reply.code(400).send({ success: false, error: '未收到图片' });

  let buffer: Buffer;
  try {
    buffer = await data.toBuffer();
  } catch {
    return reply.code(413).send({ success: false, error: '图片不能超过 10MB' });
  }
  if (data.file.truncated || buffer.length === 0) return reply.code(413).send({ success: false, error: '图片不能超过 10MB' });

  const ext = detectImageExtension(buffer);
  if (!ext) return reply.code(400).send({ success: false, error: '文件内容不是受支持的图片格式' });
  if (buffer.length > 10 * 1024 * 1024) {
    return reply.code(413).send({ success: false, error: '图片不能超过 10MB' });
  }

  const imageHash = createHash('sha256').update(buffer).digest('hex');
  const today = bjtToday();
  const userId = request.wxUser.id;

  const sameDayRecord = db.prepare(`
    SELECT r.id, r.checkin_date, r.display_name, r.note
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.wx_user_id = ? AND r.image_hash = ? AND r.checkin_date = ?
    LIMIT 1
  `).get(userId, imageHash, today) as any;

  const similarRecord = sameDayRecord ? null : db.prepare(`
    SELECT r.id, r.checkin_date, r.display_name, r.note
    FROM checkin_records r
    JOIN checkin_participants p ON r.participant_id = p.id
    WHERE p.wx_user_id = ? AND r.image_hash = ? AND r.checkin_date != ?
    ORDER BY r.checkin_date DESC
    LIMIT 1
  `).get(userId, imageHash, today) as any;

  const uniqueName = `checkin_${randomUUID()}${ext}`;
  const filePath = path.join(uploadsDir, uniqueName);

  await fs.promises.writeFile(filePath, buffer);

  return ok({
    url: `/uploads/${uniqueName}`,
    image_hash: imageHash,
    same_day_duplicate: !!sameDayRecord,
    similar_record: similarRecord ? {
      checkin_date: similarRecord.checkin_date,
      display_name: similarRecord.display_name,
      note: similarRecord.note
    } : null
  });
});

async function getWxAccessToken() {
  const appId = process.env.WX_APPID;
  const appSecret = process.env.WX_SECRET || process.env.WX_APPSECRET;
  if (!appId || !appSecret) return null;

  const cached = db.prepare("SELECT value FROM settings WHERE key = 'wx_access_token'").get() as any;
  if (cached) {
    const tokenData = JSON.parse(cached.value);
    if (tokenData.expires_at > Date.now()) return tokenData.access_token;
  }

  try {
    const res = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`);
    const data: any = await res.json();
    if (data.access_token) {
      const tokenData = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in - 300) * 1000
      };
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('wx_access_token', ?)").run(JSON.stringify(tokenData));
      return data.access_token;
    }
  } catch (e) {
    console.error('获取微信access_token失败', e);
  }
  return null;
}

async function sendWxSubscribeMessage(openid: string, templateId: string, data: any, page?: string) {
  const accessToken = await getWxAccessToken();
  if (!accessToken) return { success: false, error: '未配置微信AppSecret' };

  try {
    const res = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: openid,
        template_id: templateId,
        page: page || 'pages/index/index',
        data
      })
    });
    const result: any = await res.json();
    return { success: result.errcode === 0, error: result.errmsg };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function runDueCheckinReminders() {
  const today = bjtToday();
  const nowBjt = new Date(Date.now() + BJT_MS);
  const hhmm = `${String(nowBjt.getUTCHours()).padStart(2, '0')}:${String(nowBjt.getUTCMinutes()).padStart(2, '0')}`;
  const template = db.prepare(`
    SELECT template_id FROM wx_subscribe_templates
    WHERE scene = ? AND is_active = 1
    ORDER BY id DESC LIMIT 1
  `).get('checkin_reminder') as any;
  if (!template?.template_id) return { sent: 0, failed: 0, skipped: 0, error: '未配置打卡提醒订阅模板' };

  const reminders = db.prepare(`
    SELECT cr.*, wu.openid, e.name as event_name, e.end_date, p.id as participant_id
    FROM checkin_reminders cr
    JOIN wx_users wu ON cr.wx_user_id = wu.id
    JOIN checkin_events e ON cr.event_id = e.id
    JOIN checkin_participants p ON p.event_id = e.id AND p.wx_user_id = cr.wx_user_id
    WHERE cr.is_enabled = 1
      AND e.is_deleted = 0
      AND e.status = 'active'
      AND e.start_date <= ?
      AND e.end_date >= ?
      AND cr.remind_time <= ?
      AND (cr.last_sent_date IS NULL OR cr.last_sent_date < ?)
  `).all(today, today, hhmm, today) as any[];

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const reminder of reminders) {
    const checked = db.prepare(`
      SELECT id FROM checkin_records
      WHERE event_id = ? AND participant_id = ? AND checkin_date = ? AND status IN ('approved', 'pending')
    `).get(reminder.event_id, reminder.participant_id, today);
    if (checked) {
      skipped++;
      db.prepare('UPDATE checkin_reminders SET last_sent_date = ?, updated_at = datetime(\'now\') WHERE id = ?').run(today, reminder.id);
      continue;
    }

    const result = await sendWxSubscribeMessage(
      reminder.openid,
      template.template_id,
      {
        thing1: { value: reminder.event_name.slice(0, 20) },
        time2: { value: reminder.remind_time },
        thing3: { value: '今天还未打卡，记得来完成哦' },
      },
      `pages/event-detail/event-detail?id=${reminder.event_id}&autoCheckin=1`
    );

    db.prepare(`
      INSERT INTO wx_subscribe_records (wx_user_id, template_id, scene, status, error_msg, sent_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(reminder.wx_user_id, template.template_id, 'checkin_reminder', result.success ? 'sent' : 'failed', result.error || null);

    if (result.success) {
      sent++;
      db.prepare('UPDATE checkin_reminders SET last_sent_date = ?, updated_at = datetime(\'now\') WHERE id = ?').run(today, reminder.id);
    } else {
      failed++;
    }
  }

  return { sent, failed, skipped };
}

app.get('/api/wx/checkin-events/:id/materials', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any, reply: any) => {
  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
  const materials = db.prepare(`
    SELECT id, title, description, file_url, file_type, sort_order
    FROM checkin_materials
    WHERE event_id = ? AND is_active = 1
    ORDER BY sort_order ASC, id DESC
  `).all(eventId);
  return ok(materials);
});

app.get('/api/wx/checkin-events/:id/badges', { preHandler: [wxOptionalAuthMiddleware] }, async (request: any, reply: any) => {
  const eventId = parseInt(request.params.id);
  const user = request.wxUser;
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });

  const badges = db.prepare(`
    SELECT id, name, description, icon, type, target_days
    FROM checkin_badges
    WHERE event_id = ?
    ORDER BY target_days ASC
  `).all(eventId) as any[];

  let achievedIds: number[] = [];
  if (user) {
    const participant = db.prepare('SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(eventId, user.id) as any;
    if (participant) {
      const achieved = db.prepare('SELECT badge_id FROM checkin_badge_achievements WHERE participant_id = ?').all(participant.id) as any[];
      achievedIds = achieved.map(a => a.badge_id);
    }
  }

  return ok(badges.map(b => ({
    ...b,
    achieved: achievedIds.includes(b.id)
  })));
});

app.get('/api/wx/my-badges', { preHandler: [wxAuthMiddleware] }, async (request: any) => {
  const user = request.wxUser;
  const achievements = db.prepare(`
    SELECT ba.*, b.name as badge_name, b.description as badge_description, b.icon as badge_icon,
           b.type as badge_type, b.target_days, e.name as event_name, e.id as event_id
    FROM checkin_badge_achievements ba
    JOIN checkin_badges b ON ba.badge_id = b.id
    JOIN checkin_events e ON b.event_id = e.id AND e.is_deleted = 0
    JOIN checkin_participants p ON ba.participant_id = p.id
    WHERE p.wx_user_id = ?
    ORDER BY ba.achieved_at DESC
  `).all(user.id);
  return ok(achievements);
});

app.post('/api/checkin-events/reminders/run', { preHandler: [authMiddleware, adminOnly] }, async () => {
  const result = await runDueCheckinReminders();
  return ok(result);
});

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/:id/records', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const { status, record_type, page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT r.*, p.nickname, p.child_name, p.wx_user_id, wu.avatar_url
      FROM checkin_records r
      JOIN checkin_participants p ON r.participant_id = p.id
      LEFT JOIN wx_users wu ON p.wx_user_id = wu.id
      WHERE r.event_id = ?
    `;
    const params: any[] = [eventId];
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (record_type === 'makeup') { sql += ' AND r.is_makeup = 1'; }
    if (record_type === 'normal') { sql += ' AND r.is_makeup = 0'; }
    sql += ' ORDER BY r.checkin_date DESC, r.id DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const records = db.prepare(sql).all(...params);

    let countSql = 'SELECT COUNT(*) as total FROM checkin_records WHERE event_id = ?';
    const countParams: any[] = [eventId];
    if (status) { countSql += ' AND status = ?'; countParams.push(status); }
    if (record_type === 'makeup') { countSql += ' AND is_makeup = 1'; }
    if (record_type === 'normal') { countSql += ' AND is_makeup = 0'; }
    const total = (db.prepare(countSql).get(...countParams) as any).total;

    return ok({ records, total });
  });

  router.post('/:id/records/:rid/review', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const recordId = parseInt(request.params.rid);
    const { status, review_note } = request.body;
    if (!['approved', 'rejected'].includes(status)) return reply.code(400).send({ success: false, error: '状态无效' });

    const record = db.prepare('SELECT * FROM checkin_records WHERE id = ? AND event_id = ?').get(recordId, eventId) as any;
    if (!record) return reply.code(404).send({ success: false, error: '打卡记录不存在' });

    db.prepare(`
      UPDATE checkin_records
      SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), review_note = ?
      WHERE id = ?
    `).run(status, (request.user as AuthUser).id, review_note || null, recordId);

    if (status === 'approved' && record.status !== 'approved') {
      const participant = db.prepare('SELECT wx_user_id FROM checkin_participants WHERE id = ?').get(record.participant_id) as any;
      if (participant?.wx_user_id) {
        grantCheckinPoints(participant.wx_user_id, recordId);
      }
    }

    return ok(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId));
  });

  router.get('/:id/badges', async (request: any) => {
    const eventId = parseInt(request.params.id);
    const badges = db.prepare('SELECT * FROM checkin_badges WHERE event_id = ? ORDER BY target_days ASC').all(eventId);
    return ok(badges);
  });

  router.post('/:id/badges', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const { name, description, icon, type = 'streak', target_days = 0 } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '徽章名称不能为空' });

    const r = db.prepare(`
      INSERT INTO checkin_badges (event_id, name, description, icon, type, target_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(eventId, name, description || null, icon || null, type, target_days || 0);

    return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_badges WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.put('/:id/badges/:bid', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const badgeId = parseInt(request.params.bid);
    const { name, description, icon, type, target_days } = request.body;

    const badge = db.prepare('SELECT * FROM checkin_badges WHERE id = ? AND event_id = ?').get(badgeId, eventId) as any;
    if (!badge) return reply.code(404).send({ success: false, error: '徽章不存在' });

    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (icon !== undefined) { fields.push('icon = ?'); params.push(icon); }
    if (type !== undefined) { fields.push('type = ?'); params.push(type); }
    if (target_days !== undefined) { fields.push('target_days = ?'); params.push(target_days); }
    params.push(badgeId);

    db.prepare(`UPDATE checkin_badges SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(db.prepare('SELECT * FROM checkin_badges WHERE id = ?').get(badgeId));
  });

  router.delete('/:id/badges/:bid', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const badgeId = parseInt(request.params.bid);
    const badge = db.prepare('SELECT * FROM checkin_badges WHERE id = ? AND event_id = ?').get(badgeId, eventId);
    if (!badge) return reply.code(404).send({ success: false, error: '徽章不存在' });
    db.prepare('DELETE FROM checkin_badges WHERE id = ?').run(badgeId);
    return ok({ deleted: true });
  });

  router.get('/:id/rewards', async (request: any) => {
    const eventId = parseInt(request.params.id);
    const { status, search } = request.query as any;
    let sql = `
      SELECT p.*,
        (SELECT COUNT(*) FROM checkin_records r WHERE r.participant_id = p.id AND r.status = 'approved') as checkin_days
      FROM checkin_participants p
      WHERE p.event_id = ?
    `;
    const params: any[] = [eventId];
    if (status) { sql += ' AND p.reward_status = ?'; params.push(status); }
    if (search) { sql += ' AND (p.nickname LIKE ? OR p.child_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY checkin_days DESC, p.joined_at ASC';
    const participants = db.prepare(sql).all(...params);
    return ok(participants);
  });

  router.post('/:id/rewards/:pid/distribute', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const participantId = parseInt(request.params.pid);
    const { reward_note } = request.body;

    const participant = db.prepare('SELECT * FROM checkin_participants WHERE id = ? AND event_id = ?').get(participantId, eventId) as any;
    if (!participant) return reply.code(404).send({ success: false, error: '参与者不存在' });

    db.prepare(`
      UPDATE checkin_participants
      SET reward_status = 'distributed', reward_distributed_at = datetime('now'), reward_note = ?
      WHERE id = ?
    `).run(reward_note || null, participantId);

    return ok(db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(participantId));
  });

  router.get('/:id/materials-manage', async (request: any) => {
    const eventId = parseInt(request.params.id);
    const materials = db.prepare('SELECT * FROM checkin_materials WHERE event_id = ? ORDER BY sort_order ASC, id DESC').all(eventId);
    return ok(materials);
  });

  router.post('/:id/materials', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const { title, description, file_url, file_type, sort_order = 0, is_active = 1 } = request.body;
    if (!title) return reply.code(400).send({ success: false, error: '标题不能为空' });

    const r = db.prepare(`
      INSERT INTO checkin_materials (event_id, title, description, file_url, file_type, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, title, description || null, file_url || null, file_type || null, sort_order, is_active ? 1 : 0);

    return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_materials WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.put('/:id/materials/:mid', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const materialId = parseInt(request.params.mid);
    const { title, description, file_url, file_type, sort_order, is_active } = request.body;

    const material = db.prepare('SELECT * FROM checkin_materials WHERE id = ? AND event_id = ?').get(materialId, eventId) as any;
    if (!material) return reply.code(404).send({ success: false, error: '资料不存在' });

    const fields: string[] = [], params: any[] = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (file_url !== undefined) { fields.push('file_url = ?'); params.push(file_url); }
    if (file_type !== undefined) { fields.push('file_type = ?'); params.push(file_type); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); params.push(sort_order); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    params.push(materialId);

    db.prepare(`UPDATE checkin_materials SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(db.prepare('SELECT * FROM checkin_materials WHERE id = ?').get(materialId));
  });

  router.delete('/:id/materials/:mid', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const materialId = parseInt(request.params.mid);
    const material = db.prepare('SELECT * FROM checkin_materials WHERE id = ? AND event_id = ?').get(materialId, eventId);
    if (!material) return reply.code(404).send({ success: false, error: '资料不存在' });
    db.prepare('DELETE FROM checkin_materials WHERE id = ?').run(materialId);
    return ok({ deleted: true });
  });
}, { prefix: '/api/checkin-events' });

// 打卡导出：前端以新窗口打开 ?token= 链接，故单独注册路由做作用域内鉴权（不再依赖全局 query-token 注入）
app.get('/api/checkin-events/:id/export', async (request: any, reply: any) => {
  let token = request.headers.authorization?.replace('Bearer ', '') as string | undefined;
  const query = request.query as Record<string, unknown>;
  if (!token && typeof query.token === 'string' && query.token) token = query.token;
  if (!token) return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
  try {
    const decoded = app.jwt.verify(token) as any;
    if (decoded.type !== 'admin') return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
  } catch {
    return reply.code(401).send({ success: false, error: '登录已过期，请重新登录' });
  }

  const eventId = parseInt(request.params.id);
  const event = db.prepare('SELECT * FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '活动不存在' });

  const participants = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? ORDER BY joined_at ASC').all(eventId) as any[];
  const records = db.prepare('SELECT * FROM checkin_records WHERE event_id = ?').all(eventId) as any[];

  const csvRows = [];
  csvRows.push(['昵称', '孩子姓名', '打卡天数', '加入时间']);

  for (const p of participants) {
    const pRecords = records.filter(r => r.participant_id === p.id && r.status === 'approved');
    csvRows.push([
      p.nickname || '',
      p.child_name || '',
      pRecords.length,
      p.joined_at || ''
    ]);
  }

  csvRows.push([]);
  csvRows.push(['--- 打卡明细 ---']);
  csvRows.push(['昵称', '孩子姓名', '打卡日期', '类型', '打卡内容', '状态', '审核备注']);

  for (const r of records) {
    const p = participants.find(p => p.id === r.participant_id);
    csvRows.push([
      p?.nickname || '',
      p?.child_name || '',
      r.checkin_date || '',
      r.is_makeup ? '补卡' : '正常打卡',
      r.note || '',
      r.status === 'approved' ? '已通过' : r.status === 'rejected' ? '已拒绝' : '待审核',
      r.review_note || ''
    ]);
  }

  const csvContent = '\uFEFF' + csvRows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="checkin_${eventId}.csv"`);
  return csvContent;
});

// ---- 微信用户与积分管理 ----
app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.post('/:id/points', { preHandler: [adminOnly] }, async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const user = db.prepare('SELECT points FROM wx_users WHERE id = ?').get(id) as any;
    if (!user) return reply.code(404).send({ success: false, error: '微信用户不存在' });
    const { amount, note } = request.body;
    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt === 0) return reply.code(400).send({ success: false, error: '积分数量必须是非零整数' });
    const newBalance = (user.points || 0) + amt;
    if (newBalance < 0) return reply.code(400).send({ success: false, error: '积分余额不足' });
    const grant = grantPoints({
      wxUserId: id,
      amount: amt,
      type: 'adjust',
      refType: 'none',
      note: note || null,
      operatorId: (request.user as AuthUser).id,
    });
    return ok({ new_balance: newBalance, ledger_id: grant?.ledgerId ?? null });
  });

  router.get('/:id/points', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const user = db.prepare('SELECT points FROM wx_users WHERE id = ?').get(id) as any;
    if (!user) return reply.code(404).send({ success: false, error: '微信用户不存在' });
    const { page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    const items = db.prepare('SELECT * FROM points_ledger WHERE wx_user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?').all(id, limitNum, offset);
    const total = (db.prepare('SELECT COUNT(*) as total FROM points_ledger WHERE wx_user_id = ?').get(id) as any).total;
    return ok({ items, total, balance: user.points });
  });
}, { prefix: '/api/wx-users' });

app.get('/api/settings/points', { preHandler: [authMiddleware] }, async () => {
  return ok({ points_checkin: getIntSetting('points_checkin'), points_order_rate: getIntSetting('points_order_rate') });
});

app.put('/api/settings/points', { preHandler: [authMiddleware, adminOnly] }, async (request: any, reply: any) => {
  const { points_checkin, points_order_rate } = request.body;
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))");
  if (points_checkin !== undefined) {
    const v = parseInt(points_checkin, 10);
    if (!Number.isFinite(v) || v <= 0 || v > 10000) return reply.code(400).send({ success: false, error: '打卡积分必须是 1-10000 的整数' });
    upsert.run('points_checkin', String(v));
  }
  if (points_order_rate !== undefined) {
    const v = parseInt(points_order_rate, 10);
    if (!Number.isFinite(v) || v <= 0 || v > 100) return reply.code(400).send({ success: false, error: '订单积分比例必须是 1-100 的整数' });
    upsert.run('points_order_rate', String(v));
  }
  return ok({ points_checkin: getIntSetting('points_checkin'), points_order_rate: getIntSetting('points_order_rate') });
});

// ---- 数据备份管理 ----
app.get('/api/admin/backups', { preHandler: [authMiddleware, adminOnly] }, async () => {
  const backups = listBackups().map(({ filePath, ...rest }) => rest);
  return ok(backups);
});

app.post('/api/admin/backup', { preHandler: [authMiddleware, adminOnly] }, async (request: any, reply: any) => {
  try {
    const backup = await createBackup();
    return ok({ name: backup.name, size: backup.size, createdAt: backup.createdAt });
  } catch (err: any) {
    request.log.error({ err }, '创建备份失败');
    return reply.code(500).send({ success: false, error: `创建备份失败：${err.message}` });
  }
});

app.get('/api/admin/backup/download', { preHandler: [authMiddleware, adminOnly] }, async (request: any, reply: any) => {
  const { name } = request.query as any;
  if (!isValidBackupName(name || '')) return reply.code(400).send({ success: false, error: '无效的备份文件名' });
  const filePath = path.join(backupsDir, name);
  if (!fs.existsSync(filePath)) return reply.code(404).send({ success: false, error: '备份文件不存在' });
  reply.header('Content-Type', 'application/zip');
  reply.header('Content-Disposition', `attachment; filename="${name}"`);
  reply.header('Content-Length', String(fs.statSync(filePath).size));
  return reply.send(fs.createReadStream(filePath));
});

app.setErrorHandler((error: any, request, reply) => {
  if (error.statusCode) {
    return reply.code(error.statusCode).send({ success: false, error: error.message });
  }
  app.log.error({ url: request.url, method: request.method, error: error.message, stack: error.stack });
  reply.code(500).send({ success: false, error: '服务器内部错误' });
});

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, '..', 'dist');
  app.setNotFoundHandler((request, reply) => {
    const urlPath = request.url.split('?')[0];
    if (urlPath.startsWith('/api/')) {
      return reply.code(404).send({ success: false, error: 'API不存在' });
    }
    // 缺失的上传文件必须返回 404：返回 200 + index.html 会让 <image> 静默空白，文件丢失无从发现
    if (urlPath.startsWith('/uploads/')) {
      return reply.code(404).send();
    }
    return reply.sendFile('index.html', distPath);
  });
} else {
  app.setNotFoundHandler((_request, reply) => { reply.code(404).send({ success: false, error: 'API不存在' }); });
}

declare global {
  var __checkinReminderTimerStarted: boolean | undefined;
}

if (process.env.NODE_ENV !== 'test' && !globalThis.__checkinReminderTimerStarted) {
  globalThis.__checkinReminderTimerStarted = true;
  setInterval(() => {
    runDueCheckinReminders().catch(err => app.log.error(err));
    maybeRunAutoBackup().catch(err => app.log.error(err));
    archiveExpiredCheckinEvents();
  }, 60 * 1000);
}

// 活动结束后在「已结束」保留 30 天，超过 30 天的自动移入回收站
function archiveExpiredCheckinEvents() {
  try {
    const threshold = bjtDaysAgo(30);
    const result = db.prepare(`
      UPDATE checkin_events
      SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now')
      WHERE is_deleted = 0 AND end_date < ?
    `).run(threshold);
    if (result.changes > 0) {
      app.log.info(`已自动归档 ${result.changes} 个结束超过30天的打卡活动到回收站`);
    }
  } catch (err) {
    app.log.error(err);
  }
}

// 每日自动备份：到达设定时间（北京时间，默认 03:30）且当天未备份时执行一次
async function maybeRunAutoBackup() {
  const nowHHMM = new Date(Date.now() + BJT_MS).toISOString().slice(11, 16);
  if (nowHHMM < AUTO_BACKUP_TIME) return;
  const today = bjtToday();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'last_auto_backup_date'").get() as any;
  if (row && row.value === today) return;
  try {
    const backup = await createBackup();
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('last_auto_backup_date', ?, datetime('now'))")
      .run(today);
    app.log.info(`每日自动备份完成：${backup.name} (${backup.size} bytes)`);
  } catch (err) {
    app.log.error(err, '每日自动备份失败');
  } finally {
    // 无论备份成败，都做一次媒体完整性体检，发现「库有记录、盘上没文件」时告警
    reportMediaIntegrity();
  }
}

// 每日媒体完整性体检：扫描数据库引用的 /uploads 文件，磁盘缺失时用 error 级日志告警
function reportMediaIntegrity() {
  try {
    const scan = scanMediaReferences(path.join(dataDir, 'learngrow.db'));
    if (scan.missing > 0) {
      app.log.error(
        { referenced: scan.referenced, missing: scan.missing, samples: scan.samples },
        `⚠️ 媒体完整性告警：数据库引用 ${scan.referenced} 个媒体文件，其中 ${scan.missing} 个在磁盘上缺失`
      );
    } else {
      app.log.info(`媒体完整性正常：${scan.referenced} 个媒体引用全部存在`);
    }
  } catch (err) {
    app.log.error(err, '媒体完整性体检失败');
  }
}

// 注册指标监控路由
registerMetricsRoutes(app);

export default app;

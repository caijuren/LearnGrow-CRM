import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import { adminOnly, authMiddleware, JWT_SECRET, type AuthUser } from './services/auth.js';
import db from './db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID, createHash } from 'crypto';
import type { Customer, Product, FollowUp, TodoItem, CustomerSuggestion, Customer360, LiveCustomerCard, DashboardData, OrderWithProduct, OrderWithCustomer, WechatGroup, WechatGroupMember, Child, ChildWithProgress, ChildLearningProgress, LearningPath, LearningStage, Textbook, CheckinEvent, CheckinParticipant, CheckinRecord, CheckinParticipantStats, CheckinEventDetail, CustomerStage, Material, MaterialCategory } from '../shared/types.js';

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

function mapCustomer(c: any): Customer {
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

function getParentName(name: string): string {
  return name.split('-')[0];
}

function getCustomerSuggestions(customerId: number, customer: Customer): CustomerSuggestion[] {
  const suggestions: CustomerSuggestion[] = [];
  const orders = db.prepare(`SELECT o.*, p.name as product_name, p.tier as product_tier, p.related_product_ids FROM orders o JOIN products p ON o.product_id = p.id WHERE o.customer_id = ? ORDER BY o.purchase_date DESC`).all(customerId) as any[];
  const allProducts = (db.prepare('SELECT * FROM products WHERE is_on_sale = 1').all() as any[]).map(mapProduct);

  if (orders.length === 0) {
    const trafficProducts = allProducts.filter(p => p.tier === 'traffic');
    if (trafficProducts.length > 0) {
      const p = trafficProducts[0];
      suggestions.push({ type: 'new_customer', title: '新家长，推引流款', reason: '还没买过资料，先从低价福利款建立信任', product: p, script: `${getParentName(customer.name)}你好呀~我是直播间的XX老师，感谢你加我！给你准备了个新人福利，${p.name}只要${p.price}元，特别适合孩子打基础，要不要带一份？` });
    }
  } else {
    const lastOrder = orders[0];
    const lastProduct = allProducts.find(p => p.id === lastOrder.product_id);
    if (lastProduct?.related_product_ids && lastProduct.related_product_ids.length > 0) {
      for (const rid of lastProduct.related_product_ids) {
        const related = allProducts.find(p => p.id === rid);
        if (related && !orders.some(o => o.product_id === rid)) {
          suggestions.push({ type: 'related', title: `搭配${related.name}效果更好`, reason: `买过${lastProduct.name}的家长经常一起买${related.name}`, product: related, script: `对了${getParentName(customer.name)}，你上次拿的${lastProduct.name}搭配${related.name}效果特别好！${related.selling_points}，孩子学起来更系统，要不要一起带一份？` });
          break;
        }
      }
    }
    const mainBought = orders.some(o => o.product_tier === 'main');
    const premiumBought = orders.some(o => o.product_tier === 'premium');
    if (customer.importance === 'vip' && mainBought && !premiumBought) {
      const premium = allProducts.find(p => p.tier === 'premium' && !orders.some(o => o.product_id === p.id));
      if (premium) suggestions.push({ type: 'upsell', title: '推荐VIP专属服务', reason: '是重点家长，已经买过主力资料，可以推荐1对1规划服务', product: premium, script: `${getParentName(customer.name)}，跟你说个特别好的服务，我们这个${premium.name}反馈特别好，${premium.selling_points}，我第一时间想到你家孩子，给你留个名额？` });
    }
    if (customer.last_follow_date) {
      const daysSinceFollow = Math.floor((Date.now() - new Date(customer.last_follow_date).getTime()) / 86400000);
      if (daysSinceFollow >= 15) suggestions.push({ type: 'reconnect', title: '好久没聊了，打个招呼', reason: `已经${Math.floor(daysSinceFollow)}天没联系了，问问孩子最近学习情况`, script: `${getParentName(customer.name)}好久没聊啦~孩子最近学习咋样？有没有遇到什么问题？我这边新到了点好资料，有空来直播间看看呀！` });
    }
    const consideringFollowUp = db.prepare(`SELECT * FROM follow_ups WHERE customer_id = ? AND result = 'considering' AND date >= date('now', '-7 days') ORDER BY date DESC LIMIT 1`).get(customerId) as any;
    if (consideringFollowUp) {
      const daysSince = Math.floor((Date.now() - new Date(consideringFollowUp.date).getTime()) / 86400000);
      if (daysSince >= 3) suggestions.push({ type: 'considering', title: '上次说考虑的，回访一下', reason: `${Math.floor(daysSince)}天前说"考虑一下"，该回访了`, script: `${getParentName(customer.name)}，上次你说考虑的那个资料，现在想得咋样啦？孩子学习不等人，有啥疑问随时问我哈~` });
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

function getTodos(): TodoItem[] {
  const todos: TodoItem[] = [];
  const today = bjtToday();
  const customers = (db.prepare('SELECT * FROM customers').all() as any[]).map(mapCustomer);

  for (const c of customers) {
    if (c.importance === 'vip') {
      const daysSinceFollow = c.last_follow_date ? Math.floor((Date.now() - new Date(c.last_follow_date).getTime()) / 86400000) : 999;
      if (daysSinceFollow >= 7) todos.push({ id: `vip_${c.id}`, type: 'vip_follow', priority: 'high', customer_id: c.id, customer_name: c.name, title: `${c.name} - 重点家长跟进`, description: `已经${Math.floor(daysSinceFollow)}天没联系了，重点家长要常维护`, suggested_script: `${getParentName(c.name)}最近咋样呀？上次给孩子拿的资料用得还好不？` });
    }
  }

  const reminders = db.prepare(`SELECT f.*, c.name as customer_name FROM follow_ups f JOIN customers c ON f.customer_id = c.id WHERE f.next_follow_date IS NOT NULL AND date(f.next_follow_date) <= date(?) ORDER BY f.next_follow_date ASC`).all(today) as any[];
  for (const r of reminders) todos.push({ id: `reminder_${r.id}`, type: 'reminder', priority: 'high', customer_id: r.customer_id, customer_name: r.customer_name, title: `${r.customer_name} - 跟进提醒`, description: r.content, due_date: r.next_follow_date, follow_up_id: r.id });

  const considering = db.prepare(`SELECT f.*, c.name as customer_name FROM follow_ups f JOIN customers c ON f.customer_id = c.id WHERE f.result = 'considering' AND julianday('now') - julianday(f.date) >= 3 AND NOT EXISTS (SELECT 1 FROM follow_ups f2 WHERE f2.customer_id = f.customer_id AND f2.date > f.date)`).all() as any[];
  for (const r of considering) {
    if (!todos.some(t => t.customer_id === r.customer_id && t.type === 'considering')) todos.push({ id: `considering_${r.id}`, type: 'considering', priority: 'medium', customer_id: r.customer_id, customer_name: r.customer_name, title: `${r.customer_name} - 说考虑中，该回访了`, description: r.content, follow_up_id: r.id, suggested_script: `${getParentName(r.customer_name)}，上次你说考虑的那个资料，现在想得咋样啦？` });
  }

  for (const c of customers) {
    const daysSinceFollow = c.last_follow_date ? Math.floor((Date.now() - new Date(c.last_follow_date).getTime()) / 86400000) : 999;
    if (c.order_count === 0 && daysSinceFollow >= 15 && !todos.some(t => t.customer_id === c.id)) {
      todos.push({ id: `silent_${c.id}`, type: 'long_time_no_talk', priority: 'low', customer_id: c.id, customer_name: c.name, title: `${c.name} - 好久没联系了`, description: `${Math.floor(daysSinceFollow)}天没互动了，打个招呼问问孩子情况吧`, suggested_script: `${getParentName(c.name)}好久没聊啦~孩子最近学习咋样？` });
    }
  }

  todos.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority]) - ({ high: 0, medium: 1, low: 2 }[b.priority]));
  return todos;
}

function updateCustomerStats(customerId: number) {
  const orders = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt, MAX(purchase_date) as last_date FROM orders WHERE customer_id = ?").get(customerId) as any;
  const lastFollow = db.prepare("SELECT MAX(date) as last_date FROM follow_ups WHERE customer_id = ?").get(customerId) as any;
  db.prepare("UPDATE customers SET total_spent = ?, order_count = ?, last_order_date = ?, last_follow_date = ?, updated_at = datetime('now') WHERE id = ?").run(orders.total || 0, orders.cnt || 0, orders.last_date || null, lastFollow.last_date || null, customerId);
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
await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: JWT_SECRET, sign: { expiresIn: '7d' } });
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

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

app.post('/api/auth/login', async (request, reply) => {
  if (!allowAdminLogin(request, reply)) return;
  const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ success: false, error: '用户名和密码不能为空' });
  const { username, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) return reply.code(401).send({ success: false, error: '用户名或密码错误' });
  if (!bcrypt.compareSync(password, user.password)) return reply.code(401).send({ success: false, error: '用户名或密码错误' });
  const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role });
  return ok({ token, user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
});

app.get('/api/auth/me', { preHandler: [authMiddleware] }, async (request, reply) => {
  const user = db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get((request.user as AuthUser).id) as any;
  if (!user) return reply.code(404).send({ success: false, error: '用户不存在' });
  return ok(user);
});

app.get('/api/dashboard', { preHandler: [authMiddleware] }, async () => {
  const today = bjtToday();
  const threeDaysAgo = bjtDaysAgo(3);
  const sevenDaysAgo = bjtDaysAgo(7);
  const thirtyDaysAgo = bjtDaysAgo(30);
  const thisMonth = today.slice(0, 7);
  const todayRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE date(purchase_date) = ?").get(today) as any).s;
  const monthRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE substr(purchase_date, 1, 7) = ?").get(thisMonth) as any).s;
  const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
  const todayNewCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE date(created_at) = ?").get(today) as any).c;
  const newFriendsCount = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE wechat_add_date >= ?").get(threeDaysAgo) as any).c;
  const silentCount = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE (last_follow_date IS NULL OR last_follow_date < ?) AND (last_order_date IS NULL OR last_order_date < ?) AND stage != 'purchased' AND stage != 'repurchased'").get(thirtyDaysAgo, thirtyDaysAgo) as any).c;
  const todos = getTodos();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = bjtDaysAgo(i);
    const rev = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE date(purchase_date) = ?").get(dateStr) as any).s;
    last7Days.push({ date: dateStr.slice(5), revenue: rev || 0 });
  }
  const recentOrdersRaw = db.prepare(`SELECT o.*, c.name as customer_name, p.name as product_name, p.tier as product_tier FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id ORDER BY o.created_at DESC LIMIT 10`).all() as any[];

  const stageStatsRaw = db.prepare("SELECT stage, COUNT(*) as count FROM customers GROUP BY stage").all() as any[];
  const allStages: CustomerStage[] = ['new_friend', 'initial_chat', 'interested', 'purchased', 'in_group', 'repurchased', 'silent'];
  const stageStats = allStages.map(s => {
    const found = stageStatsRaw.find(r => r.stage === s);
    return { stage: s, count: found ? found.count : 0 };
  });

  const needFollowRaw = db.prepare(`
    SELECT id, name, stage, wechat_id, wechat_account, importance, last_follow_date, next_talk_topic
    FROM customers
    WHERE next_talk_topic IS NOT NULL AND next_talk_topic != ''
       OR last_follow_date IS NULL
       OR last_follow_date < ?
       OR (stage = 'new_friend' AND (wechat_add_date IS NULL OR wechat_add_date <= ?))
    ORDER BY CASE importance WHEN 'vip' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
             last_follow_date IS NULL DESC,
             last_follow_date ASC
    LIMIT 20
  `).all(sevenDaysAgo, today) as any[];

  return ok({
    stats: {
      today_revenue: todayRevenue || 0,
      month_revenue: monthRevenue || 0,
      total_customers: totalCustomers,
      today_new_customers: todayNewCustomers,
      pending_todos: todos.length,
      need_follow_count: needFollowRaw.length,
      new_friends_count: newFriendsCount,
      silent_count: silentCount,
    },
    stageStats,
    needFollowCustomers: needFollowRaw.map(c => ({
      ...c,
      stage: c.stage || 'new_friend',
      wechat_account: c.wechat_account || 'main',
    })),
    revenueTrend: last7Days,
    todos: todos.slice(0, 20),
    recentOrders: recentOrdersRaw as OrderWithCustomer[]
  } satisfies DashboardData);
});

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { search, importance, stage, need_follow, tag, page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    const today = bjtToday();
    const sevenDaysAgo = bjtDaysAgo(7);
    let sql = 'SELECT * FROM customers WHERE 1=1', params: any[] = [];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (importance) { sql += ' AND importance = ?'; params.push(importance); }
    if (stage) { sql += ' AND stage = ?'; params.push(stage); }
    if (need_follow === 'true') {
      sql += " AND (next_talk_topic IS NOT NULL AND next_talk_topic != '' OR last_follow_date IS NULL OR last_follow_date < ? OR (stage = 'new_friend' AND (wechat_add_date IS NULL OR wechat_add_date <= ?)))";
      params.push(sevenDaysAgo, today);
    }
    if (tag) { sql += ' AND tags LIKE ?'; params.push(`%"${tag}"%`); }
    sql += " ORDER BY CASE importance WHEN 'vip' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, last_follow_date IS NULL, last_follow_date DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);
    const customers = (db.prepare(sql).all(...params) as any[]).map(mapCustomer);
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1', cparams: any[] = [];
    if (search) { countSql += ' AND (name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR wechat_id LIKE ? OR wechat_remark LIKE ? OR douyin_nickname LIKE ? OR remark LIKE ? OR next_talk_topic LIKE ?)'; cparams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (importance) { countSql += ' AND importance = ?'; cparams.push(importance); }
    if (stage) { countSql += ' AND stage = ?'; cparams.push(stage); }
    if (need_follow === 'true') {
      countSql += " AND (next_talk_topic IS NOT NULL AND next_talk_topic != '' OR last_follow_date IS NULL OR last_follow_date < ? OR (stage = 'new_friend' AND (wechat_add_date IS NULL OR wechat_add_date <= ?)))";
      cparams.push(sevenDaysAgo, today);
    }
    if (tag) { countSql += ' AND tags LIKE ?'; cparams.push(`%"${tag}"%`); }
    const total = (db.prepare(countSql).get(...cparams) as any).total;
    return ok({ customers, total });
  });

  router.get('/all-tags', async () => {
    const all = db.prepare('SELECT tags FROM customers').all() as any[];
    const tagSet = new Set<string>();
    all.forEach(c => parseJson(c.tags, [] as string[]).forEach((t: string) => tagSet.add(t)));
    return ok(Array.from(tagSet).sort());
  });

  router.get('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!c) return reply.code(404).send({ success: false, error: '客户不存在' });
    const customer = mapCustomer(c);
    const ordersRaw = db.prepare(`SELECT o.*, p.name as product_name, p.tier as product_tier FROM orders o JOIN products p ON o.product_id = p.id WHERE o.customer_id = ? ORDER BY o.purchase_date DESC`).all(id) as any[];
    const followUps = (db.prepare('SELECT * FROM follow_ups WHERE customer_id = ? ORDER BY date DESC, created_at DESC').all(id) as any[]).map(mapFollowUp);
    const children = (db.prepare('SELECT * FROM children WHERE customer_id = ? ORDER BY created_at DESC').all(id) as any[]).map((ch: any) => ({
      ...ch,
      weak_subjects: parseJson<string[]>(ch.weak_subjects, []),
    }));
    return ok({ ...customer, children, orders: ordersRaw as OrderWithProduct[], follow_ups: followUps, suggestions: getCustomerSuggestions(id, customer) } satisfies Customer360);
  });

  router.post('/', async (request: any, reply: any) => {
    const { name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account = 'main', douyin_nickname, source, importance = 'normal', stage = 'new_friend', tags = [], remark, next_talk_topic } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '备注名不能为空' });
    const r = db.prepare('INSERT INTO customers (name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, tags, remark, next_talk_topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      name, nickname || null, phone || null, wechat_id || null, wechat_remark || null, wechat_add_date || null, wechat_account, douyin_nickname || null, source || 'other', importance, stage, JSON.stringify(tags), remark || null, next_talk_topic || null
    );
    return reply.code(201).send(ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '客户不存在' });
    const { name, nickname, phone, wechat_id, wechat_remark, wechat_add_date, wechat_account, douyin_nickname, source, importance, stage, tags, remark, next_talk_topic } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (wechat_id !== undefined) { fields.push('wechat_id = ?'); params.push(wechat_id); }
    if (wechat_remark !== undefined) { fields.push('wechat_remark = ?'); params.push(wechat_remark); }
    if (wechat_add_date !== undefined) { fields.push('wechat_add_date = ?'); params.push(wechat_add_date); }
    if (wechat_account !== undefined) { fields.push('wechat_account = ?'); params.push(wechat_account); }
    if (douyin_nickname !== undefined) { fields.push('douyin_nickname = ?'); params.push(douyin_nickname); }
    if (source !== undefined) { fields.push('source = ?'); params.push(source); }
    if (importance !== undefined) { fields.push('importance = ?'); params.push(importance); }
    if (stage !== undefined) { fields.push('stage = ?'); params.push(stage); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (remark !== undefined) { fields.push('remark = ?'); params.push(remark); }
    if (next_talk_topic !== undefined) { fields.push('next_talk_topic = ?'); params.push(next_talk_topic); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  });

  router.delete('/:id', async (request: any) => { db.prepare('DELETE FROM customers WHERE id = ?').run(parseInt(request.params.id)); return ok({ deleted: true }); });

  router.post('/:id/follow-ups', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { method, content, result, next_follow_date, is_live_note = false, child_id } = request.body;
    if (!method || !content) return reply.code(400).send({ success: false, error: '方式和内容不能为空' });
    const r = db.prepare('INSERT INTO follow_ups (customer_id, child_id, method, content, result, next_follow_date, is_live_note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, child_id || null, method, content, result || null, next_follow_date || null, is_live_note ? 1 : 0);
    updateCustomerStats(id);
    return reply.code(201).send(ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.post('/:id/orders', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { product_id, amount, order_type, remark, shipping_note, child_id } = request.body;
    if (!product_id) return reply.code(400).send({ success: false, error: '请选择产品' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!product) return reply.code(400).send({ success: false, error: '产品不存在' });
    const finalAmount = amount || product.price;
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(id) as any).c;
    const finalType = order_type || (existingCount === 0 ? 'first' : 'repurchase');
    const r = db.prepare("INSERT INTO orders (order_no, customer_id, child_id, product_id, amount, order_type, remark, shipping_note, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))").run(generateOrderNo(), id, child_id || null, product_id, finalAmount, finalType, remark || null, shipping_note || null);
    updateCustomerStats(id);
    updateProductSales(product_id);
    return reply.code(201).send(ok(db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.get('/:id/suggestions', async (request: any) => {
    const id = parseInt(request.params.id);
    return ok(getCustomerSuggestions(id, mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id))));
  });

  router.put('/:id/tags', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '客户不存在' });
    const { tags } = request.body;
    db.prepare("UPDATE customers SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(tags || []), id);
    return ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  });

  router.put('/:id/importance', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '客户不存在' });
    const { importance } = request.body;
    if (!['vip', 'normal', 'watch'].includes(importance)) return reply.code(400).send({ success: false, error: '重要性值无效' });
    db.prepare("UPDATE customers SET importance = ?, updated_at = datetime('now') WHERE id = ?").run(importance, id);
    return ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  });
}, { prefix: '/api/customers' });

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

  router.post('/', async (request: any, reply: any) => {
    const { name, tier = 'main', category, price, commission_percent = 0, selling_points, related_product_ids = [], description, is_on_sale = true } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '商品名不能为空' });
    const r = db.prepare('INSERT INTO products (name, tier, category, price, commission_percent, selling_points, related_product_ids, description, is_on_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, tier, category || null, price || 0, commission_percent || 0, selling_points || null, JSON.stringify(related_product_ids), description || null, is_on_sale ? 1 : 0);
    return reply.code(201).send(ok(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
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

  router.delete('/:id', async (request: any) => { db.prepare('DELETE FROM products WHERE id = ?').run(parseInt(request.params.id)); return ok(null); });
}, { prefix: '/api/products' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/', async (request: any) => {
    const { customer_id, page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    let sql = `SELECT o.*, c.name as customer_name, p.name as product_name, p.tier as product_tier FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id WHERE 1=1`, params: any[] = [];
    if (customer_id) { sql += ' AND o.customer_id = ?'; params.push(customer_id); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'; params.push(limitNum, offset);
    return ok({ orders: db.prepare(sql).all(...params), total: (db.prepare('SELECT COUNT(*) as total FROM orders').get() as any).total });
  });
  router.delete('/:id', async (request: any) => {
    const id = parseInt(request.params.id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    if (order) { updateCustomerStats(order.customer_id); updateProductSales(order.product_id); }
    return ok(null);
  });
}, { prefix: '/api/orders' });

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);
  router.get('/customer/:cid', async (request: any) => ok((db.prepare('SELECT * FROM follow_ups WHERE customer_id = ? ORDER BY date DESC, created_at DESC').all(parseInt(request.params.cid)) as any[]).map(mapFollowUp)));
  router.get('/', async (request: any) => {
    const { page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    return ok({ follow_ups: (db.prepare(`SELECT f.*, c.name as customer_name FROM follow_ups f JOIN customers c ON f.customer_id = c.id ORDER BY f.date DESC, f.created_at DESC LIMIT ? OFFSET ?`).all(limitNum, offset) as any[]).map(mapFollowUp) });
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
  router.delete('/:id', async (request: any) => {
    const id = parseInt(request.params.id);
    const f = db.prepare('SELECT customer_id FROM follow_ups WHERE id = ?').get(id) as any;
    db.prepare('DELETE FROM follow_ups WHERE id = ?').run(id);
    if (f) updateCustomerStats(f.customer_id);
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
    const customers = (db.prepare('SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR douyin_nickname LIKE ? LIMIT 20').all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`) as any[]).map(mapCustomer);
    const results: LiveCustomerCard[] = [];
    for (const c of customers) {
      const recentOrders = db.prepare('SELECT p.name as product_name, o.purchase_date, o.amount FROM orders o JOIN products p ON o.product_id = p.id WHERE o.customer_id = ? ORDER BY o.purchase_date DESC LIMIT 3').all(c.id) as any[];
      const recentFollowUp = db.prepare('SELECT content, date FROM follow_ups WHERE customer_id = ? ORDER BY date DESC LIMIT 1').get(c.id) as any;
      const children = db.prepare('SELECT id, nickname, grade FROM children WHERE customer_id = ? ORDER BY created_at DESC').all(c.id) as any[];
      results.push({ id: c.id, name: c.name, nickname: c.nickname, avatar: c.avatar, importance: c.importance, tags: c.tags, total_spent: c.total_spent, order_count: c.order_count, last_order_date: c.last_order_date, last_follow_date: c.last_follow_date, recent_orders: recentOrders, recent_follow_up: recentFollowUp ? { content: recentFollowUp.content, date: recentFollowUp.date } : null, suggestions: getCustomerSuggestions(c.id, c).slice(0, 2), children: children.length > 0 ? children : undefined });
    }
    return ok(results);
  });
  router.post('/quick-note', async (request: any, reply: any) => {
    const { customer_id, content, child_id } = request.body;
    if (!customer_id || !content) return reply.code(400).send({ success: false, error: '客户和内容不能为空' });
    const r = db.prepare("INSERT INTO follow_ups (customer_id, child_id, method, content, is_live_note) VALUES (?, ?, 'live', ?, 1)").run(customer_id, child_id || null, content);
    updateCustomerStats(customer_id);
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

  router.post('/', async (request: any, reply: any) => {
    const { name, purpose, description, member_count = 0, status = 'active', tags = [], group_rules, owner_note, notes } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '群名称不能为空' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO wechat_groups (name, purpose, description, member_count, status, tags, group_rules, owner_note, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, purpose || null, description || null, member_count || 0, status, JSON.stringify(tags), group_rules || null, owner_note || null, notes || null, now, now);
    return reply.code(201).send(ok(mapGroup(db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
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

  router.delete('/:id', async (request: any, reply: any) => {
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
    const { wechat_name, nickname, role = 'active', tags = [], customer_id, activity_score = 50, remark } = request.body;
    if (!wechat_name) return reply.code(400).send({ success: false, error: '微信昵称不能为空' });
    const r = db.prepare(`
      INSERT INTO wechat_group_members (group_id, wechat_name, nickname, role, tags, customer_id, activity_score, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, wechat_name, nickname || null, role, JSON.stringify(tags), customer_id || null, activity_score || 50, remark || null);
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    return reply.code(201).send(ok(mapGroupMember(db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id/members/:memberId', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    const memberId = parseInt(request.params.memberId);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.code(404).send({ success: false, error: '群不存在' });
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.code(404).send({ success: false, error: '成员不存在' });
    const { wechat_name, nickname, role, tags, customer_id, activity_score, remark } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (wechat_name !== undefined) { fields.push('wechat_name = ?'); params.push(wechat_name); }
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (role !== undefined) { fields.push('role = ?'); params.push(role); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (customer_id !== undefined) { fields.push('customer_id = ?'); params.push(customer_id); }
    if (activity_score !== undefined) { fields.push('activity_score = ?'); params.push(activity_score); }
    if (remark !== undefined) { fields.push('remark = ?'); params.push(remark); }
    params.push(memberId);
    db.prepare(`UPDATE wechat_group_members SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapGroupMember(db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(memberId)));
  });

  router.delete('/:id/members/:memberId', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    const memberId = parseInt(request.params.memberId);
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.code(404).send({ success: false, error: '成员不存在' });
    db.prepare('DELETE FROM wechat_group_members WHERE id = ?').run(memberId);
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    return ok(null);
  });
}, { prefix: '/api/wechat-groups' });

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
    const { customer_id } = request.query as any;
    if (!customer_id) return ok([]);
    return ok((db.prepare('SELECT * FROM children WHERE customer_id = ? ORDER BY created_at DESC').all(parseInt(customer_id)) as any[]).map(mapChild));
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
      ORDER BY cp.created_at DESC
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
    const { customer_id, nickname, gender, birth_date, grade, region, textbook_version, weak_subjects = [], notes } = request.body;
    if (!customer_id || !nickname || !grade) return reply.code(400).send({ success: false, error: '家长ID、昵称和年级不能为空' });
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id)) return reply.code(404).send({ success: false, error: '客户不存在' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO children (customer_id, nickname, gender, birth_date, grade, region, textbook_version, weak_subjects, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, nickname, gender || null, birth_date || null, grade, region || null, textbook_version || null, JSON.stringify(weak_subjects), notes || null, now, now);
    return reply.code(201).send(ok(mapChild(db.prepare('SELECT * FROM children WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(id)) return reply.code(404).send({ success: false, error: '孩子不存在' });
    const { nickname, gender, birth_date, grade, region, textbook_version, weak_subjects, notes } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (gender !== undefined) { fields.push('gender = ?'); params.push(gender); }
    if (birth_date !== undefined) { fields.push('birth_date = ?'); params.push(birth_date); }
    if (grade !== undefined) { fields.push('grade = ?'); params.push(grade); }
    if (region !== undefined) { fields.push('region = ?'); params.push(region); }
    if (textbook_version !== undefined) { fields.push('textbook_version = ?'); params.push(textbook_version); }
    if (weak_subjects !== undefined) { fields.push('weak_subjects = ?'); params.push(JSON.stringify(weak_subjects)); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapChild(db.prepare('SELECT * FROM children WHERE id = ?').get(id)));
  });

  router.delete('/:id', async (request: any, reply: any) => {
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

  router.delete('/:id/progress/:progressId', async (request: any, reply: any) => {
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

  router.post('/', async (request: any, reply: any) => {
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

  router.put('/:id', async (request: any, reply: any) => {
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

  router.delete('/:id', async (request: any, reply: any) => {
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
    let sql = `SELECT e.*, g.name as group_name, 
      (SELECT COUNT(*) FROM checkin_participants WHERE event_id = e.id) as participant_count,
      CAST(julianday(e.end_date) - julianday(e.start_date) + 1 AS INTEGER) as total_days
      FROM checkin_events e LEFT JOIN wechat_groups g ON e.group_id = g.id WHERE e.is_deleted = 0`;
    const params: any[] = [];
    if (status) { sql += ' AND e.status = ?'; params.push(status); }
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

    const participantsRaw = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? ORDER BY joined_at ASC').all(id) as any[];
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

  router.post('/', async (request: any, reply: any) => {
    const {
      name,
      group_id,
      start_date,
      end_date,
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
        name, group_id, start_date, end_date, required_text, reward_rules,
        allow_makeup, makeup_window_days, makeup_limit_per_user, makeup_requires_review, makeup_counts_for_streak,
        status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      group_id || null,
      start_date,
      end_date,
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
    
    if (group_id) {
      const members = db.prepare('SELECT id, wechat_name, nickname, customer_id FROM wechat_group_members WHERE group_id = ?').all(group_id) as any[];
      const insertParticipant = db.prepare(`
        INSERT INTO checkin_participants (event_id, member_id, customer_id, nickname, child_name)
        VALUES (?, ?, ?, ?, ?)
      `);
      const insertMembers = db.transaction((mems: any[]) => {
        for (const m of mems) {
          insertParticipant.run(r.lastInsertRowid, m.id, m.customer_id || null, m.nickname || m.wechat_name, null);
        }
      });
      insertMembers(members);
    }
    
    return reply.code(201).send(ok(mapCheckinEvent(db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(id)) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
    const {
      name,
      group_id,
      start_date,
      end_date,
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

  router.delete('/:id', async (request: any, reply: any) => {
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

  router.put('/:id/restore', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 1').get(id);
    if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在或未被删除' });
    db.prepare("UPDATE checkin_events SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    return ok(mapCheckinEvent(db.prepare('SELECT * FROM checkin_events WHERE id = ?').get(id)));
  });

  router.delete('/:id/permanent', async (request: any, reply: any) => {
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
    const { member_id, customer_id, nickname, child_name } = request.body;
    if (!nickname) return reply.code(400).send({ success: false, error: '昵称不能为空' });
    const r = db.prepare(`
      INSERT INTO checkin_participants (event_id, member_id, customer_id, nickname, child_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventId, member_id || null, customer_id || null, nickname, child_name || null);
    return reply.code(201).send(ok(mapCheckinParticipant(db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.delete('/:id/participants/:pid', async (request: any, reply: any) => {
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
    return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.delete('/:id/checkin/:rid', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const rid = parseInt(request.params.rid);
    const record = db.prepare('SELECT * FROM checkin_records WHERE id = ? AND event_id = ?').get(rid, eventId) as any;
    if (!record) return reply.code(404).send({ success: false, error: '打卡记录不存在' });
    db.prepare('DELETE FROM checkin_records WHERE id = ?').run(rid);
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
        insertRecord.run(eventId, pid, checkin_date, note || null);
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

  router.patch('/:id', async (request: any, reply: any) => {
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

  router.delete('/:id', async (request: any, reply: any) => {
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
    const user = db.prepare('SELECT * FROM wx_users WHERE id = ?').get(decoded.wxUserId) as any;
    if (user) {
      request.wxUser = user;
    }
  } catch (e) {
  }
}

app.post('/api/wx/login', async (request: any, reply: any) => {
  const { code, nickname, avatar_url, child_name } = request.body;
  
  let openid: string;
  const WX_APPID = process.env.WX_APPID;
  const WX_SECRET = process.env.WX_SECRET || process.env.WX_APPSECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!WX_APPID || !WX_SECRET) {
    request.log.error('微信登录配置缺失：WX_APPID 或 WX_SECRET 未设置');
    if (isProduction) return reply.code(500).send({ success: false, error: '微信登录配置缺失' });
    openid = `dev_${code || randomUUID()}`;
  } else if (!code) {
    if (isProduction) return reply.code(400).send({ success: false, error: '缺少微信登录凭证' });
    openid = `dev_${randomUUID()}`;
  } else {
    let data: any;
    try {
      const res = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`);
      data = await res.json();
      request.log.info({ wxCode: code.substring(0, 8) + '...', wxResponse: data }, '微信 jscode2session 响应');
    } catch (e) {
      request.log.error({ err: e }, '调用微信 jscode2session 失败');
      if (isProduction) return reply.code(502).send({ success: false, error: '微信登录服务暂不可用' });
    }

    if (!data) {
      openid = `dev_${code}`;
    } else if (data.openid) {
      openid = data.openid;
    } else if (isProduction) {
      request.log.error({ wxErrcode: data.errcode, wxErrmsg: data.errmsg }, '微信 jscode2session 返回错误');
      return reply.code(401).send({ success: false, error: data.errmsg || '微信登录失败' });
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

  const token = app.jwt.sign({ wxUserId: user.id }, { expiresIn: '30d' });
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
  const { nickname, avatar_url, child_name } = request.body;
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
        (e.start_date > date('now') AND e.start_date <= date('now', '+3 days'))
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
      required_text: e.required_text,
      reward_rules: e.reward_rules,
      status: e.status,
      event_status: eventStatus,
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

  const existing = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(eventId, user.id);
  if (existing) return reply.code(409).send({ success: false, error: '您已加入该活动' });
  
  const nickname = user.nickname || '微信用户';
  const r = db.prepare(`
    INSERT INTO checkin_participants (event_id, wx_user_id, nickname, child_name)
    VALUES (?, ?, ?, ?)
  `).run(eventId, user.id, nickname, user.child_name || null);
  
  return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_participants WHERE id = ?').get(r.lastInsertRowid)));
});

app.post('/api/wx/checkin', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const { event_id, note, image_url, image_hash, checkin_date, display_name, media_type } = request.body;

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
      return ok({
        ...(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get((existing as any).id) as object),
        checkin_number: null,
        pending_review: recordStatus === 'pending',
        new_badges: []
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
    new_badges: newBadges
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

  const participants = db.prepare('SELECT * FROM checkin_participants WHERE event_id = ?').all(eventId) as any[];
  const records = db.prepare('SELECT * FROM checkin_records WHERE event_id = ?').all(eventId) as any[];

  const me = user ? db.prepare('SELECT * FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(eventId, user.id) as any : null;

  const ranking = participants.map(p => {
    const pRecords = records.filter(r => r.participant_id === p.id && r.status === 'approved');
    const stats = calculateStreaks(pRecords, event.start_date, event.end_date, !!event.makeup_counts_for_streak);
    return {
      participant_id: p.id,
      nickname: p.nickname,
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
    checkin_days: r.checkin_days,
    current_streak: r.current_streak,
    is_me: r.is_me,
  }));

  return ok(result);
});

app.put('/api/wx/checkin-records/:id', { preHandler: [wxAuthMiddleware] }, async (request: any, reply: any) => {
  const user = request.wxUser;
  const recordId = parseInt(request.params.id);
  const { image_url, image_hash, note, media_type } = request.body;

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
  const { is_enabled, remind_time = '20:00' } = request.body;
  const event = db.prepare('SELECT id FROM checkin_events WHERE id = ? AND is_deleted = 0').get(eventId) as any;
  if (!event) return reply.code(404).send({ success: false, error: '打卡活动不存在' });
  if (!/^\d{2}:\d{2}$/.test(remind_time)) return reply.code(400).send({ success: false, error: '提醒时间格式无效' });

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
  const now = new Date();
  const today = bjtToday();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
      SELECT r.*, p.nickname, p.child_name, p.wx_user_id
      FROM checkin_records r
      JOIN checkin_participants p ON r.participant_id = p.id
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

    return ok(db.prepare('SELECT * FROM checkin_records WHERE id = ?').get(recordId));
  });

  router.get('/:id/export', async (request: any, reply: any) => {
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

  router.get('/:id/badges', async (request: any) => {
    const eventId = parseInt(request.params.id);
    const badges = db.prepare('SELECT * FROM checkin_badges WHERE event_id = ? ORDER BY target_days ASC').all(eventId);
    return ok(badges);
  });

  router.post('/:id/badges', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const { name, description, icon, type = 'streak', target_days = 0 } = request.body;
    if (!name) return reply.code(400).send({ success: false, error: '徽章名称不能为空' });

    const r = db.prepare(`
      INSERT INTO checkin_badges (event_id, name, description, icon, type, target_days)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(eventId, name, description || null, icon || null, type, target_days || 0);

    return reply.code(201).send(ok(db.prepare('SELECT * FROM checkin_badges WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.put('/:id/badges/:bid', async (request: any, reply: any) => {
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

  router.delete('/:id/badges/:bid', async (request: any, reply: any) => {
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

  router.post('/:id/rewards/:pid/distribute', async (request: any, reply: any) => {
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

  router.delete('/:id/materials/:mid', async (request: any, reply: any) => {
    const eventId = parseInt(request.params.id);
    const materialId = parseInt(request.params.mid);
    const material = db.prepare('SELECT * FROM checkin_materials WHERE id = ? AND event_id = ?').get(materialId, eventId);
    if (!material) return reply.code(404).send({ success: false, error: '资料不存在' });
    db.prepare('DELETE FROM checkin_materials WHERE id = ?').run(materialId);
    return ok({ deleted: true });
  });
}, { prefix: '/api/checkin-events' });

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
    if (request.url.startsWith('/api/')) {
      return reply.code(404).send({ success: false, error: 'API不存在' });
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
  }, 60 * 1000);
}

export default app;

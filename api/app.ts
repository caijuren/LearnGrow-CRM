import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { authMiddleware, JWT_SECRET, type AuthUser } from './services/auth.js';
import db from './db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Customer, Product, FollowUp, TodoItem, CustomerSuggestion, Customer360, LiveCustomerCard, DashboardData, OrderWithProduct, OrderWithCustomer, WechatGroup, WechatGroupMember, Child, ChildWithProgress, ChildLearningProgress, LearningPath, LearningStage, Textbook } from '../shared/types.js';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function ok<T>(data: T) {
  return { success: true as const, data };
}

function mapCustomer(c: any): Customer {
  return { ...c, tags: parseJson(c.tags, [] as string[]) };
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

function getTodos(): TodoItem[] {
  const todos: TodoItem[] = [];
  const today = new Date().toISOString().split('T')[0];
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

const app = Fastify({ logger: { level: 'info', transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } } } });
await app.register(cors, { origin: true, credentials: true });
await app.register(jwt, { secret: JWT_SECRET, sign: { expiresIn: '7d' } });

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, '..', 'dist');
  await app.register(fastifyStatic, {
    root: distPath,
    prefix: '/',
  });
}

app.get('/api/health', async () => ({ success: true, message: 'ok' }));

app.post('/api/auth/login', async (request, reply) => {
  const parsed = z.object({ username: z.string().min(1), password: z.string().min(1) }).safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ success: false, error: '用户名和密码不能为空' });
  const { username, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  if (!user) return reply.status(401).send({ success: false, error: '用户名或密码错误' });
  if (!bcrypt.compareSync(password, user.password)) return reply.status(401).send({ success: false, error: '用户名或密码错误' });
  const token = app.jwt.sign({ id: user.id, username: user.username, role: user.role });
  return ok({ token, user: { id: user.id, username: user.username, role: user.role, display_name: user.display_name } });
});

app.get('/api/auth/me', { preHandler: [authMiddleware] }, async (request, reply) => {
  const user = db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get((request.user as AuthUser).id) as any;
  if (!user) return reply.status(404).send({ success: false, error: '用户不存在' });
  return ok(user);
});

app.get('/api/dashboard', { preHandler: [authMiddleware] }, async () => {
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);
  const todayRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE date(purchase_date) = ?").get(today) as any).s;
  const monthRevenue = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE substr(purchase_date, 1, 7) = ?").get(thisMonth) as any).s;
  const totalCustomers = (db.prepare('SELECT COUNT(*) as c FROM customers').get() as any).c;
  const todayNewCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers WHERE date(created_at) = ?").get(today) as any).c;
  const todos = getTodos();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
    const rev = (db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM orders WHERE date(purchase_date) = ?").get(dateStr) as any).s;
    last7Days.push({ date: dateStr.slice(5), revenue: rev || 0 });
  }
  const recentOrdersRaw = db.prepare(`SELECT o.*, c.name as customer_name, p.name as product_name, p.tier as product_tier FROM orders o JOIN customers c ON o.customer_id = c.id JOIN products p ON o.product_id = p.id ORDER BY o.created_at DESC LIMIT 10`).all() as any[];
  return ok({ stats: { today_revenue: todayRevenue || 0, month_revenue: monthRevenue || 0, total_customers: totalCustomers, today_new_customers: todayNewCustomers, pending_todos: todos.length }, revenueTrend: last7Days, todos: todos.slice(0, 20), recentOrders: recentOrdersRaw as OrderWithCustomer[] } satisfies DashboardData);
});

app.register(async function (router) {
  router.addHook('preHandler', authMiddleware);

  router.get('/', async (request: any) => {
    const { search, importance, tag, page = '1', limit = '20' } = request.query as any;
    const pageNum = parseInt(page), limitNum = parseInt(limit), offset = (pageNum - 1) * limitNum;
    let sql = 'SELECT * FROM customers WHERE 1=1', params: any[] = [];
    if (search) { sql += ' AND (name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR douyin_nickname LIKE ? OR remark LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (importance) { sql += ' AND importance = ?'; params.push(importance); }
    if (tag) { sql += ' AND tags LIKE ?'; params.push(`%"${tag}"%`); }
    sql += " ORDER BY CASE importance WHEN 'vip' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, last_follow_date IS NULL, last_follow_date DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offset);
    const customers = (db.prepare(sql).all(...params) as any[]).map(mapCustomer);
    let countSql = 'SELECT COUNT(*) as total FROM customers WHERE 1=1', cparams: any[] = [];
    if (search) { countSql += ' AND (name LIKE ? OR phone LIKE ? OR nickname LIKE ? OR douyin_nickname LIKE ? OR remark LIKE ?)'; cparams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (importance) { countSql += ' AND importance = ?'; cparams.push(importance); }
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
    if (!c) return reply.status(404).send({ success: false, error: '客户不存在' });
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
    const { name, nickname, phone, douyin_nickname, source, importance = 'normal', tags = [], remark } = request.body;
    if (!name) return reply.status(400).send({ success: false, error: '备注名不能为空' });
    const r = db.prepare('INSERT INTO customers (name, nickname, phone, douyin_nickname, source, importance, tags, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(name, nickname || null, phone || null, douyin_nickname || null, source || 'other', importance, JSON.stringify(tags), remark || null);
    return reply.status(201).send(ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '客户不存在' });
    const { name, nickname, phone, douyin_nickname, source, importance, tags, remark } = request.body;
    const fields: string[] = [], params: any[] = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname); }
    if (phone !== undefined) { fields.push('phone = ?'); params.push(phone); }
    if (douyin_nickname !== undefined) { fields.push('douyin_nickname = ?'); params.push(douyin_nickname); }
    if (source !== undefined) { fields.push('source = ?'); params.push(source); }
    if (importance !== undefined) { fields.push('importance = ?'); params.push(importance); }
    if (tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(tags)); }
    if (remark !== undefined) { fields.push('remark = ?'); params.push(remark); }
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  });

  router.delete('/:id', async (request: any) => { db.prepare('DELETE FROM customers WHERE id = ?').run(parseInt(request.params.id)); return ok({ deleted: true }); });

  router.post('/:id/follow-ups', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { method, content, result, next_follow_date, is_live_note = false, child_id } = request.body;
    if (!method || !content) return reply.status(400).send({ success: false, error: '方式和内容不能为空' });
    const r = db.prepare('INSERT INTO follow_ups (customer_id, child_id, method, content, result, next_follow_date, is_live_note) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, child_id || null, method, content, result || null, next_follow_date || null, is_live_note ? 1 : 0);
    updateCustomerStats(id);
    return reply.status(201).send(ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.post('/:id/orders', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    const { product_id, amount, order_type, remark, shipping_note, child_id } = request.body;
    if (!product_id) return reply.status(400).send({ success: false, error: '请选择产品' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id) as any;
    if (!product) return reply.status(400).send({ success: false, error: '产品不存在' });
    const finalAmount = amount || product.price;
    const existingCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(id) as any).c;
    const finalType = order_type || (existingCount === 0 ? 'first' : 'repurchase');
    const r = db.prepare("INSERT INTO orders (order_no, customer_id, child_id, product_id, amount, order_type, remark, shipping_note, purchase_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now'))").run(generateOrderNo(), id, child_id || null, product_id, finalAmount, finalType, remark || null, shipping_note || null);
    updateCustomerStats(id);
    updateProductSales(product_id);
    return reply.status(201).send(ok(db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid)));
  });

  router.get('/:id/suggestions', async (request: any) => {
    const id = parseInt(request.params.id);
    return ok(getCustomerSuggestions(id, mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id))));
  });

  router.put('/:id/tags', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '客户不存在' });
    const { tags } = request.body;
    db.prepare("UPDATE customers SET tags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(tags || []), id);
    return ok(mapCustomer(db.prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  });

  router.put('/:id/importance', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '客户不存在' });
    const { importance } = request.body;
    if (!['vip', 'normal', 'watch'].includes(importance)) return reply.status(400).send({ success: false, error: '重要性值无效' });
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
    if (!name) return reply.status(400).send({ success: false, error: '商品名不能为空' });
    const r = db.prepare('INSERT INTO products (name, tier, category, price, commission_percent, selling_points, related_product_ids, description, is_on_sale) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, tier, category || null, price || 0, commission_percent || 0, selling_points || null, JSON.stringify(related_product_ids), description || null, is_on_sale ? 1 : 0);
    return reply.status(201).send(ok(mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM products WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '商品不存在' });
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
  router.get('/', async () => ok(db.prepare('SELECT id, username, role, display_name, created_at FROM users ORDER BY created_at DESC').all()));
  router.post('/', async (request: any, reply: any) => {
    const { username, password, role = 'assistant', display_name } = request.body;
    if (!username || !password) return reply.status(400).send({ success: false, error: '用户名和密码不能为空' });
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) return reply.status(409).send({ success: false, error: '用户名已存在' });
    const r = db.prepare('INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)').run(username, bcrypt.hashSync(password, 10), role, display_name || null);
    return reply.status(201).send(ok(db.prepare('SELECT id, username, role, display_name, created_at FROM users WHERE id = ?').get(r.lastInsertRowid)));
  });
  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM users WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '用户不存在' });
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
    if (!customer_id || !content) return reply.status(400).send({ success: false, error: '客户和内容不能为空' });
    const r = db.prepare("INSERT INTO follow_ups (customer_id, child_id, method, content, is_live_note) VALUES (?, ?, 'live', ?, 1)").run(customer_id, child_id || null, content);
    updateCustomerStats(customer_id);
    return reply.status(201).send(ok(mapFollowUp(db.prepare('SELECT * FROM follow_ups WHERE id = ?').get(r.lastInsertRowid))));
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
    if (!g) return reply.status(404).send({ success: false, error: '群不存在' });
    const group = mapGroup(g);
    const members = (db.prepare('SELECT * FROM wechat_group_members WHERE group_id = ? ORDER BY activity_score DESC, created_at DESC').all(id) as any[]).map(mapGroupMember);
    group.active_members = members;
    return ok(group);
  });

  router.post('/', async (request: any, reply: any) => {
    const { name, purpose, description, member_count = 0, status = 'active', tags = [], group_rules, owner_note, notes } = request.body;
    if (!name) return reply.status(400).send({ success: false, error: '群名称不能为空' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO wechat_groups (name, purpose, description, member_count, status, tags, group_rules, owner_note, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, purpose || null, description || null, member_count || 0, status, JSON.stringify(tags), group_rules || null, owner_note || null, notes || null, now, now);
    return reply.status(201).send(ok(mapGroup(db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '群不存在' });
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
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '群不存在' });
    db.prepare('DELETE FROM wechat_group_members WHERE group_id = ?').run(id);
    db.prepare('DELETE FROM wechat_groups WHERE id = ?').run(id);
    return ok(null);
  });

  router.post('/:id/members', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.status(404).send({ success: false, error: '群不存在' });
    const { wechat_name, nickname, role = 'active', tags = [], customer_id, activity_score = 50, remark } = request.body;
    if (!wechat_name) return reply.status(400).send({ success: false, error: '微信昵称不能为空' });
    const r = db.prepare(`
      INSERT INTO wechat_group_members (group_id, wechat_name, nickname, role, tags, customer_id, activity_score, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, wechat_name, nickname || null, role, JSON.stringify(tags), customer_id || null, activity_score || 50, remark || null);
    db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
    return reply.status(201).send(ok(mapGroupMember(db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id/members/:memberId', async (request: any, reply: any) => {
    const groupId = parseInt(request.params.id);
    const memberId = parseInt(request.params.memberId);
    if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) return reply.status(404).send({ success: false, error: '群不存在' });
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.status(404).send({ success: false, error: '成员不存在' });
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
    if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) return reply.status(404).send({ success: false, error: '成员不存在' });
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
    if (!ch) return reply.status(404).send({ success: false, error: '孩子不存在' });
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
    if (!customer_id || !nickname || !grade) return reply.status(400).send({ success: false, error: '家长ID、昵称和年级不能为空' });
    if (!db.prepare('SELECT id FROM customers WHERE id = ?').get(customer_id)) return reply.status(404).send({ success: false, error: '客户不存在' });
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO children (customer_id, nickname, gender, birth_date, grade, region, textbook_version, weak_subjects, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer_id, nickname, gender || null, birth_date || null, grade, region || null, textbook_version || null, JSON.stringify(weak_subjects), notes || null, now, now);
    return reply.status(201).send(ok(mapChild(db.prepare('SELECT * FROM children WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '孩子不存在' });
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
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '孩子不存在' });
    db.prepare('DELETE FROM child_learning_progress WHERE child_id = ?').run(id);
    db.prepare('DELETE FROM children WHERE id = ?').run(id);
    return ok(null);
  });

  router.post('/:id/progress', async (request: any, reply: any) => {
    const childId = parseInt(request.params.id);
    const { path_id } = request.body;
    if (!path_id) return reply.status(400).send({ success: false, error: '请选择学习路径' });
    if (!db.prepare('SELECT id FROM children WHERE id = ?').get(childId)) return reply.status(404).send({ success: false, error: '孩子不存在' });
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(path_id)) return reply.status(404).send({ success: false, error: '学习路径不存在' });
    const existing = db.prepare('SELECT id FROM child_learning_progress WHERE child_id = ? AND path_id = ?').get(childId, path_id);
    if (existing) return reply.status(409).send({ success: false, error: '该学习路径已添加' });
    const firstStage = db.prepare('SELECT id FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC LIMIT 1').get(path_id) as any;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const r = db.prepare(`
      INSERT INTO child_learning_progress (child_id, path_id, current_stage_id, status, start_date, updated_at)
      VALUES (?, ?, ?, 'in_progress', date('now'), ?)
    `).run(childId, path_id, firstStage?.id || null, now);
    return reply.status(201).send(ok(mapProgress(db.prepare('SELECT * FROM child_learning_progress WHERE id = ?').get(r.lastInsertRowid))));
  });

  router.put('/:id/progress/:progressId/advance', async (request: any, reply: any) => {
    const childId = parseInt(request.params.id);
    const progressId = parseInt(request.params.progressId);
    const { completed_date, notes, next_stage_id } = request.body;
    const progress = db.prepare('SELECT * FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId) as any;
    if (!progress) return reply.status(404).send({ success: false, error: '进度记录不存在' });
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
    if (!db.prepare('SELECT id FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId)) return reply.status(404).send({ success: false, error: '进度记录不存在' });
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
    if (!name || !subject) return reply.status(400).send({ success: false, error: '名称和学科不能为空' });
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
    return reply.status(201).send(ok(path));
  });

  router.put('/:id', async (request: any, reply: any) => {
    const id = parseInt(request.params.id);
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '学习路径不存在' });
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
    if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(id)) return reply.status(404).send({ success: false, error: '学习路径不存在' });
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

app.setErrorHandler((error: any, _request, reply) => {
  if (error.statusCode === 401 || error.statusCode === 403) return reply.status(error.statusCode).send({ success: false, error: error.message });
  app.log.error(error);
  reply.status(500).send({ success: false, error: '服务器内部错误' });
});

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, '..', 'dist');
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ success: false, error: 'API不存在' });
    }
    return reply.sendFile('index.html', distPath);
  });
} else {
  app.setNotFoundHandler((_request, reply) => { reply.status(404).send({ success: false, error: 'API不存在' }); });
}

export default app;

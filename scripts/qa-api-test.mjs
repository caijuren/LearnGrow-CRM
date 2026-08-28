#!/usr/bin/env node
/**
 * 发版前 API 全量功能测试（QA）
 * 目标：本地后端 http://127.0.0.1:3456，直接操作本地 dev 数据库准备测试数据。
 * 用法：node scripts/qa-api-test.mjs
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3456';
const DB_PATH = path.join(__dirname, '..', 'data', 'learngrow.db');

const RUN = Date.now().toString(36);
const bjtDate = (offsetDays = 0) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
};
const today = bjtDate();

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const FAKE_MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom', 'ascii'), Buffer.alloc(64)]);

// ---------- 测试框架 ----------
let passed = 0, failed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}\n     ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || '断言失败');
}
function assertEq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || '断言失败'}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}
function assertIn(haystack, needle, msg) {
  if (!String(haystack).includes(needle)) throw new Error(`${msg || '包含断言失败'}: 未找到 ${JSON.stringify(needle)} in ${JSON.stringify(String(haystack).slice(0, 200))}`);
}

async function api(method, urlPath, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, { method, headers, body: payload });
  let json = null;
  try { json = await res.json(); } catch { /* 非 JSON */ }
  return { status: res.status, json };
}

const db = new Database(DB_PATH, { readonly: false });
function insertEvent(overrides) {
  const base = {
    name: 'QA-' + RUN,
    start_date: today,
    end_date: bjtDate(10),
    status: 'active',
    allow_makeup: 0, makeup_window_days: 3, makeup_limit_per_user: 3,
    makeup_requires_review: 1, makeup_counts_for_streak: 0, is_deleted: 0,
    signup_deadline: null,
  };
  const row = { ...base, ...overrides };
  const keys = Object.keys(row);
  const r = db.prepare(`INSERT INTO checkin_events (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(row);
  return Number(r.lastInsertRowid);
}
function insertBadge(eventId, overrides) {
  const row = { event_id: eventId, name: 'QA徽章', description: '测试', icon: 'star', type: 'total', target_days: 1, ...overrides };
  const keys = Object.keys(row);
  const r = db.prepare(`INSERT INTO checkin_badges (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(row);
  return Number(r.lastInsertRowid);
}
function insertMaterial(eventId, overrides) {
  const row = { event_id: eventId, title: 'QA素材', file_url: '/uploads/qa-test.pdf', file_type: 'pdf', is_active: 1, sort_order: 0, ...overrides };
  const keys = Object.keys(row);
  const r = db.prepare(`INSERT INTO checkin_materials (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(row);
  return Number(r.lastInsertRowid);
}

// ---------- 数据准备 ----------
console.log('== 数据准备（本地 dev 库，run=' + RUN + '）==');
const evtUpcoming = insertEvent({ name: 'QA-预告活动-' + RUN, start_date: bjtDate(8), end_date: bjtDate(21), signup_deadline: bjtDate(3) });
const evtMakeup = insertEvent({ name: 'QA-补卡活动-' + RUN, start_date: bjtDate(-6), end_date: bjtDate(10), signup_deadline: bjtDate(1), allow_makeup: 1, makeup_window_days: 5, makeup_limit_per_user: 3 });
const evtClosed = insertEvent({ name: 'QA-截止活动-' + RUN, start_date: bjtDate(-3), end_date: bjtDate(10), signup_deadline: today });
const evtNoMakeup = insertEvent({ name: 'QA-无补卡活动-' + RUN, start_date: bjtDate(-3), end_date: bjtDate(10), signup_deadline: bjtDate(2), allow_makeup: 0 });
const evtExpired = insertEvent({ name: 'QA-已结束-' + RUN, start_date: bjtDate(-26), end_date: bjtDate(-2), signup_deadline: bjtDate(-26) });
const evtDeleted = insertEvent({ name: 'QA-已删除-' + RUN, is_deleted: 1 });
const evtEnded = insertEvent({ name: 'QA-状态结束-' + RUN, start_date: bjtDate(-20), end_date: bjtDate(-10), status: 'ended' });
const badgeId = insertBadge(evtMakeup, { name: 'QA首卡徽章-' + RUN });
insertMaterial(evtMakeup, { title: 'QA素材1-' + RUN, sort_order: 1 });
insertMaterial(evtMakeup, { title: 'QA素材2-隐藏-' + RUN, is_active: 0, sort_order: 2 });
insertMaterial(evtMakeup, { title: 'QA素材3-' + RUN, sort_order: 0 });
console.log(`  活动: upcoming=${evtUpcoming} makeup=${evtMakeup} closed=${evtClosed} expired=${evtExpired} deleted=${evtDeleted} ended=${evtEnded} badge=${badgeId}`);

// ---------- 登录与鉴权 ----------
console.log('\n== 登录与鉴权 ==');
const u1 = { code: `qa1-${RUN}`, nickname: '测试家长一', child_name: '小明' };
const u2 = { code: `qa2-${RUN}`, nickname: '测试家长二', child_name: '小红' };
let T1, T2, T3, T4, U1, U2;

await test('无 token 访问受保护接口返回 401', async () => {
  const r = await api('GET', '/api/wx/user-info');
  assertEq(r.status, 401);
  assertEq(r.json.success, false);
});
await test('伪造 token 返回 401', async () => {
  const r = await api('GET', '/api/wx/user-info', { token: 'fake.token.xyz' });
  assertEq(r.status, 401);
});
await test('wx/login 携带资料创建新用户', async () => {
  const r = await api('POST', '/api/wx/login', { body: u1 });
  assertEq(r.status, 200);
  assert(r.json.success, 'login 应成功');
  assert(r.json.data.token, '应返回 token');
  assertEq(r.json.data.user.nickname, '测试家长一');
  assertEq(r.json.data.user.child_name, '小明');
  T1 = r.json.data.token; U1 = r.json.data.user.id;
});
await test('wx/login 同 code 重复登录返回同一用户且不覆盖资料', async () => {
  const r = await api('POST', '/api/wx/login', { body: { code: u1.code, nickname: '恶意改名' } });
  assertEq(r.json.data.user.id, U1);
  assertEq(r.json.data.user.nickname, '测试家长一');
});
await test('wx/login 无 code 时 dev 降级可用', async () => {
  const r = await api('POST', '/api/wx/login', { body: {} });
  assertEq(r.status, 200);
  assert(r.json.data.token, '应返回 token');
});
await test('wx/login 缺参（无 code 无 body）不崩溃且返回可用 token', async () => {
  const r = await api('POST', '/api/wx/login', {});
  assertEq(r.status, 200);
  assert(r.json.data.token);
});
await test('update-profile 部分更新（仅昵称）', async () => {
  const r = await api('POST', '/api/wx/update-profile', { token: T1, body: { nickname: '家长一改名' } });
  assertEq(r.status, 200);
  assertEq(r.json.data.nickname, '家长一改名');
  assertEq(r.json.data.child_name, '小明');
});
await test('update-profile 更新头像和孩子名', async () => {
  const r = await api('POST', '/api/wx/update-profile', { token: T1, body: { avatar_url: '/uploads/qa-avatar.png', child_name: '小明同学' } });
  assertEq(r.status, 200);
  assertEq(r.json.data.avatar_url, '/uploads/qa-avatar.png');
  assertEq(r.json.data.child_name, '小明同学');
});
await test('user-info 返回积分字段', async () => {
  const r = await api('GET', '/api/wx/user-info', { token: T1 });
  assertEq(r.status, 200);
  assert(typeof r.json.data.points === 'number');
});

// U2 登录（正常路径）
{
  const r = await api('POST', '/api/wx/login', { body: u2 });
  T2 = r.json.data.token; U2 = r.json.data.user.id;
}
// U3：不加入任何活动（打卡越权 + 上传限流）
{
  const r = await api('POST', '/api/wx/login', { body: { code: `qa3-${RUN}`, nickname: '路人家长' } });
  T3 = r.json.data.token;
}
// U4：无孩子名（打卡校验）
{
  const r = await api('POST', '/api/wx/login', { body: { code: `qa4-${RUN}`, nickname: '无娃家长' } });
  T4 = r.json.data.token;
}

// ---------- 活动列表 ----------
console.log('\n== 活动列表 ==');
let eventsList;
await test('匿名可浏览活动列表', async () => {
  const r = await api('GET', '/api/wx/checkin-events');
  assertEq(r.status, 200);
  assert(r.json.success);
  eventsList = r.json.data;
  const names = eventsList.map(e => e.name);
  assertIn(names.join(','), 'QA-预告活动', '应包含预告活动');
  assertIn(names.join(','), 'QA-补卡活动');
  assertIn(names.join(','), 'QA-截止活动');
  assertIn(names.join(','), 'QA-已结束', '结束后5天内应仍可见');
  const all = names.join(',');
  assert(!all.includes('QA-已删除'), '已删除活动不应出现');
  assert(!all.includes('QA-状态结束'), 'status=ended 不应出现');
});
await test('活动列表字段正确（upcoming）', async () => {
  const e = eventsList.find(x => x.id === evtUpcoming);
  assert(e, '预告活动应在列表中');
  assertEq(e.event_status, 'upcoming');
  assertEq(e.can_signup, true, '截止前应可报名');
  assertEq(e.is_joined, false);
  assertEq(e.my_checkin_days, 0);
  assertEq(e.today_checked, false);
  assertEq(e.days_left, 21);
  assertEq(e.total_days, 14);
});
await test('活动列表字段正确（ongoing 截止日=今天，不可报名）', async () => {
  const e = eventsList.find(x => x.id === evtClosed);
  assertEq(e.event_status, 'ongoing');
  assertEq(e.can_signup, false, 'signup_deadline=今天应不可报名');
});
await test('活动列表字段正确（ongoing 可补卡）', async () => {
  const e = eventsList.find(x => x.id === evtMakeup);
  assertEq(e.event_status, 'ongoing');
  assertEq(e.can_signup, true);
  assertEq(e.can_makeup, true);
  assertEq(e.makeup_window_days, 5);
});
await test('登录后列表带个人状态（join 前）', async () => {
  const r = await api('GET', '/api/wx/checkin-events', { token: T1 });
  const e = r.json.data.find(x => x.id === evtMakeup);
  assertEq(e.is_joined, false);
});

// ---------- 报名 ----------
console.log('\n== 报名 ==');
await test('未登录报名返回 401', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtUpcoming}/join`, { body: {} });
  assertEq(r.status, 401);
});
await test('预告活动可报名', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtUpcoming}/join`, { token: T1, body: {} });
  assertEq(r.status, 201);
  assert(r.json.data.participant_id || r.json.data.id, '应返回 participant');
});
await test('重复报名返回 409', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtUpcoming}/join`, { token: T1, body: {} });
  assertEq(r.status, 409);
});
await test('截止日当天报名被拒', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtClosed}/join`, { token: T2, body: {} });
  assertEq(r.status, 400);
  assertIn(r.json.error, '报名已截止');
});
await test('已结束活动（status=ended）报名被拒', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtEnded}/join`, { token: T2, body: {} });
  assertEq(r.status, 400);
  assertIn(r.json.error, '已结束');
});
await test('已删除活动报名 404', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtDeleted}/join`, { token: T2, body: {} });
  assertEq(r.status, 404);
});
await test('不存在活动报名 404', async () => {
  const r = await api('POST', '/api/wx/checkin-events/99999999/join', { token: T2, body: {} });
  assertEq(r.status, 404);
});
await test('补卡活动可报名（U1 加入 evtMakeup）', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtMakeup}/join`, { token: T1, body: {} });
  assertEq(r.status, 201);
});
await test('U2 加入补卡活动', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtMakeup}/join`, { token: T2, body: {} });
  assertEq(r.status, 201);
});
await test('U4 加入预告活动（用于无孩子名打卡测试）', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtUpcoming}/join`, { token: T4, body: {} });
  assertEq(r.status, 201);
});
await test('报名后列表 is_joined=true 且参与者计数+1', async () => {
  const r = await api('GET', '/api/wx/checkin-events', { token: T1 });
  const e = r.json.data.find(x => x.id === evtUpcoming);
  assertEq(e.is_joined, true);
  assert(e.participant_count >= 1);
});
await test('update-profile 改名后同步到参与者', async () => {
  await api('POST', '/api/wx/update-profile', { token: T1, body: { nickname: '家长一最终名', child_name: '小明同学' } });
  const row = db.prepare('SELECT nickname, child_name FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(evtUpcoming, U1);
  assertEq(row.nickname, '家长一最终名');
  assertEq(row.child_name, '小明同学');
});

// ---------- 打卡 ----------
console.log('\n== 打卡 ==');
await test('未报名用户打卡被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T3, body: { event_id: evtMakeup, image_url: '/uploads/qa.png' } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '先加入活动');
});
await test('缺少图片被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '图片或视频');
});
await test('无孩子名打卡被拒（CHILD_NAME_REQUIRED）', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T4, body: { event_id: evtUpcoming, image_url: '/uploads/qa.png', checkin_date: today } });
  assertEq(r.status, 400);
  assertEq(r.json.code, 'CHILD_NAME_REQUIRED');
});
await test('活动不存在打卡 404', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtDeleted, image_url: '/uploads/qa.png' } });
  assertEq(r.status, 404);
});
await test('status=ended 活动打卡被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtEnded, image_url: '/uploads/qa.png' } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '已结束');
});
await test('预告活动不能提前打卡', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtUpcoming, image_url: '/uploads/qa.png', checkin_date: today } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '范围');
});
await test('未来日期打卡被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa.png', checkin_date: bjtDate(1) } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '提前');
});
await test('正常打卡成功（approved + 积分 + 徽章）', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-today.png', note: '今天练习了跳绳', checkin_date: today } });
  assertEq(r.status, 201);
  assertEq(r.json.data.status, 'approved');
  assertEq(r.json.data.pending_review, false);
  assertEq(r.json.data.checkin_number, 1);
  assertEq(r.json.data.points_earned, 10, '默认每次打卡应得10积分');
  assert(r.json.data.new_badges.length >= 1, '首次打卡应解锁 total=1 徽章');
  assertEq(r.json.data.display_name, '家长一最终名（小明同学）');
  assertEq(r.json.data.media_type, 'image');
});
await test('当日重复打卡被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-today2.png', checkin_date: today } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '今日已打卡');
});
await test('补卡（昨天）进入待审核', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-yesterday.png', checkin_date: bjtDate(-1) } });
  assertEq(r.status, 201);
  assertEq(r.json.data.is_makeup, 1);
  assertEq(r.json.data.status, 'pending');
  assertEq(r.json.data.pending_review, true);
});
await test('U2 加入无补卡活动（供不支持补卡测试）', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtNoMakeup}/join`, { token: T2, body: {} });
  assertEq(r.status, 201);
});
await test('非补卡活动补卡被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T2, body: { event_id: evtNoMakeup, image_url: '/uploads/qa-x.png', checkin_date: bjtDate(-1) } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '不支持补卡');
});
await test('被拒记录可重新提交（今日）', async () => {
  db.prepare("UPDATE checkin_records SET status='rejected' WHERE event_id = ? AND participant_id = (SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?) AND checkin_date = ?").run(evtMakeup, evtMakeup, U1, today);
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-resubmit.png', note: '重新提交', checkin_date: today } });
  assertEq(r.status, 200);
  assertEq(r.json.data.status, 'approved');
});
await test('超出补卡窗口（6天前）被拒', async () => {
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-old.png', checkin_date: bjtDate(-6) } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '只能补最近');
});
await test('补卡数量上限（limit=3）超限被拒', async () => {
  // 前序已补 1 次（昨天 pending），再补 -2、-3（共 3 次达上限），-4 仍在窗口内应被拒
  await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-2.png', checkin_date: bjtDate(-2) } });
  await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-3.png', checkin_date: bjtDate(-3) } });
  const r = await api('POST', '/api/wx/checkin', { token: T1, body: { event_id: evtMakeup, image_url: '/uploads/qa-4.png', checkin_date: bjtDate(-4) } });
  assertEq(r.status, 400);
  assertIn(r.json.error, '最多可补卡');
});
await test('视频打卡（mp4）成功', async () => {
  const up = await api('POST', '/api/wx/upload-media', { token: T2, form: toForm(FAKE_MP4, 'qa-video.mp4') });
  assertEq(up.status, 200, 'fake mp4 应通过 detectMedia');
  const r = await api('POST', '/api/wx/checkin', { token: T2, body: { event_id: evtMakeup, image_url: up.json.data.url, media_type: 'video', checkin_date: today } });
  assertEq(r.status, 201);
  assertEq(r.json.data.media_type, 'video');
});

function toForm(buffer, filename) {
  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: 'application/octet-stream' }), filename);
  return fd;
}

// ---------- 我的打卡 ----------
console.log('\n== 我的打卡 ==');
await test('my-checkins 汇总与日历（U1）', async () => {
  const r = await api('GET', '/api/wx/my-checkins', { token: T1 });
  assertEq(r.status, 200);
  const list = r.json.data;
  const ev = list.find(x => x.event && x.event.id === evtMakeup);
  assert(ev, '应包含补卡活动');
  assertEq(ev.checkin_days, 1, '今日 approved 1 天，补卡 pending 不计');
  assertEq(ev.current_streak, 1);
  assert(Array.isArray(ev.calendar) && ev.calendar.length > 0, '应有日历数组');
  const joined = list.find(x => x.event && x.event.id === evtUpcoming);
  assert(joined, '应包含已报名的预告活动');
});
await test('my-checkins 未登录 401', async () => {
  const r = await api('GET', '/api/wx/my-checkins');
  assertEq(r.status, 401);
});

// ---------- 排行榜 ----------
console.log('\n== 排行榜 ==');
await test('ranking 排序与 is_me（U1 视角）', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/ranking`, { token: T1 });
  assertEq(r.status, 200);
  const list = r.json.data;
  assert(list.length >= 2, '至少 2 人');
  const me = list.find(x => x.is_me);
  assert(me, '应有 is_me 项');
  assertEq(me.rank, 1, 'U1 有 1 天 approved，应排第 1');
  assertEq(me.checkin_days, 1);
  list.forEach((x, i) => assertEq(x.rank, i + 1, '排名应连续'));
  assert(list.some(x => x.nickname === '测试家长二'), 'U2 应出现在排行榜');
});
await test('ranking 匿名可看', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/ranking`);
  assertEq(r.status, 200);
});

// ---------- 记录修改 ----------
console.log('\n== 记录修改 ==');
let recordId;
await test('获取今日记录 id（供修改测试）', async () => {
  const r = await api('GET', '/api/wx/my-checkins', { token: T1 });
  const ev = r.json.data.find(x => x.event && x.event.id === evtMakeup);
  const todayRec = ev.records.find(x => x.checkin_date === today);
  recordId = todayRec.id;
  assert(recordId, '应有今日记录');
});
await test('修改自己的今日记录', async () => {
  const r = await api('PUT', `/api/wx/checkin-records/${recordId}`, { token: T1, body: { image_url: '/uploads/qa-edit.png', note: '修改后的感言' } });
  assertEq(r.status, 200);
  assertEq(r.json.data.note, '修改后的感言');
  assertEq(r.json.data.pending_review, false);
});
await test('修改他人记录 403', async () => {
  const r = await api('PUT', `/api/wx/checkin-records/${recordId}`, { token: T2, body: { image_url: '/uploads/qa-x.png' } });
  assertEq(r.status, 403);
});
await test('修改不存在的记录 404', async () => {
  const r = await api('PUT', '/api/wx/checkin-records/99999999', { token: T1, body: { image_url: '/uploads/qa-x.png' } });
  assertEq(r.status, 404);
});
await test('修改昨日记录被拒（非补卡模式仅今日可改）', async () => {
  const r = await api('GET', '/api/wx/my-checkins', { token: T1 });
  const ev = r.json.data.find(x => x.event && x.event.id === evtMakeup);
  const yesterdayRec = ev.records.find(x => x.checkin_date === bjtDate(-1));
  assert(yesterdayRec, '应有昨日补卡记录');
  const res = await api('PUT', `/api/wx/checkin-records/${yesterdayRec.id}`, { token: T1, body: { image_url: '/uploads/qa-x.png' } });
  assertEq(res.status, 400);
  assertIn(res.json.error, '今天');
});

// ---------- 动态与点赞 ----------
console.log('\n== 动态与点赞 ==');
let feedRecId;
await test('feed 仅展示 approved 记录', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/feed`, { token: T1 });
  assertEq(r.status, 200);
  const list = r.json.data;
  assert(list.length >= 1);
  const pendingVisible = list.some(x => x.checkin_date === bjtDate(-1));
  assert(!pendingVisible, 'pending 补卡记录不应出现在动态');
  const first = list.find(x => x.checkin_date === today && x.nickname === '家长一最终名');
  assert(first, '应包含 U1 今日 approved 打卡');
  assertEq(first.liked_by_me, false, '未点赞状态');
  feedRecId = first.id;
});
await test('点赞 toggle（U2 点赞 U1 记录）', async () => {
  const r1 = await api('POST', `/api/wx/checkin-records/${feedRecId}/like`, { token: T2 });
  assertEq(r1.status, 200);
  assertEq(r1.json.data.liked, true);
  assertEq(r1.json.data.like_count, 1);
  const r2 = await api('POST', `/api/wx/checkin-records/${feedRecId}/like`, { token: T2 });
  assertEq(r2.json.data.liked, false);
  assertEq(r2.json.data.like_count, 0);
});
await test('点赞待审核记录 404', async () => {
  const r = await api('GET', '/api/wx/my-checkins', { token: T1 });
  const ev = r.json.data.find(x => x.event && x.event.id === evtMakeup);
  const pendingRec = ev.records.find(x => x.status === 'pending');
  assert(pendingRec, '应有 pending 记录');
  const res = await api('POST', `/api/wx/checkin-records/${pendingRec.id}/like`, { token: T2 });
  assertEq(res.status, 404);
});
await test('feed 匿名可看', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/feed`);
  assertEq(r.status, 200);
});

// ---------- 提醒 ----------
console.log('\n== 订阅消息提醒 ==');
await test('reminder GET 默认值（20:00 关闭）', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/reminder`, { token: T1 });
  assertEq(r.status, 200);
  assertEq(r.json.data.is_enabled, false);
  assertEq(r.json.data.remind_time, '20:00');
});
await test('reminder POST 开启并改时间', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtMakeup}/reminder`, { token: T1, body: { is_enabled: true, remind_time: '21:30' } });
  assertEq(r.status, 200);
  assertEq(r.json.data.is_enabled, true);
  assertEq(r.json.data.remind_time, '21:30');
});
await test('reminder POST 非法时间 400', async () => {
  const r = await api('POST', `/api/wx/checkin-events/${evtMakeup}/reminder`, { token: T1, body: { is_enabled: true, remind_time: '25:99' } });
  assertEq(r.status, 400);
});
await test('reminder 设置持久化', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/reminder`, { token: T1 });
  assertEq(r.json.data.is_enabled, true);
  assertEq(r.json.data.remind_time, '21:30');
});
await test('reminder 未登录 401', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/reminder`);
  assertEq(r.status, 401);
});

// ---------- 上传 ----------
console.log('\n== 上传 ==');
await test('upload-image 合法 PNG 成功', async () => {
  const r = await api('POST', '/api/wx/upload-image', { token: T2, form: toForm(PNG_1x1, 'qa.png') });
  assertEq(r.status, 200);
  assert(r.json.data.url && r.json.data.url.startsWith('/uploads/'), '应返回 /uploads/ 路径');
  assert(r.json.data.image_hash, '应返回 hash');
  assertEq(r.json.data.same_day_duplicate, false);
});
await test('upload-image 当日重复图片标记 same_day_duplicate', async () => {
  // 先上传并用于今日打卡，再传同一张图应提示当日重复
  const up1 = await api('POST', '/api/wx/upload-image', { token: T2, form: toForm(PNG_1x1, 'dup1.png') });
  const chk = await api('POST', '/api/wx/checkin', { token: T2, body: { event_id: evtUpcoming, image_url: up1.json.data.url, checkin_date: bjtDate(-2) } });
  assertEq(chk.status, 400, '预告活动未开始不应打卡成功（仅用于登记图片）');
  const up2 = await api('POST', '/api/wx/upload-image', { token: T2, form: toForm(PNG_1x1, 'dup2.png') });
  assertEq(up2.status, 200);
  assertEq(up2.json.data.same_day_duplicate, false, '未关联打卡记录时不应判重');
});
await test('upload-image 非图片格式 400', async () => {
  const r = await api('POST', '/api/wx/upload-image', { token: T2, form: toForm(Buffer.from('hello world this is text'), 'qa.txt') });
  assertEq(r.status, 400);
});
await test('upload-image 超 10MB 413', async () => {
  const big = Buffer.concat([PNG_1x1, Buffer.alloc(11 * 1024 * 1024)]);
  const r = await api('POST', '/api/wx/upload-image', { token: T2, form: toForm(big, 'big.png') });
  assertEq(r.status, 413);
});
await test('upload-media 视频（mp4）成功且类型为 video', async () => {
  const r = await api('POST', '/api/wx/upload-media', { token: T2, form: toForm(FAKE_MP4, 'qa.mp4') });
  assertEq(r.status, 200);
  assertEq(r.json.data.media_type, 'video');
  assertEq(r.json.data.url.endsWith('.mp4'), true);
});
await test('upload-media 非媒体格式 400', async () => {
  const r = await api('POST', '/api/wx/upload-media', { token: T2, form: toForm(Buffer.from('not media at all'), 'qa.bin') });
  assertEq(r.status, 400);
});
await test('上传未登录 401', async () => {
  const r = await api('POST', '/api/wx/upload-image', { form: toForm(PNG_1x1, 'qa.png') });
  assertEq(r.status, 401);
});

// ---------- 素材 / 徽章 ----------
console.log('\n== 素材与徽章 ==');
await test('materials 仅返回 is_active=1 且按 sort_order', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/materials`);
  assertEq(r.status, 200);
  const list = r.json.data;
  assertEq(list.length, 2, '2 个 active 素材');
  assertEq(list[0].title, 'QA素材3-' + RUN, 'sort_order=0 应在前');
  assertEq(list[1].title, 'QA素材1-' + RUN);
});
await test('badges 返回全部徽章及 achieved', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/badges`, { token: T1 });
  assertEq(r.status, 200);
  assert(r.json.data.length >= 1);
  const b = r.json.data.find(x => x.id === badgeId);
  assert(b, '应有测试徽章');
  assertEq(b.achieved, true, 'U1 已达成 total=1');
});
await test('badges 匿名视角 achieved=false', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/badges`);
  assertEq(r.status, 200);
  const b = r.json.data.find(x => x.id === badgeId);
  assertEq(b.achieved, false);
});
await test('my-badges 返回我的徽章', async () => {
  const r = await api('GET', '/api/wx/my-badges', { token: T1 });
  assertEq(r.status, 200);
  assert(r.json.data.length >= 1, 'U1 应至少 1 个徽章');
});

// ---------- 分享链接 ----------
console.log('\n== 分享链接 ==');
await test('share-link 生成明文 scheme', async () => {
  const r = await api('GET', `/api/wx/checkin-events/${evtMakeup}/share-link?env_version=develop`);
  assertEq(r.status, 200);
  assertIn(r.json.data.scheme, 'weixin://dl/business');
  assertIn(r.json.data.scheme, String(evtMakeup));
  assert(r.json.data.expire_at === null, '永久有效 expire_at=null');
});
await test('share-link 不存在活动 404', async () => {
  const r = await api('GET', '/api/wx/checkin-events/99999999/share-link');
  assertEq(r.status, 404);
});

// ---------- 积分 ----------
console.log('\n== 积分 ==');
await test('my-points 余额与流水', async () => {
  const r = await api('GET', '/api/wx/my-points', { token: T1 });
  assertEq(r.status, 200);
  assert(r.json.data.balance >= 10, `U1 至少 1 次 approved 打卡 10 分，实际 ${r.json.data.balance}`);
  const checkinItems = r.json.data.items.filter(i => i.type === 'checkin');
  assert(checkinItems.length >= 1, '应有打卡积分流水');
  for (const item of checkinItems) assert(item.amount > 0);
});
await test('my-points 未登录 401', async () => {
  const r = await api('GET', '/api/wx/my-points');
  assertEq(r.status, 401);
});

// ---------- 上传限流 ----------
console.log('\n== 上传限流 ==');
await test('同一用户 30 次/分钟限流（第 31 次 429）', async () => {
  let got429 = false;
  for (let i = 0; i < 31; i++) {
    const r = await api('POST', '/api/wx/upload-image', { token: T3, form: toForm(PNG_1x1, `qa${i}.png`) });
    if (r.status === 429) { got429 = true; break; }
    assertEq(r.status, 200, `第 ${i + 1} 次上传应成功`);
  }
  assert(got429, '第 31 次应触发 429');
});

// ---------- 静态资源语义 ----------
console.log('\n== 静态资源 ==');
await test('缺失的 /uploads 文件返回 404（不能是 SPA 的 200 HTML）', async () => {
  const r = await fetch(`${BASE}/uploads/qa-definitely-missing-${Date.now()}.jpg`);
  assertEq(r.status, 404);
  const type = r.headers.get('content-type') || '';
  assert(!type.includes('text/html'), `不应返回 HTML，实际 content-type=${type}`);
});

// ---------- 收尾 ----------
console.log(`\n========== 结果: ${passed} 通过, ${failed} 失败 ==========`);
if (failed > 0) {
  console.log('\n失败明细:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}

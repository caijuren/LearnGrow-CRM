#!/usr/bin/env node
/**
 * 发版前小程序 UI 全功能自动化测试（微信开发者工具 + miniprogram-automator 0.12.1）
 * 覆盖：8 个页面、登录/报名/补卡/今日打卡/修改/动态点赞/提醒/分享/排行榜/编辑资料/积分/退出/隐私/被拒态/空态，逐页截图。
 * 前置：开发者工具「设置 → 安全设置 → 服务端口」已开启；本地后端 3456 已启动。
 * 用法：node scripts/qa-ui-test.mjs
 */
import automator from 'miniprogram-automator';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const ROOT = path.join(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'qa-screenshots');
const DB_PATH = path.join(ROOT, 'data', 'learngrow.db');
const CLI = '/Applications/wechatwebdevtools.app/Contents/MacOS/cli';
const PROJECT = path.join(ROOT, 'miniprogram');
const BASE = 'http://127.0.0.1:3456';
const RUN = Date.now().toString(36);

fs.mkdirSync(SHOTS, { recursive: true });

const bjtDate = (offset = 0) => new Date(Date.now() + 8 * 3600 * 1000 + offset * 86400000).toISOString().slice(0, 10);
const today = bjtDate();

// ---------- 工具 ----------
let passed = 0, failed = 0;
const failures = [];
async function test(name, fn) {
  console.log(`  ▶ ${name} ...`);
  try {
    await Promise.race([
      fn(),
      sleep(90000).then(() => { throw new Error('用例超时（90s），可能某处 wx 调用无响应'); })
    ]);
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    failures.push({ name, error: e.message });
    console.log(`  ❌ ${name}\n     ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || '断言失败'); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`${msg || '断言失败'}: 期望 ${JSON.stringify(b)}，实际 ${JSON.stringify(a)}`); }
function assertIn(text, needle, msg) {
  if (!String(text).includes(needle)) throw new Error(`${msg || '包含失败'}: 未找到 ${JSON.stringify(needle)} in ${JSON.stringify(String(text).slice(0, 300))}`);
}
async function api(method, urlPath, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + urlPath, { method, headers, body: payload });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

let miniProgram;
async function page() { return miniProgram.currentPage(); }
async function nav(url) {
  await miniProgram.reLaunch(url);
  await sleep(1400);
  return page();
}
async function shot(name) {
  try {
    await miniProgram.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    console.log(`  📷 ${name}.png`);
  } catch (e) { console.log(`  ⚠️ 截图失败 ${name}: ${e.message}`); }
}
async function el(selector, label) {
  const p = await page();
  const e = await p.$(selector);
  if (!e) throw new Error(`找不到元素 ${selector}${label ? '（' + label + '）' : ''}`);
  return e;
}
async function elText(selector, label) {
  const e = await el(selector, label);
  return (await e.text()).trim();
}
async function tap(selector, label) {
  const e = await el(selector, label);
  await e.tap();
  await sleep(700);
}
async function setPageData(obj) {
  const p = await page();
  await p.setData(obj);
}
async function callPageMethod(name, ...args) {
  const p = await page();
  return p.callMethod(name, ...args);
}
async function pageData() {
  const p = await page();
  return p.data();
}
async function bodyText() {
  const p = await page();
  const c = await p.$('.container');
  return c ? (await c.text()) : '';
}
async function scrollToBottom() {
  await miniProgram.pageScrollTo(99999);
  await sleep(700);
}
async function scrollToTop() {
  await miniProgram.pageScrollTo(0);
  await sleep(700);
}
async function mock(method, impl) { await miniProgram.mockWxMethod(method, impl); }
async function restore(method) { await miniProgram.restoreWxMethod(method); }

// 收集小程序 console 报错
const consoleErrors = [];
function hookConsole() {
  try {
    miniProgram.on('console', msg => {
      if (msg && msg.type === 'error') consoleErrors.push(msg.text || msg.message || JSON.stringify(msg));
    });
  } catch (e) { /* 老版本无此 API */ }
}

// 当前测试用户的 wx_user_id（登录后由 DB 反查，openid 由 mock wx.login 的 code 决定）
function meId() {
  const u = db.prepare("SELECT id FROM wx_users WHERE openid = ?").get(`dev_ui-${RUN}`);
  return u ? u.id : null;
}

// ---------- 数据准备 ----------
console.log('== 数据准备 ==');
const db = new Database(DB_PATH);
// 清理历史 UI 测试活动（避免堆积）
db.prepare("UPDATE checkin_events SET is_deleted = 1 WHERE name LIKE '自动化UI活动-%'").run();
// 独立 UI 测试活动：进行中、可报名、可补卡（window=3/limit=3/review=1）、含徽章和素材
const evtRow = {
  name: `自动化UI活动-${RUN}`, start_date: bjtDate(-2), end_date: bjtDate(8),
  signup_deadline: bjtDate(2), status: 'active', allow_makeup: 1,
  makeup_window_days: 3, makeup_limit_per_user: 3, makeup_requires_review: 1,
  makeup_counts_for_streak: 0, is_deleted: 0,
  required_text: '每天练习至少 15 分钟，拍照或视频打卡',
  reward_rules: '全勤 21 天获得奖状一张；连续 7 天奖励 50 积分',
};
const keys = Object.keys(evtRow);
const evtId = Number(db.prepare(`INSERT INTO checkin_events (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(evtRow).lastInsertRowid);
const badgeId = Number(db.prepare(`INSERT INTO checkin_badges (event_id, name, description, icon, type, target_days) VALUES (?, ?, ?, ?, 'total', 3)`).run(evtId, '全勤之星', '累计打卡 3 天', '星').lastInsertRowid);
db.prepare(`INSERT INTO checkin_materials (event_id, title, description, file_url, file_type, sort_order) VALUES (?, ?, ?, ?, ?, 0)`).run(evtId, '练习示范视频', '跟着视频一起练', '/uploads/qa-demo.mp4', 'video');
db.prepare(`INSERT INTO checkin_materials (event_id, title, description, file_url, file_type, sort_order) VALUES (?, ?, ?, ?, ?, 1)`).run(evtId, '打卡规则说明', '先看规则再打卡', '/uploads/qa-rules.pdf', 'pdf');

// 第二家长：预置 2 天 approved 打卡（用于排行榜/动态对比）
const p2 = await api('POST', '/api/wx/login', { body: { code: `uip2-${RUN}`, nickname: '另一位家长', child_name: '小红' } });
const P2_TOKEN = p2.json.data.token;
await api('POST', `/api/wx/checkin-events/${evtId}/join`, { token: P2_TOKEN, body: {} });
const p2part = db.prepare('SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(evtId, p2.json.data.user.id);
db.prepare(`INSERT INTO checkin_records (event_id, participant_id, checkin_date, image_url, media_type, status, display_name, is_makeup)
  VALUES (?, ?, ?, '/uploads/qa-p2-1.png', 'image', 'approved', '另一位家长（小红）', 0)`).run(evtId, p2part.id, bjtDate(-2));
db.prepare(`INSERT INTO checkin_records (event_id, participant_id, checkin_date, image_url, media_type, status, display_name, is_makeup)
  VALUES (?, ?, ?, '/uploads/qa-p2-2.png', 'image', 'approved', '另一位家长（小红）', 0)`).run(evtId, p2part.id, bjtDate(-1));

// 预上传打卡图 + 头像（给 UI 流程返回真实 URL）
// 必须是「不透明纯色」像素：透明底 PNG 让截图里的正常头像和加载失败的空白头像长得一模一样，无从判断
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGN44JsNAAOpAZlMCWvxAAAAAElFTkSuQmCC', 'base64');
async function uploadImg(token, filename) {
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), filename);
  const r = await api('POST', '/api/wx/upload-image', { token, form: fd });
  return r.json.data.url;
}
const CHECKIN_PATH = await uploadImg(P2_TOKEN, `ui-checkin-${RUN}.png`);
const AVATAR_PATH = await uploadImg(P2_TOKEN, `ui-avatar-${RUN}.png`);
console.log(`  活动 id=${evtId}，打卡图 ${CHECKIN_PATH}，头像 ${AVATAR_PATH}`);

// ---------- 启动 ----------
console.log('\n== 启动开发者工具 ==');
miniProgram = await automator.launch({ cliPath: CLI, projectPath: PROJECT, timeout: 120000 });
hookConsole();
// 清掉上次运行的登录态，保证从游客开始
try { await miniProgram.callWxMethod('clearStorageSync'); } catch {}
await miniProgram.evaluate(() => { const app = getApp(); if (app) { app.globalData.token = null; app.globalData.userInfo = null; } });
// mock wx.login：开发者工具返回稳定 code 会命中旧用户；传结果对象，success 回调会直接收到它。
await mock('login', { code: `ui-${RUN}` });
await sleep(2000);

// ---------- 1. 首页（未登录） ----------
console.log('\n== 1. 首页（未登录）==');
await test('首页加载：游客问候 + 登录横幅 + 活动卡片', async () => {
  await nav('/pages/index/index');
  assertIn(await elText('.greeting', '问候语'), '游客家长');
  assert(await (await page()).$('.login-banner'), '未登录应显示登录横幅');
  const cards = await (await page()).$$('.event-card');
  assert(cards.length >= 1, '应至少 1 个活动卡片');
});
await shot('01-首页-未登录');

await test('未登录横幅点击跳转登录页', async () => {
  await tap('.login-banner', '登录横幅');
  await sleep(800);
  const p = await page();
  assertIn(p.path, 'login', `应在登录页，实际 ${p.path}`);
});

// ---------- 2. 登录页 ----------
console.log('\n== 2. 登录页 ==');
await test('登录页：未勾选协议时按钮禁用态', async () => {
  await nav('/pages/login/login');
  const btn = await el('.btn-wechat', '一键登录');
  const cls = await btn.attribute('class');
  assertIn(cls, 'btn-disabled', '未勾选协议应禁用');
});
await shot('02-登录页');

await test('未勾选协议点登录 → 提示后仍停留（toast 原生，截图验证）', async () => {
  await tap('.btn-wechat', '一键登录');
  await shot('03-登录-未勾选协议提示');
  const p = await page();
  assertIn(p.path, 'login');
});

await test('勾选协议 → 一键登录 → 新用户弹出昵称设置', async () => {
  await tap('.agreement', '协议勾选');
  await tap('.btn-wechat', '一键登录');
  await sleep(2500);
  const overlay = await (await page()).$('.nickname-overlay');
  assert(overlay, '新用户应弹出昵称设置');
});
await shot('04-登录-昵称弹窗');

await test('昵称弹窗：未选头像直接保存 → 提示且停留', async () => {
  await tap('.btn-save', '保存按钮');
  await shot('05-登录-未选头像提示');
  const overlay = await (await page()).$('.nickname-overlay');
  assert(overlay, '昵称弹窗仍应显示');
});

await test('选头像（mock 上传）→ 头像预览出现', async () => {
  // 模拟 chooseAvatar 事件：wx.uploadFile 由 mock 接管，success 直接收到该响应对象
  await mock('uploadFile', { statusCode: 200, data: JSON.stringify({ success: true, data: { url: AVATAR_PATH } }) });
  await miniProgram.evaluate(() => getCurrentPages().pop().onChooseAvatar({ detail: { avatarUrl: '/tmp/qa-avatar.png' } }));
  await sleep(1500);
  await restore('uploadFile');
  const img = await (await page()).$('.avatar-picker-img');
  assert(img, '头像预览应出现');
  const d = await pageData();
  assertEq(d.setupAvatarUrl, AVATAR_PATH, 'setupAvatarUrl');
  // 回归保护：临时路径为空时，预览必须回落到「带域名」的服务器地址（曾因相对路径渲染空白）
  await miniProgram.evaluate(() => getCurrentPages().pop().setData({ setupAvatarFile: '' }));
  await sleep(800);
  const src = await (await (await page()).$('.avatar-picker-img')).attribute('src');
  assert(/^https?:\/\//.test(src || ''), `头像预览 src 应为绝对地址，实际=${src}`);
});
await shot('06-登录-已选头像');

await test('填写昵称 → 保存 → 弹出孩子名设置', async () => {
  const input = await el('.nickname-input', '昵称输入框');
  await input.input('自动化测试家长');
  await sleep(400);
  await tap('.btn-save', '保存');
  await sleep(1500);
  const overlay = await (await page()).$('.nickname-overlay');
  assert(overlay, '应弹出孩子名称设置');
  assertIn(await elText('.nickname-title', '弹窗标题'), '孩子怎么称呼');
});
await shot('07-登录-孩子名弹窗');

await test('填写孩子名 → 保存 → 回到首页已登录态', async () => {
  const input = await el('.nickname-input', '孩子名输入框');
  await input.input('糖糖');
  await sleep(400);
  await tap('.btn-save', '保存并开始');
  await sleep(2500);
  const p = await page();
  assertIn(p.path, 'index', `应回到首页，实际 ${p.path}`);
  assertIn(await elText('.greeting', '问候语'), '自动化测试家长');
  assert(await (await page()).$('.today-panel'), '登录后应显示今日任务面板');
  assertIn(await elText('.today-title', '今日任务标题'), '还没有报名活动');
});
await shot('08-首页-已登录');

// ---------- 3. 报名 ----------
console.log('\n== 3. 报名 ==');
await test('首页进行中卡片：未报名用户显示「立即报名」按钮（修复验证）', async () => {
  const cards = await (await page()).$$('.event-card');
  let found = false;
  for (const card of cards) {
    const t = (await card.text()) || '';
    if (t.includes('自动化UI活动')) {
      found = true;
      assertIn(t, '立即报名', '未报名且可报名时应显示「立即报名」按钮');
      assert(!t.includes('报名已截止'), '可报名时不应显示「报名已截止」');
      break;
    }
  }
  assert(found, '应找到 UI 活动卡片');
});

await test('进入活动详情 → 点「立即报名」→ 出现我的打卡记录与日历', async () => {
  const cards = await (await page()).$$('.event-card');
  for (const card of cards) {
    const t = (await card.text()) || '';
    if (t.includes('自动化UI活动')) { await card.tap(); break; }
  }
  await sleep(1500);
  const p = await page();
  assertIn(p.path, 'event-detail', `应在详情页，实际 ${p.path}`);
  // 详情页显示报名卡（can_signup=true）
  const joinBtn = await (await page()).$('.join-prompt-card .btn-primary');
  assert(joinBtn, '详情页应显示「立即报名」按钮');
  await joinBtn.tap();
  await sleep(2000);
  const body = await bodyText();
  assertIn(body, '我的打卡记录', '报名后应出现我的打卡记录');
  assertIn(body, '0/11天');
  assert(await (await page()).$('.calendar-grid'), '应有日历');
  assertIn(body, '可补卡', '应有可补卡图例');
});
await shot('09-详情-报名后');

await test('回首页：卡片显示待打卡与进度', async () => {
  await nav('/pages/index/index');
  const cards = await (await page()).$$('.event-card');
  let found = false;
  for (const card of cards) {
    const t = (await card.text()) || '';
    if (t.includes('自动化UI活动')) {
      found = true;
      assertIn(t, '待打卡', '已报名未打卡应显示「待打卡」');
      assertIn(t, '0/11天', '应显示 0/11 天进度');
      break;
    }
  }
  assert(found, '应找到 UI 活动卡片');
});

// ---------- 4. 活动详情 ----------
console.log('\n== 4. 活动详情 ==');
await test('详情页：标题 + 分享卡 + 打卡要求 / 奖励规则 / 徽章 / 学习资料完整', async () => {
  await nav(`/pages/event-detail/event-detail?id=${evtId}`);
  const p = await page();
  assertIn(p.path, 'event-detail', `应在详情页，实际 ${p.path}`);
  assertIn(await elText('.hero-title', '活动标题'), '自动化UI活动');
  assert(await (await page()).$('.share-card'), '应有分享卡片');
  const body = await bodyText();
  assertIn(body, '打卡要求');
  assertIn(body, '每天练习至少 15 分钟', '应显示打卡要求内容');
  assertIn(body, '奖励规则');
  assertIn(body, '打卡徽章');
  assertIn(body, '已获得 0/1', '徽章进度');
  assertIn(body, '学习资料');
  assertIn(body, '练习示范视频');
  assertIn(body, '打卡规则说明');
});
await shot('10-详情-信息卡片');

await test('详情页：日历展示完整（含今日标记）', async () => {
  await scrollToBottom();
  const body = await bodyText();
  assertIn(body, '0/11天');
  assert(await (await page()).$('.calendar-grid'), '应有日历');
  assert(await (await page()).$('.calendar-day.today'), '应有今日标记');
});
await shot('11-详情-日历');

await test('每日打卡提醒：开启开关 → 描述变化', async () => {
  await scrollToTop();
  const sw = await el('.reminder-card switch', '提醒开关');
  const before = await elText('.reminder-desc', '提醒描述');
  assertIn(before, '开启后', '默认应显示未开启文案');
  await sw.tap();
  await sleep(1500);
  const after = await elText('.reminder-desc', '提醒描述');
  assertIn(after, '每天', '开启后应显示提醒时间');
});
await shot('12-详情-提醒开启');

// ---------- 5. 补卡（先于今日打卡，验证正常补卡流程） ----------
console.log('\n== 5. 补卡流程 ==');
let makeupDateChosen = '';
await test('点日历可补卡日期 → 出现补卡横幅', async () => {
  await scrollToBottom();
  const day = await el('.calendar-day.can-makeup', '可补卡日期');
  await day.tap();
  await sleep(900);
  const banner = await (await page()).$('.makeup-banner');
  assert(banner, '应显示补卡横幅');
  assertIn(await elText('.makeup-banner-title', '补卡标题'), '正在补卡');
  const d = await pageData();
  makeupDateChosen = d.makeupDate || '';
  assert(makeupDateChosen, 'makeupDate 应已设置');
});
await shot('13-补卡-横幅');

await test('上传区点击 → 模拟选图上传 → 预览出现（完整管线）', async () => {
  await scrollToTop();
  await mock('showActionSheet', { tapIndex: 1 });
  await mock('chooseMedia', { tempFiles: [{ tempFilePath: '/tmp/qa-checkin.png', fileType: 'image' }], type: 'image' });
  await mock('uploadFile', { statusCode: 200, data: JSON.stringify({ success: true, data: { url: CHECKIN_PATH } }) });
  await tap('.upload-area', '上传区');
  await sleep(2000);
  await restore('showActionSheet');
  await restore('chooseMedia');
  await restore('uploadFile');
  const img = await (await page()).$('.preview-image');
  assert(img, '选图后应显示预览图');
  const d = await pageData();
  assertEq(d.checkinImageUrl, CHECKIN_PATH, 'checkinImageUrl');
  assertEq(d.checkinMediaType, 'image', 'checkinMediaType');
});
await shot('14-补卡-表单已填图');

await test('填感言 → 提交补卡 → 记录为待审核', async () => {
  const ta = await el('.textarea', '补卡感言');
  await ta.input('补昨天的卡，昨天也练了');
  await sleep(400);
  const btn = await el('.checkin-card .btn-large', '提交补卡');
  await btn.tap();
  await sleep(3000);
  assert(makeupDateChosen, '应先完成补卡日期选择');
  const part = db.prepare('SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(evtId, meId());
  const rec = db.prepare('SELECT status FROM checkin_records WHERE participant_id = ? AND checkin_date = ?').get(part.id, makeupDateChosen);
  assert(rec && rec.status === 'pending', `补卡记录应为 pending（日期 ${makeupDateChosen}），实际 ${rec && rec.status}`);
});
await shot('15-补卡-提交后');

// ---------- 6. 今日打卡 ----------
console.log('\n== 6. 今日打卡 ==');
await test('今日打卡：填图 + 感言 → 提交 → 成功弹窗', async () => {
  await scrollToTop();
  await setPageData({ checkinImage: CHECKIN_PATH, checkinImageUrl: CHECKIN_PATH, checkinMediaType: 'image' });
  const ta = await el('.textarea', '感言输入框');
  await ta.input('今天练习了基本功 20 分钟，很开心！');
  await sleep(400);
  const btn = await el('.checkin-card .btn-large', '立即打卡按钮');
  await btn.tap();
  await sleep(3000);
  const modal = await (await page()).$('.success-content');
  assert(modal, '应弹出打卡成功弹窗');
});
await shot('16-今日打卡-成功弹窗');

await test('成功弹窗：含生成海报/邀请好友，可关闭', async () => {
  const body = await (await el('.success-content', '成功弹窗')).text();
  assertIn(body, '生成打卡海报');
  assertIn(body, '邀请好友一起打卡');
  await tap('.success-close', '暂不分享');
  await sleep(900);
  assert(!(await (await page()).$('.success-content')), '弹窗应关闭');
});

await test('打卡后：今日已打卡状态 + 记录展示', async () => {
  db.prepare("UPDATE checkin_records SET status = 'approved' WHERE participant_id = (SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?) AND checkin_date = ?").run(evtId, meId(), today);
  await nav(`/pages/event-detail/event-detail?id=${evtId}`);
  await scrollToTop();
  const body = await bodyText();
  assertIn(body, '今日已打卡');
  assertIn(body, '今天练习了基本功 20 分钟');
});
await shot('17-今日打卡-已打卡状态');

await test('修改今日打卡：编辑态 + 保存修改', async () => {
  await scrollToBottom();
  await tap('.btn-secondary', '修改今日打卡');
  await sleep(900);
  let body = await bodyText();
  assertIn(body, '修改今日打卡', '应显示编辑横幅');
  await scrollToTop();
  await setPageData({ checkinImage: CHECKIN_PATH, checkinImageUrl: CHECKIN_PATH, checkinMediaType: 'image' });
  const ta = await el('.textarea', '感言输入框');
  await ta.input('修改后的感言：今天加练了 30 分钟');
  await sleep(400);
  await tap('.btn-large', '保存修改');
  await sleep(3000);
  // 归一化：数据库直接置为通过，确保后续用例状态确定
  db.prepare("UPDATE checkin_records SET status = 'approved' WHERE participant_id = (SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?) AND checkin_date = ?").run(evtId, meId(), today);
  await nav(`/pages/event-detail/event-detail?id=${evtId}`);
  await scrollToTop();
  body = await bodyText();
  assertIn(body, '修改后的感言：今天加练了 30 分钟');
});
await shot('18-今日打卡-修改完成');

// ---------- 7. 补卡修复验证：今日已打卡后仍可补卡 ----------
console.log('\n== 7. 补卡修复验证 ==');
await test('已打卡后补卡：点可补卡日期 → 补卡表单出现（修复验证）', async () => {
  await scrollToBottom();
  const day = await el('.calendar-day.can-makeup', '可补卡日期（剩余）');
  await day.tap();
  await sleep(900);
  const banner = await (await page()).$('.makeup-banner');
  assert(banner, '今日已打卡后点可补卡日期应显示补卡横幅');
  const body = await bodyText();
  assertIn(body, '正在补卡', '应显示补卡横幅标题');
  assertIn(body, '提交补卡', '按钮文案应为提交补卡');
  const btn = await (await page()).$$('.checkin-card .btn-large');
  assert(btn.length > 0, '应显示补卡提交按钮');
});
await shot('19-补卡-已打卡后补卡');

// ---------- 8. 动态与点赞 ----------
console.log('\n== 8. 动态与点赞 ==');
await test('大家的打卡：展示其他家长记录', async () => {
  await scrollToBottom();
  const body = await bodyText();
  assertIn(body, '大家的打卡');
  assertIn(body, '另一位家长', '应看到其他家长动态');
});
await shot('20-动态-列表');

await test('点赞/取消点赞切换', async () => {
  await (await el('.feed-like', '点赞按钮')).tap();
  await sleep(1200);
  assertIn(await elText('.feed-like', '点赞按钮'), '已鼓励', '点赞后文案应变化');
  await shot('21-动态-已点赞');
  await (await el('.feed-like', '点赞按钮')).tap();
  await sleep(1200);
  assertIn(await elText('.feed-like', '点赞按钮'), '鼓励', '再点应取消点赞');
});

// ---------- 9. 分享链接 ----------
console.log('\n== 9. 分享链接 ==');
await test('分享活动：弹窗显示明文链接', async () => {
  await scrollToTop();
  await tap('.share-card', '分享活动');
  await sleep(1500);
  const box = await el('.share-link-box', '分享链接');
  assertIn(await box.text(), 'weixin://dl/business', '应显示明文链接');
});
await shot('22-分享-链接弹窗');
await tap('.modal-btn-secondary', '取消');
await sleep(500);

// ---------- 10. 排行榜 ----------
console.log('\n== 10. 排行榜 ==');
await test('排行榜：我的排名与领奖台', async () => {
  await scrollToBottom();
  await tap('.ranking-entry', '排行榜入口');
  await sleep(1800);
  const p = await page();
  assertIn(p.path, 'ranking');
  const body = await bodyText();
  assertIn(body, '另一位家长', '应显示第一名');
  assertIn(body, '自动化测试家长', '应显示我的名字');
});
await shot('23-排行榜');

// ---------- 11. 我的打卡 ----------
console.log('\n== 11. 我的打卡 ==');
await test('底部导航 → 我的打卡', async () => {
  await nav('/pages/index/index');
  const navItems = await (await page()).$$('.bottom-nav .nav-item');
  assert(navItems.length >= 2, '应有底部导航');
  await navItems[1].tap();
  await sleep(1800);
  const p = await page();
  assertIn(p.path, 'my-checkins');
  const body = await bodyText();
  assertIn(body, '自动化UI活动', '应列出我的活动');
});
await shot('24-我的打卡');

// ---------- 12. 个人中心 ----------
console.log('\n== 12. 个人中心 ==');
await test('底部导航 → 我的：资料 + 徽章', async () => {
  // 预置徽章成就，让「我的徽章」区块出现
  const part = db.prepare('SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(evtId, meId());
  db.prepare('INSERT OR IGNORE INTO checkin_badge_achievements (badge_id, participant_id) VALUES (?, ?)').run(badgeId, part.id);
  const navItems = await (await page()).$$('.bottom-nav .nav-item');
  await navItems[2].tap();
  await sleep(1800);
  const p = await page();
  assertIn(p.path, 'profile');
  const body = await bodyText();
  assertIn(body, '自动化测试家长');
  assertIn(body, '孩子：糖糖', '应显示孩子名');
  assertIn(body, '我的徽章', '应有徽章区块');
  assertIn(body, '全勤之星');
});
await shot('25-我的');

await test('编辑资料：修改昵称并保存', async () => {
  await tap('.edit-btn', '编辑资料');
  await sleep(900);
  const inputs = await (await page()).$$('.edit-input');
  assert(inputs.length >= 1, '应有昵称输入框');
  await inputs[0].input('自动化测试家长V2');
  await sleep(400);
  await tap('.edit-btn-save', '保存');
  await sleep(1800);
  const body = await bodyText();
  assertIn(body, '自动化测试家长V2', '保存后应显示新昵称');
});
await shot('26-我的-编辑后');

await test('积分入口：积分页展示余额', async () => {
  await tap('.points-card', '积分卡');
  await sleep(1800);
  const p = await page();
  assertIn(p.path, 'points');
  const body = await bodyText();
  assertIn(body, '积分');
  assert(await (await page()).$('.points-hero'), '应有积分余额卡片');
});
await shot('27-积分页');

// ---------- 13. 被拒态 ----------
console.log('\n== 13. 审核被拒态 ==');
await test('今日打卡被拒 → 详情页显示未通过横幅', async () => {
  const part = db.prepare('SELECT id FROM checkin_participants WHERE event_id = ? AND wx_user_id = ?').get(evtId, meId());
  db.prepare("UPDATE checkin_records SET status = 'rejected', review_note = '请重新上传更清晰的照片' WHERE participant_id = ? AND checkin_date = ?").run(part.id, today);
  await nav(`/pages/event-detail/event-detail?id=${evtId}`);
  await scrollToTop();
  const body = await bodyText();
  assertIn(body, '今日打卡未通过', '应显示未通过横幅');
  assertIn(body, '请重新上传更清晰的照片', '应显示审核意见');
});
await shot('28-详情-被拒横幅');

// ---------- 14. 退出登录 ----------
console.log('\n== 14. 退出登录 ==');
await test('退出登录：确认弹窗（mock 确认）→ 回到游客态', async () => {
  await nav('/pages/profile/profile');
  await mock('showModal', { confirm: true, cancel: false });
  await tap('.logout-btn', '退出登录');
  await sleep(2500);
  await restore('showModal');
  const body = await bodyText();
  assertIn(body, '欢迎使用打卡小程序', '退出后应显示游客态');
});
await shot('29-我的-退出登录后');

// ---------- 15. 隐私政策 ----------
console.log('\n== 15. 隐私政策 ==');
await test('登录页 → 隐私政策', async () => {
  await nav('/pages/login/login');
  await tap('.link', '隐私政策链接');
  await sleep(1500);
  const p = await page();
  assertIn(p.path, 'privacy');
  const c = await (await page()).$('.privacy-container');
  const body = c ? await c.text() : '';
  assert(body.length > 50, '隐私政策应有内容');
});
await shot('30-隐私政策');

// ---------- 16. 空态 ----------
console.log('\n== 16. 空态 ==');
await test('退出登录后我的打卡显示登录引导', async () => {
  await nav('/pages/my-checkins/my-checkins');
  const body = await bodyText();
  assertIn(body, '登录后查看打卡记录', '未登录应显示登录引导');
});
await shot('31-我的打卡-未登录空态');

// ---------- 收尾 ----------
console.log(`\n========== UI 测试结果: ${passed} 通过, ${failed} 失败 ==========`);
if (consoleErrors.length > 0) {
  console.log('\n小程序 console 报错（' + consoleErrors.length + ' 条）:');
  for (const e of consoleErrors.slice(0, 20)) console.log('  -', String(e).slice(0, 300));
}
if (failed > 0) {
  console.log('\n失败明细:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
}
try { await miniProgram.close(); } catch {}
process.exit(failed > 0 ? 1 : 0);

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 定向清除 12 条演示客户及其关联演示数据（orders / follow_ups / children / points_ledger）。
 *
 * 背景：早期版本曾把 api/db.ts 的演示种子写进生产库，customers 里留下 12 条假客户，
 * 线上 27 笔订单、6 条跟进、8 个孩子全挂在它们身上。把它们「合并」进 wx_users 等于
 * 往生产塞假用户，所以正确动作是反向删除，且只删身份指纹与演示常量完全一致的行。
 *
 * 用法：
 *   预览（只读，不写库）：  npm run data:clear-demo-customers
 *   真正执行：              CONFIRM_CLEAR_DEMO_CUSTOMERS=YES npm run data:clear-demo-customers -- --execute
 *
 * 安全设计：
 *   1. 默认只读预览；执行需同时给 --execute 与 CONFIRM_CLEAR_DEMO_CUSTOMERS=YES
 *   2. 只认 12 个演示姓名。演示主体可能同时以两种形态存在——customers 表里的原行，
 *      以及被合并进 wx_users 后 openid = migrated_customer_N 的行；两者一起处理，
 *      因此未迁移（生产）与已迁移/半迁移（本地预演）三种库形态都能一次清干净
 *   3. 演示主体不得被 wx_users 引用、不得牵连真实 wx_user_id、不得出现在打卡表；
 *      customers 形态下任何落在演示集之外的引用都视为牵连真实数据 —— 一律在写盘前中止
 *   4. 执行前用在线备份 API 生成还原点并逐表校验行数，删除后再跑 integrity_check / foreign_key_check
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'learngrow.db');

const shouldExecute = process.argv.includes('--execute');

/** api/db.ts 演示种子的 12 个客户姓名，顺序即 customers.id 1..12 */
const DEMO_NAMES = [
  '轩轩妈妈-三年级', '朵朵爸爸-五年级', '萌萌妈妈-初一', '浩浩外婆-转介绍',
  '阳阳爸爸-程序员', '甜甜妈妈-英语老师', '磊磊奶奶-退休', '芊芊妈妈-主播同行',
  '宇宇爸爸-薅羊毛', '航航妈妈-新粉', '琪琪妈妈-全职太太', '然然妈妈-二年级',
];

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function tableList(db: Database.Database): string[] {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all().map((r: any) => r.name);
}

function readColumns(db: Database.Database, table: string): string[] {
  return db.prepare(`PRAGMA table_info('${table}')`).all().map((c: any) => c.name);
}

/** 列信息缓存：同一份 schema 在预览与执行阶段被反复查询 */
let schemaCache: { tables: string[]; cols: Record<string, string[]> } | null = null;
function schema(db: Database.Database) {
  if (!schemaCache) {
    const tables = tableList(db);
    const cols: Record<string, string[]> = {};
    for (const t of tables) cols[t] = readColumns(db, t);
    schemaCache = { tables, cols };
  }
  return schemaCache;
}

function hasColumn(db: Database.Database, table: string, col: string): boolean {
  const { tables, cols } = schema(db);
  return tables.includes(table) && cols[table].includes(col);
}

function rowCount(db: Database.Database, table: string, where = '1=1', params: any[] = []): number {
  return (db.prepare(`SELECT COUNT(*) c FROM "${table}" WHERE ${where}`).get(...params) as any).c;
}

function idsOf(db: Database.Database, table: string, column: string, ids: number[], idCol = 'id'): number[] {
  if (!ids.length || !hasColumn(db, table, column)) return [];
  const placeholders = ids.map(() => '?').join(',');
  return (db.prepare(`SELECT ${idCol} AS id FROM "${table}" WHERE ${column} IN (${placeholders})`)
    .all(...ids) as any[]).map(r => r.id);
}

function placeholders(n: number): string {
  return n ? Array(n).fill('?').join(',') : 'NULL';
}

/** 一条删除动作：某表里外键指向这批演示主体的行 */
interface DeleteOp {
  table: string;
  column: string;
  ids: number[];
  willDelete: number;
  /** customers 形态专用：引用了演示集之外的主体，视为牵连真实数据 */
  outside: number;
  /** 待删行里同时带着真实 wx_user_id 的条数，必须为 0 */
  realUserLinked: number;
}

interface Plan {
  customerIds: number[];
  wxUserIds: number[];
  ops: DeleteOp[];
  keptUsers: number;
}

function keptUserCount(db: Database.Database): number {
  return hasColumn(db, 'wx_users', 'openid')
    ? rowCount(db, 'wx_users', "openid NOT LIKE 'migrated_customer_%'")
    : rowCount(db, 'wx_users');
}

function assertMatchesDemo(rows: { id: number; name: string }[], who: string): void {
  const names = new Set(rows.map(r => r.name));
  const missing = DEMO_NAMES.filter(n => !names.has(n));
  const extra = rows.filter(r => !DEMO_NAMES.includes(r.name)).map(r => `#${r.id} ${r.name}`);
  if (missing.length || extra.length) {
    fail(`${who}与演示常量不一致，可能混有真实数据，已中止。\n` +
      `   缺少的演示姓名：${missing.join(', ') || '无'}\n` +
      `   不属于演示姓名的行：${extra.join(', ') || '无'}`);
  }
}

function buildPlan(db: Database.Database): Plan {
  const { tables, cols } = schema(db);
  const keptUsers = keptUserCount(db);
  const ops: DeleteOp[] = [];

  // 形态一：演示客户仍在 customers 表里（生产当前形态）
  let customerIds: number[] = [];
  if (tables.includes('customers')) {
    const total = rowCount(db, 'customers');
    if (total > 0) {
      if (total !== DEMO_NAMES.length) {
        fail(`customers 表有 ${total} 条，与演示种子的 ${DEMO_NAMES.length} 条不符，无法判定哪些是演示数据，已中止`);
      }
      const rows = db.prepare('SELECT id, name FROM customers ORDER BY id').all() as any[];
      assertMatchesDemo(rows, 'customers 表');
      customerIds = rows.map(r => r.id);

      // 真实用户身上残留 customer_id 指向演示客户时，不能顺手删真实用户行
      if (cols['wx_users'].includes('customer_id')) {
        const linked = rowCount(db, 'wx_users', `customer_id IN (${placeholders(customerIds.length)})`, customerIds);
        if (linked > 0) {
          fail(`${linked} 位 wx_users 仍引用演示客户，删除会牵连真实用户，请先在管理端确认这些关联`);
        }
      }
      for (const t of tables) {
        if (t === 'customers' || t === 'wx_users' || !cols[t].includes('customer_id')) continue;
        ops.push({
          table: t,
          column: 'customer_id',
          ids: customerIds,
          willDelete: rowCount(db, t, `customer_id IN (${placeholders(customerIds.length)})`, customerIds),
          outside: rowCount(db, t,
            `customer_id IS NOT NULL AND customer_id NOT IN (${placeholders(customerIds.length)})`, customerIds),
          realUserLinked: cols[t].includes('wx_user_id')
            ? rowCount(db, t, `customer_id IN (${placeholders(customerIds.length)}) AND wx_user_id IS NOT NULL`, customerIds)
            : 0,
        });
      }
    }
  }

  // 形态二：演示客户已被合并成 wx_users（本地预演形态）
  let wxUserIds: number[] = [];
  if (hasColumn(db, 'wx_users', 'openid') && hasColumn(db, 'wx_users', 'name')) {
    const rows = db.prepare("SELECT id, name FROM wx_users WHERE openid LIKE 'migrated_customer_%' ORDER BY id")
      .all() as any[];
    if (rows.length) {
      assertMatchesDemo(rows, 'wx_users 里的 migrated_customer_* 记录');
      wxUserIds = rows.map(r => r.id);
      const inIds = placeholders(wxUserIds.length);
      for (const t of tables) {
        if (t === 'wx_users' || !cols[t].includes('wx_user_id')) continue;
        ops.push({
          table: t, column: 'wx_user_id', ids: wxUserIds,
          willDelete: rowCount(db, t, `wx_user_id IN (${inIds})`, wxUserIds),
          outside: 0, realUserLinked: 0,
        });
      }
    }
  } else if (!customerIds.length) {
    console.log('✅ 未发现演示客户（customers 已为空，且 wx_users 尚未有合并列），无需处理。');
    process.exit(0);
  }

  // 两种形态下演示主体名下的孩子，其学习进度也要一并清掉
  const childIds = [
    ...idsOf(db, 'children', 'customer_id', customerIds),
    ...idsOf(db, 'children', 'wx_user_id', wxUserIds),
  ];
  if (childIds.length && hasColumn(db, 'child_learning_progress', 'child_id')) {
    ops.unshift({
      table: 'child_learning_progress',
      column: 'child_id',
      ids: [...new Set(childIds)],
      willDelete: rowCount(db, 'child_learning_progress',
        `child_id IN (${placeholders(childIds.length)})`, childIds),
      outside: 0, realUserLinked: 0,
    });
  }

  if (!customerIds.length && !wxUserIds.length) {
    console.log('✅ 未发现演示客户（customers 为空，wx_users 里也没有 migrated_customer_* 记录），无需处理。');
    process.exit(0);
  }
  return { customerIds, wxUserIds, ops, keptUsers };
}

function reviewPlan(db: Database.Database, plan: Plan): void {
  const shapes = [
    plan.customerIds.length ? `customers 表 ${plan.customerIds.length} 条` : '',
    plan.wxUserIds.length ? `wx_users(migrated) ${plan.wxUserIds.length} 条` : '',
  ].filter(Boolean).join(' + ');
  console.log(`🔎 演示主体：${shapes}`);
  console.log(`   保留的真实微信用户：${plan.keptUsers} 位`);
  console.table(plan.ops.map(o => ({
    表: o.table, 外键: o.column, 将删除: o.willDelete, 演示集之外: o.outside, 带真实用户引用: o.realUserLinked,
  })));

  const risky = plan.ops.filter(o => o.outside > 0);
  if (risky.length) {
    fail(`以下表里存在不属于演示集的引用，删除会牵连真实数据，已中止：\n` +
      risky.map(o => `   ${o.table}.${o.column} 有 ${o.outside} 行在演示集之外`).join('\n'));
  }
  const realLinked = plan.ops.filter(o => o.realUserLinked > 0);
  if (realLinked.length) {
    fail(`待删的演示数据里有 ${realLinked.map(o => `${o.table} ${o.realUserLinked} 行`).join('、')} 同时带着真实 wx_user_id，已中止`);
  }
  const checkin = plan.ops.find(o => o.table.startsWith('checkin_') && o.willDelete > 0);
  if (checkin) {
    fail(`演示主体与打卡数据存在关联（${checkin.table} ${checkin.willDelete} 行），不符合预期，已中止`);
  }
}

function bjtStamp(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
}

function remainingDemo(db: Database.Database): number {
  let n = 0;
  if (hasColumn(db, 'customers', 'id')) n += rowCount(db, 'customers');
  if (hasColumn(db, 'wx_users', 'openid')) n += rowCount(db, 'wx_users', "openid LIKE 'migrated_customer_%'");
  return n;
}

async function main() {
  if (!fs.existsSync(dbPath)) fail(`未找到数据库：${dbPath}（服务器上如需指定，请设置 DATA_DIR）`);
  const db = new Database(dbPath, { readonly: !shouldExecute });
  if (shouldExecute) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }

  const plan = buildPlan(db);
  reviewPlan(db, plan);

  if (!shouldExecute) {
    console.log('\n这是预览，本次以只读方式打开数据库，未改动任何数据。确认无误后执行：');
    console.log('  CONFIRM_CLEAR_DEMO_CUSTOMERS=YES npm run data:clear-demo-customers -- --execute');
    db.close();
    return;
  }
  if (process.env.CONFIRM_CLEAR_DEMO_CUSTOMERS !== 'YES') {
    db.close();
    fail('缺少 CONFIRM_CLEAR_DEMO_CUSTOMERS=YES，已取消删除。');
  }

  const before = Object.fromEntries(schema(db).tables.map(t => [t, rowCount(db, t)])) as Record<string, number>;
  const backupPath = path.join(dataDir, 'backups', `learngrow-before-clear-demo-${bjtStamp()}.db`);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  await db.backup(backupPath);

  const bak = new Database(backupPath, { readonly: true });
  const mismatch = tableList(bak).filter(t => {
    try { return rowCount(bak, t) !== before[t]; } catch { return true; }
  });
  const bakUsers = keptUserCount(bak);
  bak.close();
  if (mismatch.length || bakUsers !== plan.keptUsers) {
    db.close();
    fail(`还原点校验失败${mismatch.length ? `（${mismatch.join(', ')} 行数不一致）` : '（真实用户数不一致）'}，未做任何删除。文件：${backupPath}`);
  }
  console.log(`🛟 还原点已生成并逐表校验：${backupPath}`);

  const run = db.transaction(() => {
    // 先清最深层引用，再清主体，避免外键报错
    for (const op of plan.ops) {
      if (!op.willDelete) continue;
      db.prepare(`DELETE FROM "${op.table}" WHERE ${op.column} IN (${placeholders(op.ids.length)})`).run(...op.ids);
    }
    if (plan.customerIds.length) {
      db.prepare(`DELETE FROM customers WHERE id IN (${placeholders(plan.customerIds.length)})`).run(...plan.customerIds);
    }
    if (plan.wxUserIds.length) {
      db.prepare(`DELETE FROM wx_users WHERE id IN (${placeholders(plan.wxUserIds.length)})`).run(...plan.wxUserIds);
    }
  });
  run();
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    console.log('ℹ️  WAL checkpoint 因并发占用未执行，不影响删除结果');
  }

  const integrity = (db.prepare('PRAGMA integrity_check').get() as any).integrity_check;
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
  const after = Object.fromEntries(schema(db).tables.map(t => [t, rowCount(db, t)])) as Record<string, number>;
  const stillKept = keptUserCount(db);
  const remaining = remainingDemo(db);
  db.close();

  console.log(`🧪 integrity_check：${integrity} · foreign_key_check 违规 ${fkViolations.length} 条`);
  console.log(`📊 剩余有数据的表：${Object.entries(after).filter(([, c]) => c > 0).map(([t, c]) => `${t}=${c}`).join('  ')}`);
  console.log(`👤 真实微信用户：${stillKept} 位（删除前 ${plan.keptUsers} 位）· 残留演示主体 ${remaining} 条`);

  if (integrity !== 'ok' || fkViolations.length > 0) {
    fail(`删除后体检异常，请立即回滚：pm2 stop learngrow-crm && npm run backup:restore -- ${backupPath}`);
  }
  if (stillKept !== plan.keptUsers || remaining !== 0) {
    fail(`结果不符合预期（真实用户 ${plan.keptUsers}→${stillKept}，残留演示 ${remaining}），请回滚：${backupPath}`);
  }
  console.log('');
  console.log('🎉 演示数据清理完成，服务直接读库、无需重启。回滚方式：pm2 stop 后 npm run backup:restore -- <还原点路径>');
}

main().catch((err: any) => fail(err.message || String(err)));

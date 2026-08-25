import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'learngrow.db');
const uploadsDir = path.join(projectRoot, 'uploads');
const shouldExecute = process.argv.includes('--execute');
const shouldDeleteUploads = process.argv.includes('--delete-uploads');

const tablesToClear = [
  'checkin_record_likes',
  'checkin_badge_achievements',
  'checkin_records',
  'checkin_participants',
  'checkin_badges',
  'checkin_materials',
  'checkin_reminders',
  'wx_subscribe_records',
  'wx_users',
  'checkin_events',
  'materials',
  'orders',
  'follow_ups',
  'child_learning_progress',
  'children',
  'wechat_group_members',
  'wechat_groups',
  'learning_stages',
  'learning_paths',
  'products',
  'customers',
] as const;

if (!fs.existsSync(dbPath)) {
  console.error(`未找到数据库：${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
const counts = tablesToClear.map((table) => ({
  table,
  count: (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count,
}));
const uploadFiles = fs.existsSync(uploadsDir)
  ? fs.readdirSync(uploadsDir).filter((name) => fs.statSync(path.join(uploadsDir, name)).isFile())
  : [];

console.table(counts.filter(({ count }) => count > 0));
console.log(`将保留：后台用户、教材目录、微信订阅模板、系统配置。`);
console.log(`上传文件：${uploadFiles.length} 个${shouldDeleteUploads ? '（将删除）' : '（将保留）'}`);

if (!shouldExecute) {
  console.log('这是预览，未删除任何数据。确认后运行：CONFIRM_CLEAR_DEMO_DATA=YES npm run data:clear-demo -- --execute --delete-uploads');
  db.close();
  process.exit(0);
}

if (process.env.CONFIRM_CLEAR_DEMO_DATA !== 'YES') {
  console.error('缺少 CONFIRM_CLEAR_DEMO_DATA=YES，已取消删除。');
  db.close();
  process.exit(1);
}

const backupDir = path.join(dataDir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `learngrow-before-launch-${timestamp}.db`);
await db.backup(backupPath);

const clearData = db.transaction(() => {
  for (const table of tablesToClear) db.prepare(`DELETE FROM ${table}`).run();
  const placeholders = tablesToClear.map(() => '?').join(', ');
  db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...tablesToClear);
});
clearData();
db.pragma('wal_checkpoint(TRUNCATE)');
db.exec('VACUUM');
db.close();

if (shouldDeleteUploads && fs.existsSync(uploadsDir)) {
  for (const name of uploadFiles) fs.rmSync(path.join(uploadsDir, name));
}

console.log(`演示数据已清除。数据库备份：${backupPath}`);

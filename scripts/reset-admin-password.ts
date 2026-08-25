import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const username = process.env.ADMIN_USERNAME || process.argv[2] || 'admin';
const password = process.env.ADMIN_PASSWORD || process.argv[3];

if (!password || password.length < 12) {
  console.error('用法：ADMIN_PASSWORD=至少12位强密码 npm run admin:reset');
  console.error('也可以：npm run admin:reset -- admin 至少12位强密码');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const dbPath = path.join(dataDir, 'learngrow.db');

const db = new Database(dbPath);
const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;

if (!user) {
  console.error(`未找到用户：${username}`);
  process.exit(1);
}

db.prepare('UPDATE users SET password = ? WHERE username = ?').run(bcrypt.hashSync(password, 10), username);
db.close();

console.log(`✅ 已重置 ${username} 的密码`);

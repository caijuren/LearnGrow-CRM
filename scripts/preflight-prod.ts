/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`✅ ${message}`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`缺少环境变量 ${name}`);
  if (value.startsWith('your_') || value.startsWith('replace_with_')) {
    fail(`环境变量 ${name} 仍是模板占位值`);
  }
  return value;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

dotenv.config({ path: path.join(projectRoot, '.env.production'), quiet: true });
const { resolveJwtSecret } = await import('../api/services/auth.js');

if (process.env.NODE_ENV !== 'production') {
  fail('NODE_ENV 必须为 production');
}

try {
  resolveJwtSecret(process.env);
  ok('JWT_SECRET 已配置');
} catch (e: any) {
  fail(e.message);
}

const initialAdminPassword = requireEnv('INITIAL_ADMIN_PASSWORD');
if (initialAdminPassword.length < 12) {
  fail('INITIAL_ADMIN_PASSWORD 至少需要12位');
}
ok('INITIAL_ADMIN_PASSWORD 已配置');

requireEnv('WX_APPID');
requireEnv('WX_SECRET');
ok('微信小程序环境变量已配置');

const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
if (!path.isAbsolute(dataDir)) {
  fail('DATA_DIR 必须是绝对路径');
}
ok(`DATA_DIR=${dataDir}`);

const dbPath = path.join(dataDir, 'learngrow.db');
try {
  const db = new Database(dbPath);
  const users = db.prepare("SELECT username, password FROM users WHERE username IN ('admin', 'assistant')").all() as any[];
  for (const user of users) {
    const defaultPassword = user.username === 'admin' ? 'admin123' : 'assist123';
    if (bcrypt.compareSync(defaultPassword, user.password)) {
      fail(`默认账号 ${user.username} 仍在使用默认密码，请先运行 npm run admin:reset`);
    }
  }
  ok('未检测到默认账号密码');
  db.close();
} catch (e: any) {
  if (e.code === 'SQLITE_CANTOPEN') {
    ok('数据库尚未初始化，首次启动将创建生产数据库');
  } else if (String(e.message || '').includes('no such table')) {
    ok('数据库尚未创建用户表，首次启动将初始化');
  } else {
    fail(`数据库预检失败：${e.message}`);
  }
}

console.log('🎉 生产预检通过');

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 数据备份服务：将 SQLite 数据库（一致性快照）与 uploads 媒体目录打包为 zip，
 * 支持手动备份（后台下载/命令行）与每日自动备份，并按保留数量清理旧备份。
 */
import { ZipArchive } from 'archiver';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.join(__dirname, '..', '..');
export const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
export const uploadsDir = path.join(projectRoot, 'uploads');
export const backupsDir = process.env.BACKUP_DIR || path.join(projectRoot, 'backups');

// 备份保留份数（默认 14 份），可通过环境变量覆盖
export const BACKUP_KEEP_COUNT = parseInt(process.env.BACKUP_KEEP_COUNT || '14', 10) || 14;

// 每日自动备份触发时间（北京时间 HH:mm）
export const AUTO_BACKUP_TIME = process.env.AUTO_BACKUP_TIME || '03:30';

export interface BackupFileInfo {
  name: string;
  filePath: string;
  size: number;
  createdAt: string;
}

function bjtDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function bjtNowString(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

// 用于备份文件名的北京时间时间戳：YYYYMMDDHHmmss
function timestamp(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function bjtToday(): string {
  return bjtDateString(Date.now() + 8 * 3600 * 1000);
}

export function bjtNowHHMM(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(11, 16);
}

function backupMeta(): Record<string, any> {
  let version = 'dev';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
    version = String(pkg.version || 'dev');
  } catch {
    /* ignore */
  }
  return {
    created_at: bjtNowString(),
    version,
    database: 'data/learngrow.db',
    uploads: 'uploads/',
    note: '乐学长打卡 完整备份（数据库 + 打卡媒体）',
  };
}

export function listBackups(): BackupFileInfo[] {
  if (!fs.existsSync(backupsDir)) return [];
  const files = fs.readdirSync(backupsDir)
    .filter((f) => /^backup_\d{14}\.zip$/.test(f))
    .sort()
    .reverse();
  return files.map((name) => {
    const filePath = path.join(backupsDir, name);
    const stat = fs.statSync(filePath);
    // 文件名中的时间戳即北京时间创建时间
    const createdAt = `${name.slice(7, 11)}-${name.slice(11, 13)}-${name.slice(13, 15)} ${name.slice(15, 17)}:${name.slice(17, 19)}:${name.slice(19, 21)}`;
    return { name, filePath, size: stat.size, createdAt };
  });
}

/**
 * 清理旧备份，只保留最近 BACKUP_KEEP_COUNT 份。
 */
export function cleanupOldBackups(): string[] {
  const backups = listBackups();
  if (backups.length <= BACKUP_KEEP_COUNT) return [];
  const removed: string[] = [];
  for (const b of backups.slice(BACKUP_KEEP_COUNT)) {
    try {
      fs.unlinkSync(b.filePath);
      removed.push(b.name);
    } catch {
      /* ignore */
    }
  }
  return removed;
}

/**
 * 生成一份完整备份 zip（SQLite 一致性快照 + uploads 媒体文件），
 * 备份文件会保留在 backups 目录中，并顺带清理超过保留数量的旧备份。
 */
export async function createBackup(): Promise<BackupFileInfo> {
  ensureDir(backupsDir);
  const ts = timestamp();
  const fileName = `backup_${ts}.zip`;
  const filePath = path.join(backupsDir, fileName);
  const snapshotPath = path.join(backupsDir, `.snapshot_${ts}.db`);
  const dbPath = path.join(dataDir, 'learngrow.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`数据库文件不存在：${dbPath}`);
  }

  // 1. 使用 SQLite 在线备份 API 生成一致性快照，不锁库、不影响线上服务
  const conn = new Database(dbPath);
  try {
    await conn.backup(snapshotPath);
  } finally {
    conn.close();
  }

  // 2. 打包为 zip
  try {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = new ZipArchive({ zlib: { level: 6 } });
      output.on('close', () => resolve());
      output.on('error', (err) => reject(err));
      archive.on('error', (err) => reject(err));
      archive.pipe(output);
      archive.file(snapshotPath, { name: 'data/learngrow.db' });
      if (fs.existsSync(uploadsDir)) {
        archive.directory(uploadsDir, 'uploads');
      }
      archive.append(JSON.stringify(backupMeta(), null, 2), { name: 'backup-info.json' });
      archive.finalize();
    });
  } finally {
    try {
      fs.unlinkSync(snapshotPath);
    } catch {
      /* ignore */
    }
  }

  cleanupOldBackups();

  return {
    name: fileName,
    filePath,
    size: fs.statSync(filePath).size,
    createdAt: bjtNowString(),
  };
}

/**
 * 校验备份文件名，防止路径穿越。
 */
export function isValidBackupName(name: string): boolean {
  return /^backup_\d{14}\.zip$/.test(name) && !name.includes('/') && !name.includes('\\') && !name.includes('..');
}

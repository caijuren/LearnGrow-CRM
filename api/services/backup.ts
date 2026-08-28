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

function countUploadsOnDisk(): number {
  if (!fs.existsSync(uploadsDir)) return 0;
  return fs.readdirSync(uploadsDir).filter((name) => {
    try {
      return fs.statSync(path.join(uploadsDir, name)).isFile();
    } catch {
      return false;
    }
  }).length;
}

async function countUploadsInZip(zipPath: string): Promise<number> {
  // adm-zip 无内置类型声明，与 scripts/restore-backup.ts 保持一致的动态导入方式
  const { default: AdmZip } = (await import('adm-zip')) as any;
  const zip = new AdmZip(zipPath);
  return (zip.getEntries() as Array<{ entryName: string }>).filter(
    (e) => e.entryName.startsWith('uploads/') && !e.entryName.endsWith('/')
  ).length;
}

// 库里存了 /uploads 相对路径的全部位置；新增媒体字段时要一并登记，否则体检会漏算
const MEDIA_COLUMNS: Array<{ table: string; column: string }> = [
  { table: 'wx_users', column: 'avatar_url' },
  { table: 'checkin_records', column: 'image_url' },
  { table: 'checkin_materials', column: 'file_url' },
  { table: 'materials', column: 'file_url' },
  { table: 'banners', column: 'image_url' },
];

export interface MediaReferenceScan {
  referenced: number;
  missing: number;
  samples: string[];
}

/**
 * 统计库里引用的 /uploads 文件有多少在磁盘上不存在。
 * 「库有记录、盘上没文件」正是 2026-08-27 那批头像与打卡图丢失的形状：
 * 当天 21:21 之前的备份包根本不含 uploads，恢复旧库后引用全部悬空。
 */
export function scanMediaReferences(dbPath: string, mediaDir: string = uploadsDir): MediaReferenceScan {
  const result: MediaReferenceScan = { referenced: 0, missing: 0, samples: [] };
  if (!fs.existsSync(dbPath)) return result;
  const present = new Set(fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : []);
  const refs = new Set<string>();
  const db = new Database(dbPath, { readonly: true });
  try {
    for (const { table, column } of MEDIA_COLUMNS) {
      // 表或列还不存在（如尚未上线的 banners）时跳过，不必为体检建迁移
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (!columns.some((c) => c.name === column)) continue;
      const rows = db
        .prepare(`SELECT ${column} AS v FROM ${table} WHERE ${column} LIKE '%/uploads/%'`)
        .all() as Array<{ v: string }>;
      for (const row of rows) {
        const value = String(row.v || '');
        const name = path.basename(value.split('?')[0]);
        if (!name || refs.has(name)) continue;
        refs.add(name);
        if (!present.has(name)) {
          result.missing += 1;
          if (result.samples.length < 5) result.samples.push(value);
        }
      }
    }
  } finally {
    db.close();
  }
  result.referenced = refs.size;
  return result;
}

function backupMeta(): Record<string, any> {
  let version = 'dev';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
    version = String(pkg.version || 'dev');
  } catch {
    /* ignore */
  }
  const media = scanMediaReferences(path.join(dataDir, 'learngrow.db'));
  return {
    created_at: bjtNowString(),
    version,
    database: 'data/learngrow.db',
    uploads: 'uploads/',
    uploads_count: countUploadsOnDisk(),
    db_referenced_uploads: media.referenced,
    missing_on_disk: media.missing,
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

  // 打包前的媒体文件数，作为备份完整性校验基准
  const uploadsBefore = countUploadsOnDisk();

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

  // 3. 校验媒体是否真的进了包：只成功不完整的备份会让人以为有退路
  const uploadsInZip = await countUploadsInZip(filePath);
  if (uploadsInZip < uploadsBefore) {
    throw new Error(
      `备份校验失败：uploads 磁盘上 ${uploadsBefore} 个文件，备份包内仅 ${uploadsInZip} 个（${filePath}）`
    );
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

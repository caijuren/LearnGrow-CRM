/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 从备份 zip 恢复数据库与 uploads 媒体。
 *
 * ⚠️ 重要：恢复前请先停止服务，避免数据库被占用导致恢复失败或数据损坏：
 *   1. ssh 登录服务器后执行：pm2 stop learngrow-crm
 *   2. 在服务器项目目录执行：npm run backup:restore -- /path/to/backup_20260827_033000.zip
 *   3. 恢复完成后：pm2 startOrReload ecosystem.config.cjs --only learngrow-crm
 *
 * 恢复前会自动把当前 data/ 与 uploads/ 另存一份（-before-restore-<时间戳> 后缀），以防误操作。
 * 用法：npm run backup:restore -- <备份文件路径>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const uploadsDir = path.join(projectRoot, 'uploads');

const args = process.argv.slice(2);
const backupPath = args[0];

function bjtTimestamp(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().replace(/[-:]/g, '').replace('T', '').slice(0, 14);
}

async function main() {
  if (!backupPath) {
    console.error('❌ 用法：npm run backup:restore -- <备份文件路径>');
    process.exit(1);
  }
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ 备份文件不存在：${backupPath}`);
    process.exit(1);
  }

  console.log('⚠️  请确认已停止服务（pm2 stop learngrow-crm），否则恢复可能失败！');
  console.log(`📦 使用备份文件：${backupPath}`);

  // 动态导入 adm-zip（无内置类型声明，这里仅用于命令行脚本）
  const { default: AdmZip } = (await import('adm-zip')) as any;
  const zip = new AdmZip(backupPath);

  // 校验 zip 结构
  const entries = zip.getEntries().map((e: any) => e.entryName);
  if (!entries.includes('data/learngrow.db')) {
    console.error('❌ 备份文件缺少 data/learngrow.db，不是有效的备份包');
    process.exit(1);
  }
  const hasUploads = entries.some((e: string) => e.startsWith('uploads/'));

  // 1. 解压到临时目录
  const tmpDir = path.join(projectRoot, '.restore-tmp');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  console.log('📂 解压备份包...');
  zip.extractAllTo(tmpDir, true);

  const suffix = bjtTimestamp();

  // 2. 当前数据另存一份，防止误操作
  const dataBackup = `${dataDir}-before-restore-${suffix}`;
  const uploadsBackup = `${uploadsDir}-before-restore-${suffix}`;
  if (fs.existsSync(dataDir)) {
    fs.cpSync(dataDir, dataBackup, { recursive: true });
    console.log(`🛟 当前数据库已另存：${dataBackup}`);
  }
  if (hasUploads && fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, uploadsBackup, { recursive: true });
    console.log(`🛟 当前媒体目录已另存：${uploadsBackup}`);
  }

  // 3. 还原数据库（同时清掉 WAL/SHM 临时文件）
  fs.rmSync(path.join(dataDir, 'learngrow.db'), { force: true });
  fs.rmSync(path.join(dataDir, 'learngrow.db-wal'), { force: true });
  fs.rmSync(path.join(dataDir, 'learngrow.db-shm'), { force: true });
  fs.copyFileSync(path.join(tmpDir, 'data', 'learngrow.db'), path.join(dataDir, 'learngrow.db'));
  console.log('✅ 数据库已还原：data/learngrow.db');

  // 4. 还原 uploads 媒体
  if (hasUploads) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.cpSync(path.join(tmpDir, 'uploads'), uploadsDir, { recursive: true });
    console.log('✅ 打卡媒体已还原：uploads/');
  }

  // 5. 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log('');
  console.log('🎉 恢复完成！请启动服务：pm2 startOrReload ecosystem.config.cjs --only learngrow-crm');
}

main().catch((err: any) => {
  console.error('❌ 恢复失败：', err.message || err);
  process.exit(1);
});

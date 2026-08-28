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
 * 安全闸门一：若备份包内的媒体文件少于当前 uploads/，脚本会拒绝执行；确认要覆盖时追加 --force：
 *   npm run backup:restore -- backups/backup_20260827_033000.zip --force
 * 安全闸门二：恢复完成后会核对「库里引用的 /uploads 文件是否都在盘上」，有缺失即报错退出；
 *   只需要数据库（媒体本来就不在包里）时追加 --allow-missing-media：
 *   npm run backup:restore -- backups/backup_20260827_033000.zip --allow-missing-media
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanMediaReferences } from '../api/services/backup.js';

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
  const uploadsInZip = entries.filter((e: string) => e.startsWith('uploads/') && !e.endsWith('/')).length;
  const hasUploads = uploadsInZip > 0;

  // 安全闸门：必须在任何写盘动作之前判定，否则会留下「新库 + 旧图」的半恢复状态
  const uploadsOnDisk = fs.existsSync(uploadsDir)
    ? fs.readdirSync(uploadsDir).filter((f) => !f.startsWith('.')).length
    : 0;
  if (hasUploads && uploadsOnDisk > uploadsInZip && !args.includes('--force')) {
    console.error(
      `❌ 备份包内媒体 ${uploadsInZip} 个 < 当前 uploads/ ${uploadsOnDisk} 个，恢复会净删除 ${uploadsOnDisk - uploadsInZip} 个文件。\n` +
        `   本次未改动任何数据。确认要覆盖请追加 --force（届时当前 uploads/ 与 data/ 都会先另存为 *-before-restore-<时间戳>）`
    );
    process.exit(1);
  }

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
  if (fs.existsSync(uploadsDir)) {
    fs.cpSync(uploadsDir, uploadsBackup, { recursive: true });
    console.log(`🛟 当前媒体目录已另存：${uploadsBackup}`);
  }

  // 3. 还原数据库（同时清掉 WAL/SHM 临时文件）
  fs.rmSync(path.join(dataDir, 'learngrow.db'), { force: true });
  fs.rmSync(path.join(dataDir, 'learngrow.db-wal'), { force: true });
  fs.rmSync(path.join(dataDir, 'learngrow.db-shm'), { force: true });
  fs.copyFileSync(path.join(tmpDir, 'data', 'learngrow.db'), path.join(dataDir, 'learngrow.db'));
  console.log('✅ 数据库已还原：data/learngrow.db');

  // 4. 还原 uploads 媒体（数量差异已在解压前拦截）
  if (hasUploads) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.cpSync(path.join(tmpDir, 'uploads'), uploadsDir, { recursive: true });
    console.log('✅ 打卡媒体已还原：uploads/');
  }

  // 5. 清理临时目录
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 6. 库里引用的媒体是否真的在盘上：上面的数量闸门比的是「磁盘 vs 包内」，
  //    遇到「磁盘本来就空 + 包里根本没有媒体」的旧备份会双双为 0 而放行，丢失就此静默发生
  const media = scanMediaReferences(path.join(dataDir, 'learngrow.db'), uploadsDir);
  console.log(`🔎 库中引用 /uploads 文件 ${media.referenced} 个，磁盘缺失 ${media.missing} 个`);
  if (media.missing > 0 && !args.includes('--allow-missing-media')) {
    console.error(
      `❌ 恢复动作已完成，但库里有 ${media.missing} 个媒体文件在磁盘上不存在：\n` +
        `   ${media.samples.join('\n   ')}\n` +
        `   多半是这个备份包不含 uploads 媒体（2026-08-27 21:21 之前的备份都是这样）。\n` +
        `   当前 data/ 与 uploads/ 已另存为 *-before-restore-${suffix}，可按需回退。\n` +
        `   确认可以接受（例如只想要数据库）请追加 --allow-missing-media`
    );
    process.exit(1);
  }

  console.log('');
  console.log('🎉 恢复完成！请启动服务：pm2 startOrReload ecosystem.config.cjs --only learngrow-crm');
}

main().catch((err: any) => {
  console.error('❌ 恢复失败：', err.message || err);
  process.exit(1);
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 手动创建一次完整数据备份（数据库 + uploads 媒体），用于命令行/定时任务。
 * 用法：npm run backup
 */
import { createBackup, listBackups, backupsDir } from '../api/services/backup.js';

async function main() {
  console.log('📦 开始创建备份...');
  const backup = await createBackup();
  const backups = listBackups();
  console.log(`✅ 备份完成：${backup.name}（${(backup.size / 1024 / 1024).toFixed(2)} MB）`);
  console.log(`📁 备份目录：${backupsDir}`);
  console.log(`🗂  当前共 ${backups.length} 份备份，超出保留数量的旧备份已自动清理`);
}

main().catch((err: any) => {
  console.error('❌ 备份失败：', err.message || err);
  process.exit(1);
});

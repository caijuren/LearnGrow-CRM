#!/usr/bin/env node
/**
 * 解密备份文件 - v2.7.0 安全合规加固
 * 
 * 用法: npx tsx scripts/decrypt-backup.ts <加密备份路径> [输出路径]
 * 
 * 示例:
 *   npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc
 *   npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc /tmp/decrypted.zip
 */

import { decryptBackup } from '../api/services/backup-encrypt.js';
import fs from 'fs';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ 用法: npx tsx scripts/decrypt-backup.ts <加密备份路径> [输出路径]');
    console.error('');
    console.error('示例:');
    console.error('  npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc');
    console.error('  npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc /tmp/decrypted.zip');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1];

  // 验证输入文件
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 输入文件不存在: ${inputPath}`);
    process.exit(1);
  }

  console.log('🔓 开始解密备份文件...\n');
  console.log(`输入文件: ${inputPath}`);
  console.log(`输出文件: ${outputPath || '(自动命名)'}`);
  console.log('');

  try {
    const result = await decryptBackup(inputPath, outputPath);

    if (!result.success) {
      console.error('❌ 解密失败:', result.error);
      process.exit(1);
    }

    console.log('');
    console.log('✅ 解密完成！');
    console.log(`输出文件: ${result.encryptedPath}`);
    console.log(`文件大小: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('下一步:');
    console.log(`  npm run backup:restore -- ${result.encryptedPath}`);
  } catch (error) {
    console.error('❌ 解密异常:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();

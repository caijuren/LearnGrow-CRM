#!/usr/bin/env node
/**
 * 测试备份加密功能 - v2.7.0
 * 
 * 用法: npx tsx scripts/test-encryption.ts
 */

import { testEncryption } from '../api/services/backup-encrypt.js';

async function main() {
  console.log('🧪 开始测试备份加密功能...\n');
  
  const success = await testEncryption();
  
  if (success) {
    console.log('\n✅ 所有测试通过！加密功能正常工作。');
    process.exit(0);
  } else {
    console.log('\n❌ 测试失败，请检查配置和代码。');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 测试异常:', error instanceof Error ? error.message : error);
  process.exit(1);
});

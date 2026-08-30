/**
 * 为相关表添加deleted_at字段 - v2.7.0 软删除支持
 * 
 * 用法: npx tsx scripts/add-deleted-at-columns.ts
 */

import db from '../api/db.js';

const TABLES_WITH_DELETED_AT = [
  'wx_users',
  'children', 
  'checkin_participants',
  'checkin_records',
  'orders',
  'follow_ups',
  'points_ledger',
  'checkin_record_likes',
  'checkin_badge_achievements'
];

function addDeletedAtColumn(tableName: string): void {
  try {
    // 检查列是否已存在
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{name: string}>;
    const hasDeletedAt = columns.some(col => col.name === 'deleted_at');
    
    if (hasDeletedAt) {
      console.log(`✅ ${tableName}: deleted_at 字段已存在`);
      return;
    }
    
    // 添加deleted_at字段
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN deleted_at TEXT`);
    console.log(`✅ ${tableName}: 已添加 deleted_at 字段`);
    
    // 为deleted_at创建索引（提高查询性能）
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_deleted_at ON ${tableName}(deleted_at)`);
      console.log(`✅ ${tableName}: 已创建 deleted_at 索引`);
    } catch (indexError) {
      console.warn(`⚠️  ${tableName}: 创建索引失败 - ${(indexError as Error).message}`);
    }
  } catch (error) {
    console.error(`❌ ${tableName}: 添加 deleted_at 字段失败 - ${(error as Error).message}`);
  }
}

function main() {
  console.log('🔧 开始为表添加 deleted_at 字段...\n');
  
  for (const tableName of TABLES_WITH_DELETED_AT) {
    addDeletedAtColumn(tableName);
  }
  
  console.log('\n✅ 所有表的 deleted_at 字段添加完成！');
  console.log('\n提示:');
  console.log('- 软删除: UPDATE table SET deleted_at = datetime("now") WHERE id = ?');
  console.log('- 查询活跃数据: SELECT * FROM table WHERE deleted_at IS NULL');
  console.log('- 永久清除: DELETE FROM table WHERE deleted_at IS NOT NULL');
}

main();

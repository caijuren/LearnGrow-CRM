-- ============================================
-- LearnGrow CRM 生产环境测试数据清理脚本
-- 执行时间: 2026-08-31
-- 备份文件: db_learngrow_20260831_175648.db
-- ============================================

-- 开始事务（确保原子性）
BEGIN TRANSACTION;

-- ============================================
-- 1. 删除测试微信用户（101个）
-- ============================================

-- 1.1 删除昵称为"测试用户"的记录（62个）
DELETE FROM wx_users
WHERE nickname = '测试用户';

-- 1.2 删除昵称为"额外用户X"的记录（39个）
DELETE FROM wx_users
WHERE nickname LIKE '额外用户%';

-- 验证：应该删除 101 个用户
-- SELECT COUNT(*) as deleted_wx_users FROM wx_users WHERE nickname = '测试用户' OR nickname LIKE '额外用户%';

-- ============================================
-- 2. 删除所有孩子档案（62个，全部是测试数据）
-- ============================================

-- 2.1 删除昵称为"测试孩子"的记录
DELETE FROM children
WHERE nickname = '测试孩子';

-- 验证：应该删除 62 个孩子
-- SELECT COUNT(*) as deleted_children FROM children WHERE nickname = '测试孩子';

-- ============================================
-- 3. 清理关联数据（如果有）
-- ============================================

-- 3.1 删除测试用户的打卡记录（如果存在）
-- 注意：由于我们已经删除了 wx_users，这里使用子查询
DELETE FROM checkin_records
WHERE wx_user_id NOT IN (SELECT id FROM wx_users);

-- 3.2 删除测试用户的订单（如果存在）
DELETE FROM orders
WHERE wx_user_id NOT IN (SELECT id FROM wx_users);

-- 3.3 删除测试用户的跟进记录（如果存在）
DELETE FROM follow_ups
WHERE wx_user_id NOT IN (SELECT id FROM wx_users);

-- ============================================
-- 4. 重置自增ID序列（可选）
-- ============================================

-- SQLite 不需要手动重置序列，新插入的记录会自动使用下一个可用ID

-- ============================================
-- 5. 验证清理结果
-- ============================================

-- 查看清理后的数据统计
SELECT '微信用户' as table_name, COUNT(*) as count FROM wx_users
UNION ALL
SELECT '孩子档案', COUNT(*) FROM children
UNION ALL
SELECT '打卡记录', COUNT(*) FROM checkin_records
UNION ALL
SELECT '订单', COUNT(*) FROM orders;

-- 提交事务
COMMIT;

-- 如果出现问题，可以回滚：
-- ROLLBACK;

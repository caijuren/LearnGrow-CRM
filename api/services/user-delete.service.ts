/**
 * 用户数据删除服务 - v2.7.0 安全合规加固
 * 
 * 功能:
 * - 软删除: 标记deleted_at，数据仍保留用于审计
 * - 硬删除: 物理删除所有关联数据（需admin权限）
 * - 级联删除: 自动清理所有关联表的数据
 * - 审计日志: 记录删除操作
 */

import db from '../db.js';
import type { AuthUser } from './auth.js';

export interface DeleteUserResult {
  success: boolean;
  user_id: number;
  hard_delete: boolean;
  cascade_deleted: {
    children: number;
    checkin_participants: number;
    checkin_records: number;
    orders: number;
    follow_ups: number;
    points_ledger: number;
    checkin_likes: number;
    badge_achievements: number;
  };
  error?: string;
}

export interface AuditLogEntry {
  action: 'USER_SOFT_DELETED' | 'USER_HARD_DELETED';
  user_id: number;
  operator_id: number;
  details: string;
}

/**
 * 删除微信用户及其关联数据
 * @param userId 要删除的用户ID
 * @param hardDelete 是否硬删除（默认false为软删除）
 * @param operator 执行操作的管理员
 */
export async function deleteUser(
  userId: number, 
  hardDelete: boolean = false,
  operator: AuthUser
): Promise<DeleteUserResult> {
  const result: DeleteUserResult = {
    success: false,
    user_id: userId,
    hard_delete: hardDelete,
    cascade_deleted: {
      children: 0,
      checkin_participants: 0,
      checkin_records: 0,
      orders: 0,
      follow_ups: 0,
      points_ledger: 0,
      checkin_likes: 0,
      badge_achievements: 0,
    }
  };

  try {
    // 验证用户是否存在
    const user = db.prepare('SELECT id, nickname, child_name FROM wx_users WHERE id = ?').get(userId) as any;
    if (!user) {
      result.error = `用户 ${userId} 不存在`;
      return result;
    }

    if (hardDelete) {
      // 硬删除 - 物理删除所有关联数据
      await hardDeleteUser(userId, result);
      
      // 记录审计日志
      logAudit({
        action: 'USER_HARD_DELETED',
        user_id: userId,
        operator_id: operator.id,
        details: `硬删除用户: ${user.nickname || user.child_name || userId}`
      });
    } else {
      // 软删除 - 标记deleted_at
      await softDeleteUser(userId, result);
      
      // 记录审计日志
      logAudit({
        action: 'USER_SOFT_DELETED',
        user_id: userId,
        operator_id: operator.id,
        details: `软删除用户: ${user.nickname || user.child_name || userId}`
      });
    }

    result.success = true;
    return result;
  } catch (error) {
    console.error(`删除用户 ${userId} 失败:`, error);
    result.error = error instanceof Error ? error.message : '未知错误';
    return result;
  }
}

/**
 * 软删除用户（标记deleted_at）
 */
async function softDeleteUser(userId: number, result: DeleteUserResult): Promise<void> {
  const deleteTimestamp = new Date().toISOString();

  // 使用事务确保原子性
  const transaction = db.transaction(() => {
    // 1. 标记wx_users为已删除
    db.prepare(`
      UPDATE wx_users 
      SET deleted_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(deleteTimestamp, userId);

    // 2. 软删除children表
    const childrenResult = db.prepare(`
      UPDATE children 
      SET deleted_at = ?, updated_at = datetime('now')
      WHERE wx_user_id = ? AND deleted_at IS NULL
    `).run(deleteTimestamp, userId);
    result.cascade_deleted.children = childrenResult.changes;

    // 3. 软删除checkin_participants（通过participant_id关联records）
    const participants = db.prepare(`
      SELECT id FROM checkin_participants 
      WHERE wx_user_id = ?
    `).all(userId) as Array<{id: number}>;

    let totalRecords = 0;
    for (const participant of participants) {
      const recordsResult = db.prepare(`
        UPDATE checkin_records 
        SET deleted_at = ?
        WHERE participant_id = ? AND deleted_at IS NULL
      `).run(deleteTimestamp, participant.id);
      totalRecords += recordsResult.changes;
    }
    result.cascade_deleted.checkin_records = totalRecords;

    const participantsResult = db.prepare(`
      UPDATE checkin_participants 
      SET deleted_at = ?
      WHERE wx_user_id = ? AND deleted_at IS NULL
    `).run(deleteTimestamp, userId);
    result.cascade_deleted.checkin_participants = participantsResult.changes;

    // 4. 软删除orders
    const ordersResult = db.prepare(`
      UPDATE orders 
      SET deleted_at = ?
      WHERE wx_user_id = ? AND deleted_at IS NULL
    `).run(deleteTimestamp, userId);
    result.cascade_deleted.orders = ordersResult.changes;

    // 5. 软删除follow_ups
    const followUpsResult = db.prepare(`
      UPDATE follow_ups 
      SET deleted_at = ?
      WHERE wx_user_id = ? AND deleted_at IS NULL
    `).run(deleteTimestamp, userId);
    result.cascade_deleted.follow_ups = followUpsResult.changes;

    // 6. 软删除points_ledger
    const pointsResult = db.prepare(`
      UPDATE points_ledger 
      SET deleted_at = ?
      WHERE wx_user_id = ? AND deleted_at IS NULL
    `).run(deleteTimestamp, userId);
    result.cascade_deleted.points_ledger = pointsResult.changes;

    // 7. 软删除checkin_record_likes（点赞记录）- 通过record->participant关联
    let totalLikes = 0;
    for (const participant of participants) {
      const likesResult = db.prepare(`
        UPDATE checkin_record_likes 
        SET deleted_at = ?
        WHERE record_id IN (SELECT id FROM checkin_records WHERE participant_id = ?)
          AND deleted_at IS NULL
      `).run(deleteTimestamp, participant.id);
      totalLikes += likesResult.changes;
    }
    result.cascade_deleted.checkin_likes = totalLikes;

    // 8. 软删除badge_achievements（徽章成就）- 通过participant_id关联
    let totalBadges = 0;
    for (const participant of participants) {
      const badgesResult = db.prepare(`
        UPDATE checkin_badge_achievements 
        SET deleted_at = ?
        WHERE participant_id = ? AND deleted_at IS NULL
      `).run(deleteTimestamp, participant.id);
      totalBadges += badgesResult.changes;
    }
    result.cascade_deleted.badge_achievements = totalBadges;
  });

  transaction();
}

/**
 * 硬删除用户（物理删除所有数据）
 */
async function hardDeleteUser(userId: number, result: DeleteUserResult): Promise<void> {
  // 使用事务确保原子性
  const transaction = db.transaction(() => {
    // 删除顺序很重要，需要从子表到父表

    // 1. 获取participants IDs
    const participants = db.prepare(`
      SELECT id FROM checkin_participants 
      WHERE wx_user_id = ?
    `).all(userId) as Array<{id: number}>;

    // 2. 删除checkin_record_likes
    let totalLikes = 0;
    for (const participant of participants) {
      const likesResult = db.prepare(`
        DELETE FROM checkin_record_likes 
        WHERE record_id IN (SELECT id FROM checkin_records WHERE participant_id = ?)
      `).run(participant.id);
      totalLikes += likesResult.changes;
    }
    result.cascade_deleted.checkin_likes = totalLikes;

    // 3. 删除checkin_records
    let totalRecords = 0;
    for (const participant of participants) {
      const recordsResult = db.prepare(`
        DELETE FROM checkin_records 
        WHERE participant_id = ?
      `).run(participant.id);
      totalRecords += recordsResult.changes;
    }
    result.cascade_deleted.checkin_records = totalRecords;

    // 4. 删除checkin_participants
    const participantsResult = db.prepare(`
      DELETE FROM checkin_participants 
      WHERE wx_user_id = ?
    `).run(userId);
    result.cascade_deleted.checkin_participants = participantsResult.changes;

    // 5. 删除badge_achievements
    let totalBadges = 0;
    for (const participant of participants) {
      const badgesResult = db.prepare(`
        DELETE FROM checkin_badge_achievements 
        WHERE participant_id = ?
      `).run(participant.id);
      totalBadges += badgesResult.changes;
    }
    result.cascade_deleted.badge_achievements = totalBadges;

    // 6. 删除points_ledger
    const pointsResult = db.prepare(`
      DELETE FROM points_ledger 
      WHERE wx_user_id = ?
    `).run(userId);
    result.cascade_deleted.points_ledger = pointsResult.changes;

    // 7. 删除orders
    const ordersResult = db.prepare(`
      DELETE FROM orders 
      WHERE wx_user_id = ?
    `).run(userId);
    result.cascade_deleted.orders = ordersResult.changes;

    // 8. 删除follow_ups
    const followUpsResult = db.prepare(`
      DELETE FROM follow_ups 
      WHERE wx_user_id = ?
    `).run(userId);
    result.cascade_deleted.follow_ups = followUpsResult.changes;

    // 9. 删除children
    const childrenResult = db.prepare(`
      DELETE FROM children 
      WHERE wx_user_id = ?
    `).run(userId);
    result.cascade_deleted.children = childrenResult.changes;

    // 10. 最后删除wx_users本身
    db.prepare('DELETE FROM wx_users WHERE id = ?').run(userId);
  });

  transaction();
}

/**
 * 记录审计日志
 */
function logAudit(entry: AuditLogEntry): void {
  try {
    // 检查audit_logs表是否存在（可能还未创建）
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='audit_logs'
    `).get();

    if (!tableExists) {
      // 创建audit_logs表
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          user_id INTEGER,
          operator_id INTEGER,
          details TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_operator ON audit_logs(operator_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      `);
    }

    db.prepare(`
      INSERT INTO audit_logs (action, user_id, operator_id, details, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(entry.action, entry.user_id, entry.operator_id, entry.details);
  } catch (error) {
    console.error('记录审计日志失败:', error);
    // 不抛出异常，避免影响主流程
  }
}

/**
 * 批量软删除用户
 */
export async function batchSoftDeleteUsers(
  userIds: number[],
  operator: AuthUser
): Promise<Array<{ user_id: number; success: boolean; error?: string }>> {
  const results: Array<{ user_id: number; success: boolean; error?: string }> = [];

  for (const userId of userIds) {
    const result = await deleteUser(userId, false, operator);
    results.push({
      user_id: userId,
      success: result.success,
      error: result.error
    });
  }

  return results;
}

/**
 * 获取待清理的软删除用户（超过保留期）
 * @param retentionDays 保留天数（默认90天）
 */
export function getExpiredSoftDeletedUsers(retentionDays: number = 90): Array<{ id: number; nickname: string; deleted_at: string }> {
  return db.prepare(`
    SELECT id, nickname, deleted_at 
    FROM wx_users 
    WHERE deleted_at IS NOT NULL 
      AND deleted_at < datetime('now', ? || ' days')
    ORDER BY deleted_at ASC
  `).all(`-${retentionDays}`) as Array<{ id: number; nickname: string; deleted_at: string }>;
}

/**
 * 永久清除已过期的软删除用户
 * @param retentionDays 保留天数（默认90天）
 */
export async function purgeExpiredSoftDeletedUsers(
  retentionDays: number = 90,
  operator?: AuthUser
): Promise<number> {
  const expiredUsers = getExpiredSoftDeletedUsers(retentionDays);
  let purgedCount = 0;

  for (const user of expiredUsers) {
    try {
      const result = await deleteUser(user.id, true, operator || { id: 0, username: 'system', role: 'admin' } as AuthUser);
      if (result.success) {
        purgedCount++;
      }
    } catch (error) {
      console.error(`清除过期用户 ${user.id} 失败:`, error);
    }
  }

  return purgedCount;
}

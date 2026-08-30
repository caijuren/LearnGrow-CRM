/**
 * Child Service - 孩子档案业务逻辑层
 * 
 * 职责：处理孩子档案的增删改查、学习进度管理
 */

import db from '../db.js';

interface ListChildrenOptions {
  wx_user_id?: number;
}

interface CreateChildData {
  wx_user_id: number;
  nickname: string;
  gender?: 'male' | 'female';
  birth_date?: string;
  grade: string;
  region?: string;
  textbook_version?: string;
  weak_subjects?: string[];
  notes?: string;
}

export function listChildren(options: ListChildrenOptions = {}) {
  const { wx_user_id } = options;
  
  if (!wx_user_id) {
    return [];
  }
  
  return db.prepare('SELECT * FROM children WHERE wx_user_id = ? ORDER BY created_at DESC').all(wx_user_id) as any[];
}

export function getChildById(id: number) {
  const child = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as any;
  if (!child) return null;
  
  // 获取学习进度
  const progressRaw = db.prepare(`
    SELECT cp.*, lp.name as path_name, ls.name as current_stage_name
    FROM child_learning_progress cp
    JOIN learning_paths lp ON cp.path_id = lp.id
    LEFT JOIN learning_stages ls ON cp.current_stage_id = ls.id
    WHERE cp.child_id = ?
    ORDER BY cp.updated_at DESC
  `).all(id) as any[];
  
  // 获取订单
  const ordersRaw = db.prepare(`
    SELECT o.*, p.name as product_name, p.tier as product_tier
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    WHERE o.child_id = ?
    ORDER BY o.purchase_date DESC
  `).all(id) as any[];
  
  // 获取跟进记录
  const followUpsRaw = db.prepare(`
    SELECT * FROM follow_ups WHERE child_id = ? ORDER BY date DESC
  `).all(id) as any[];
  
  return {
    ...child,
    learning_progress: progressRaw,
    orders: ordersRaw,
    follow_ups: followUpsRaw
  };
}

export function createChild(data: CreateChildData) {
  const { 
    wx_user_id, 
    nickname, 
    gender, 
    birth_date, 
    grade, 
    region, 
    textbook_version, 
    weak_subjects = [], 
    notes 
  } = data;
  
  if (!wx_user_id || !nickname || !grade) {
    throw new Error('家长ID、昵称和年级不能为空');
  }
  
  // 验证用户是否存在
  if (!db.prepare('SELECT id FROM wx_users WHERE id = ?').get(wx_user_id)) {
    throw new Error('用户不存在');
  }
  
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const today = now.split(' ')[0];
  
  const r = db.prepare(`
    INSERT INTO children (wx_user_id, nickname, gender, birth_date, grade, grade_as_of, region, textbook_version, weak_subjects, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    wx_user_id, 
    nickname, 
    gender || null, 
    birth_date || null, 
    grade, 
    today, 
    region || null, 
    textbook_version || null, 
    JSON.stringify(weak_subjects), 
    notes || null, 
    now, 
    now
  );
  
  return db.prepare('SELECT * FROM children WHERE id = ?').get(r.lastInsertRowid) as any;
}

export function updateChild(id: number, data: Partial<CreateChildData> & { confirm_grade?: boolean }) {
  const stored = db.prepare('SELECT id, grade FROM children WHERE id = ?').get(id) as any;
  if (!stored) {
    throw new Error('孩子不存在');
  }
  
  const fields: string[] = [];
  const params: any[] = [];
  
  if (data.nickname !== undefined) {
    fields.push('nickname = ?');
    params.push(data.nickname);
  }
  if (data.gender !== undefined) {
    fields.push('gender = ?');
    params.push(data.gender);
  }
  if (data.birth_date !== undefined) {
    fields.push('birth_date = ?');
    params.push(data.birth_date);
  }
  
  // 只在年级真的换过时更新确认日期
  if (data.grade !== undefined && data.grade !== stored.grade) {
    fields.push('grade = ?');
    params.push(data.grade);
    fields.push('grade_as_of = ?');
    params.push(new Date().toISOString().split('T')[0]);
  } else if (data.confirm_grade) {
    fields.push('grade_as_of = ?');
    params.push(new Date().toISOString().split('T')[0]);
  }
  
  if (data.region !== undefined) {
    fields.push('region = ?');
    params.push(data.region);
  }
  if (data.textbook_version !== undefined) {
    fields.push('textbook_version = ?');
    params.push(data.textbook_version);
  }
  if (data.weak_subjects !== undefined) {
    fields.push('weak_subjects = ?');
    params.push(JSON.stringify(data.weak_subjects));
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes);
  }
  
  fields.push("updated_at = datetime('now')");
  params.push(id);
  
  db.prepare(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare('SELECT * FROM children WHERE id = ?').get(id) as any;
}

export function deleteChild(id: number) {
  if (!db.prepare('SELECT id FROM children WHERE id = ?').get(id)) {
    throw new Error('孩子不存在');
  }
  
  // 删除关联的学习进度
  db.prepare('DELETE FROM child_learning_progress WHERE child_id = ?').run(id);
  // 删除孩子档案
  db.prepare('DELETE FROM children WHERE id = ?').run(id);
}

export function addChildProgress(childId: number, pathId: number) {
  if (!db.prepare('SELECT id FROM children WHERE id = ?').get(childId)) {
    throw new Error('孩子不存在');
  }
  if (!db.prepare('SELECT id FROM learning_paths WHERE id = ?').get(pathId)) {
    throw new Error('学习路径不存在');
  }
  
  // 检查是否已存在
  const existing = db.prepare('SELECT id FROM child_learning_progress WHERE child_id = ? AND path_id = ?').get(childId, pathId);
  if (existing) {
    throw new Error('该学习路径已添加');
  }
  
  // 获取第一个阶段
  const firstStage = db.prepare('SELECT id FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC LIMIT 1').get(pathId) as any;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const r = db.prepare(`
    INSERT INTO child_learning_progress (child_id, path_id, current_stage_id, status, start_date, updated_at)
    VALUES (?, ?, ?, 'in_progress', date('now'), ?)
  `).run(childId, pathId, firstStage?.id || null, now);
  
  return db.prepare('SELECT * FROM child_learning_progress WHERE id = ?').get(r.lastInsertRowid) as any;
}

export function advanceChildProgress(childId: number, progressId: number, data: { completed_date?: string; notes?: string; next_stage_id?: number }) {
  const progress = db.prepare('SELECT * FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId) as any;
  if (!progress) {
    throw new Error('进度记录不存在');
  }
  
  let nextStageId = data.next_stage_id;
  let status = progress.status;
  
  // 自动计算下一个阶段
  if (nextStageId === undefined && progress.current_stage_id) {
    const stages = db.prepare('SELECT id, order_index FROM learning_stages WHERE path_id = ? ORDER BY order_index ASC').all(progress.path_id) as any[];
    const currentIdx = stages.findIndex(s => s.id === progress.current_stage_id);
    
    if (currentIdx >= 0 && currentIdx < stages.length - 1) {
      nextStageId = stages[currentIdx + 1].id;
    } else {
      nextStageId = null;
      status = 'completed';
    }
  }
  
  const fields: string[] = [];
  const params: any[] = [];
  
  if (data.completed_date !== undefined) {
    fields.push('completed_date = ?');
    params.push(data.completed_date);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes);
  }
  
  fields.push('current_stage_id = ?');
  params.push(nextStageId || null);
  fields.push('status = ?');
  params.push(status);
  fields.push("updated_at = datetime('now')");
  params.push(progressId);
  
  db.prepare(`UPDATE child_learning_progress SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare('SELECT * FROM child_learning_progress WHERE id = ?').get(progressId) as any;
}

export function deleteChildProgress(childId: number, progressId: number) {
  if (!db.prepare('SELECT id FROM child_learning_progress WHERE id = ? AND child_id = ?').get(progressId, childId)) {
    throw new Error('进度记录不存在');
  }
  
  db.prepare('DELETE FROM child_learning_progress WHERE id = ?').run(progressId);
}

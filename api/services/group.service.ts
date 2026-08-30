/**
 * Group Service - 微信群组业务逻辑层
 * 
 * 职责：处理微信群组的增删改查、成员管理
 */

import db from '../db.js';

interface ListGroupsOptions {
  status?: string;
  search?: string;
}

interface CreateGroupData {
  name: string;
  purpose?: string;
  description?: string;
  member_count?: number;
  status?: 'active' | 'inactive';
  tags?: string[];
  group_rules?: string;
  owner_note?: string;
  notes?: string;
}

export function listGroups(options: ListGroupsOptions = {}) {
  const { status, search } = options;
  
  let sql = 'SELECT * FROM wechat_groups WHERE 1=1';
  const params: any[] = [];
  
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR purpose LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  sql += ' ORDER BY created_at DESC';
  
  const groups = db.prepare(sql).all(...params) as any[];
  
  return { groups, total: groups.length };
}

export function getGroupById(id: number) {
  const g = db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(id);
  if (!g) return null;
  
  const members = db.prepare('SELECT * FROM wechat_group_members WHERE group_id = ? ORDER BY activity_score DESC, created_at DESC').all(id) as any[];
  
  return {
    ...g,
    active_members: members
  };
}

export function createGroup(data: CreateGroupData) {
  const { 
    name, 
    purpose, 
    description, 
    member_count = 0, 
    status = 'active', 
    tags = [], 
    group_rules, 
    owner_note, 
    notes 
  } = data;
  
  if (!name) {
    throw new Error('群名称不能为空');
  }
  
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const r = db.prepare(`
    INSERT INTO wechat_groups (name, purpose, description, member_count, status, tags, group_rules, owner_note, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, 
    purpose || null, 
    description || null, 
    member_count, 
    status, 
    JSON.stringify(tags), 
    group_rules || null, 
    owner_note || null, 
    notes || null, 
    now, 
    now
  );
  
  return db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(r.lastInsertRowid) as any;
}

export function updateGroup(id: number, data: Partial<CreateGroupData>) {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) {
    throw new Error('群不存在');
  }
  
  const fields: string[] = [];
  const params: any[] = [];
  
  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.purpose !== undefined) {
    fields.push('purpose = ?');
    params.push(data.purpose);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    params.push(data.description);
  }
  if (data.member_count !== undefined) {
    fields.push('member_count = ?');
    params.push(data.member_count);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
  }
  if (data.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }
  if (data.group_rules !== undefined) {
    fields.push('group_rules = ?');
    params.push(data.group_rules);
  }
  if (data.owner_note !== undefined) {
    fields.push('owner_note = ?');
    params.push(data.owner_note);
  }
  if (data.notes !== undefined) {
    fields.push('notes = ?');
    params.push(data.notes);
  }
  
  fields.push("updated_at = datetime('now')");
  params.push(id);
  
  db.prepare(`UPDATE wechat_groups SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare('SELECT * FROM wechat_groups WHERE id = ?').get(id) as any;
}

export function deleteGroup(id: number) {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(id)) {
    throw new Error('群不存在');
  }
  
  // 删除群成员
  db.prepare('DELETE FROM wechat_group_members WHERE group_id = ?').run(id);
  // 删除群
  db.prepare('DELETE FROM wechat_groups WHERE id = ?').run(id);
}

export function batchImportMembers(groupId: number, names: string[], role: string = 'new') {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) {
    throw new Error('群不存在');
  }
  
  if (!names || !Array.isArray(names) || names.length === 0) {
    throw new Error('请输入要导入的昵称列表');
  }
  
  const insertMember = db.prepare(`
    INSERT OR IGNORE INTO wechat_group_members (group_id, wechat_name, role, tags, activity_score)
    VALUES (?, ?, ?, '[]', 50)
  `);
  
  let added = 0;
  let skipped = 0;
  
  const insertMany = db.transaction(() => {
    for (const name of names) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        skipped++;
        continue;
      }
      
      const existing = db.prepare('SELECT id FROM wechat_group_members WHERE group_id = ? AND wechat_name = ?').get(groupId, trimmed);
      if (existing) {
        skipped++;
        continue;
      }
      
      insertMember.run(groupId, trimmed, role);
      added++;
    }
  });
  
  insertMany();
  
  // 更新群成员数量
  db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
  
  return { added, skipped, total: names.length };
}

export function addGroupMember(groupId: number, data: { wechat_name: string; nickname?: string; role?: string; tags?: string[]; wx_user_id?: number; activity_score?: number; remark?: string }) {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) {
    throw new Error('群不存在');
  }
  
  const { wechat_name, nickname, role = 'active', tags = [], wx_user_id, activity_score = 50, remark } = data;
  
  if (!wechat_name) {
    throw new Error('微信昵称不能为空');
  }
  
  const r = db.prepare(`
    INSERT INTO wechat_group_members (group_id, wechat_name, nickname, role, tags, wx_user_id, activity_score, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    groupId, 
    wechat_name, 
    nickname || null, 
    role, 
    JSON.stringify(tags), 
    wx_user_id || null, 
    activity_score, 
    remark || null
  );
  
  // 更新群成员数量
  db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
  
  return db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(r.lastInsertRowid) as any;
}

export function updateGroupMember(groupId: number, memberId: number, data: Partial<{ wechat_name: string; nickname: string; role: string; tags: string[]; wx_user_id: number; activity_score: number; remark: string }>) {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) {
    throw new Error('群不存在');
  }
  if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) {
    throw new Error('成员不存在');
  }
  
  const fields: string[] = [];
  const params: any[] = [];
  
  if (data.wechat_name !== undefined) {
    fields.push('wechat_name = ?');
    params.push(data.wechat_name);
  }
  if (data.nickname !== undefined) {
    fields.push('nickname = ?');
    params.push(data.nickname);
  }
  if (data.role !== undefined) {
    fields.push('role = ?');
    params.push(data.role);
  }
  if (data.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }
  if (data.wx_user_id !== undefined) {
    fields.push('wx_user_id = ?');
    params.push(data.wx_user_id);
  }
  if (data.activity_score !== undefined) {
    fields.push('activity_score = ?');
    params.push(data.activity_score);
  }
  if (data.remark !== undefined) {
    fields.push('remark = ?');
    params.push(data.remark);
  }
  
  params.push(memberId);
  
  db.prepare(`UPDATE wechat_group_members SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  
  return db.prepare('SELECT * FROM wechat_group_members WHERE id = ?').get(memberId) as any;
}

export function deleteGroupMember(groupId: number, memberId: number) {
  if (!db.prepare('SELECT id FROM wechat_groups WHERE id = ?').get(groupId)) {
    throw new Error('群不存在');
  }
  if (!db.prepare('SELECT id FROM wechat_group_members WHERE id = ? AND group_id = ?').get(memberId, groupId)) {
    throw new Error('成员不存在');
  }
  
  db.prepare('DELETE FROM wechat_group_members WHERE id = ?').run(memberId);
  
  // 更新群成员数量
  db.prepare("UPDATE wechat_groups SET updated_at = datetime('now'), member_count = (SELECT COUNT(*) FROM wechat_group_members WHERE group_id = ?) WHERE id = ?").run(groupId, groupId);
}

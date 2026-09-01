/* eslint-disable @typescript-eslint/no-explicit-any */
import type { WxUser, WxUserFacets, Product, Order, FollowUp, DashboardData, TodoItem, LiveCustomerCard, WxUser360, CustomerSuggestion, WechatGroup, WechatGroupMember, Child, ChildPatch, ChildWithProgress, Textbook, LearningPath, LearningStage, ChildLearningProgress, CheckinEvent, CheckinEventDetail, CheckinParticipant, CheckinRecord, Material, PointsLedgerItem, PointsConfig } from '../../shared/types';

const API_BASE = '/api';

function getToken() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || '请求失败');
  }
  return data.data;
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: { id: number; username: string; role: string; display_name?: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchCurrentUser() {
  return request<{ id: number; username: string; role: string; display_name?: string }>('/auth/me');
}

export async function fetchDashboard() {
  return request<DashboardData>('/dashboard');
}

export async function fetchTodos() {
  return request<TodoItem[]>('/actions/todos');
}

export async function fetchWxUsers(params: { search?: string; importance?: string; stage?: string; need_follow?: string; tag?: string; sort?: string; dir?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.importance) qs.set('importance', params.importance);
  if (params.stage) qs.set('stage', params.stage);
  if (params.need_follow) qs.set('need_follow', params.need_follow);
  if (params.tag) qs.set('tag', params.tag);
  if (params.sort) qs.set('sort', params.sort);
  if (params.dir) qs.set('dir', params.dir);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ users: WxUser[]; total: number; facets: WxUserFacets }>(`/wx-users?${qs.toString()}`);
}

export async function fetchAllTags() {
  return request<string[]>('/wx-users/all-tags');
}

export async function fetchWxUser(id: number) {
  return request<WxUser360>(`/wx-users/${id}`);
}

export async function createWxUser(data: Partial<WxUser>) {
  return request<WxUser>('/wx-users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateWxUser(id: number, data: Partial<WxUser>) {
  return request<WxUser>(`/wx-users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteWxUser(id: number) {
  return request<null>(`/wx-users/${id}`, { method: 'DELETE' });
}

export async function updateWxUserTags(id: number, tags: string[]) {
  return request<WxUser>(`/wx-users/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tags }) });
}

export async function updateWxUserImportance(id: number, importance: string) {
  return request<WxUser>(`/wx-users/${id}/importance`, { method: 'PUT', body: JSON.stringify({ importance }) });
}

export async function createFollowUp(wxUserId: number, data: Partial<FollowUp>) {
  return request<FollowUp>(`/wx-users/${wxUserId}/follow-ups`, { method: 'POST', body: JSON.stringify(data) });
}

export async function createOrder(wxUserId: number, data: Partial<Order>) {
  return request<Order>(`/wx-users/${wxUserId}/orders`, { method: 'POST', body: JSON.stringify(data) });
}

export async function fetchWxUserSuggestions(id: number) {
  return request<CustomerSuggestion[]>(`/wx-users/${id}/suggestions`);
}

export async function fetchProducts(params: { tier?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.tier) qs.set('tier', params.tier);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ products: Product[]; total: number }>(`/products?${qs.toString()}`);
}

export async function fetchAllProducts() {
  return request<Product[]>('/products/all');
}

export async function createProduct(data: Partial<Product>) {
  return request<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateProduct(id: number, data: Partial<Product>) {
  return request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteProduct(id: number) {
  return request<null>(`/products/${id}`, { method: 'DELETE' });
}

export async function fetchOrders(params: { wx_user_id?: number; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.wx_user_id) qs.set('wx_user_id', String(params.wx_user_id));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ orders: (Order & { wx_user_name: string; product_name: string; product_tier: string; child_name?: string | null })[]; total: number }>(`/orders?${qs.toString()}`);
}

export async function deleteOrder(id: number) {
  return request<null>(`/orders/${id}`, { method: 'DELETE' });
}

export async function fetchFollowUps(wxUserId: number) {
  return request<FollowUp[]>(`/follow-ups/wx-user/${wxUserId}`);
}

export async function updateFollowUp(id: number, data: Partial<FollowUp>) {
  return request<FollowUp>(`/follow-ups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteFollowUp(id: number) {
  return request<null>(`/follow-ups/${id}`, { method: 'DELETE' });
}

export async function fetchUsers() {
  return request<{ id: number; username: string; role: 'admin' | 'assistant'; display_name?: string; created_at: string }[]>('/users');
}

export async function createUser(data: { username: string; password: string; role: string; display_name?: string }) {
  return request('/users', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateUser(id: number, data: { password?: string; role?: string; display_name?: string }) {
  return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteUser(id: number) {
  return request<null>(`/users/${id}`, { method: 'DELETE' });
}

export async function liveSearch(q: string) {
  return request<LiveCustomerCard[]>(`/live/search?q=${encodeURIComponent(q)}`);
}

export async function liveQuickNote(wx_user_id: number, content: string, child_id?: number | null) {
  return request<FollowUp>('/live/quick-note', { method: 'POST', body: JSON.stringify({ wx_user_id, content, child_id: child_id || null }) });
}

export async function fetchGroups(params: { status?: string; search?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return request<{ groups: WechatGroup[] }>(`/wechat-groups?${qs.toString()}`);
}

export async function fetchGroup(id: number) {
  return request<WechatGroup>(`/wechat-groups/${id}`);
}

export async function createGroup(data: Partial<WechatGroup>) {
  return request<WechatGroup>('/wechat-groups', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateGroup(id: number, data: Partial<WechatGroup>) {
  return request<WechatGroup>(`/wechat-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteGroup(id: number) {
  return request<null>(`/wechat-groups/${id}`, { method: 'DELETE' });
}

export async function addGroupMember(groupId: number, data: Partial<WechatGroupMember>) {
  return request<WechatGroupMember>(`/wechat-groups/${groupId}/members`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateGroupMember(groupId: number, memberId: number, data: Partial<WechatGroupMember>) {
  return request<WechatGroupMember>(`/wechat-groups/${groupId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteGroupMember(groupId: number, memberId: number) {
  return request<null>(`/wechat-groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
}

export async function batchAddGroupMembers(groupId: number, names: string[], role: string = 'new') {
  return request<{ added: number; skipped: number; total: number }>(`/wechat-groups/${groupId}/members/batch`, {
    method: 'POST',
    body: JSON.stringify({ names, role }),
  });
}

export async function fetchChildren(wxUserId: number) {
  return request<Child[]>(`/children?wx_user_id=${wxUserId}`);
}

export async function fetchChild(id: number) {
  return request<ChildWithProgress>(`/children/${id}`);
}

export async function createChild(data: Partial<Child> & { wx_user_id: number }) {
  return request<Child>('/children', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateChild(id: number, data: ChildPatch) {
  return request<Child>(`/children/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteChild(id: number) {
  return request<null>(`/children/${id}`, { method: 'DELETE' });
}

export async function addChildProgress(childId: number, path_id: number) {
  return request<ChildLearningProgress>(`/children/${childId}/progress`, { method: 'POST', body: JSON.stringify({ path_id }) });
}

export async function advanceChildProgress(childId: number, progressId: number, data: { completed_date?: string; notes?: string; next_stage_id?: number | null }) {
  return request<ChildLearningProgress>(`/children/${childId}/progress/${progressId}/advance`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteChildProgress(childId: number, progressId: number) {
  return request<null>(`/children/${childId}/progress/${progressId}`, { method: 'DELETE' });
}

export async function fetchLearningPaths(params: { subject?: string; is_active?: boolean } = {}) {
  const qs = new URLSearchParams();
  if (params.subject) qs.set('subject', params.subject);
  if (params.is_active !== undefined) qs.set('is_active', String(params.is_active));
  return request<LearningPath[]>(`/learning-paths?${qs.toString()}`);
}

export async function createLearningPath(data: Omit<Partial<LearningPath>, 'stages'> & { name: string; subject: string; stages?: Partial<LearningStage>[] }) {
  return request<LearningPath>('/learning-paths', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLearningPath(id: number, data: Omit<Partial<LearningPath>, 'stages'> & { stages?: Partial<LearningStage>[] }) {
  return request<LearningPath>(`/learning-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteLearningPath(id: number) {
  return request<null>(`/learning-paths/${id}`, { method: 'DELETE' });
}

export async function fetchTextbooks(params: { region?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.region) qs.set('region', params.region);
  return request<Textbook[]>(`/textbooks?${qs.toString()}`);
}

export async function fetchTextbookRegions() {
  return request<string[]>('/textbooks/regions');
}

export async function fetchCheckinEvents(params: { status?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  return request<{ events: CheckinEvent[]; total: number }>(`/checkin-events?${qs.toString()}`);
}

export async function fetchCheckinEvent(id: number) {
  return request<CheckinEventDetail>(`/checkin-events/${id}`);
}

export async function createCheckinEvent(data: Partial<CheckinEvent> & { name: string; start_date: string; end_date: string }) {
  return request<CheckinEvent>('/checkin-events', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCheckinEvent(id: number, data: Partial<CheckinEvent>) {
  return request<CheckinEvent>(`/checkin-events/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCheckinEvent(id: number) {
  return request<null>(`/checkin-events/${id}`, { method: 'DELETE' });
}

export async function fetchDeletedCheckinEvents() {
  return request<{ events: CheckinEvent[]; total: number }>('/checkin-events/deleted');
}

export async function restoreCheckinEvent(id: number) {
  return request<CheckinEvent>(`/checkin-events/${id}/restore`, { method: 'PUT' });
}

export async function permanentlyDeleteCheckinEvent(id: number) {
  return request<null>(`/checkin-events/${id}/permanent`, { method: 'DELETE' });
}

export async function addCheckinParticipant(eventId: number, data: Partial<CheckinParticipant> & { nickname: string }) {
  return request<CheckinParticipant>(`/checkin-events/${eventId}/participants`, { method: 'POST', body: JSON.stringify(data) });
}

export async function removeCheckinParticipant(eventId: number, participantId: number) {
  return request<null>(`/checkin-events/${eventId}/participants/${participantId}`, { method: 'DELETE' });
}

export async function checkin(eventId: number, participant_id: number, checkin_date: string, note?: string) {
  return request<CheckinRecord>(`/checkin-events/${eventId}/checkin`, { method: 'POST', body: JSON.stringify({ participant_id, checkin_date, note: note || null }) });
}

export async function uncheckin(eventId: number, recordId: number) {
  return request<null>(`/checkin-events/${eventId}/checkin/${recordId}`, { method: 'DELETE' });
}

export async function batchCheckin(eventId: number, checkin_date: string, participant_ids: number[], note?: string) {
  return request<{ checked_count: number }>(`/checkin-events/${eventId}/batch-checkin`, { method: 'POST', body: JSON.stringify({ checkin_date, participant_ids, note: note || null }) });
}

export async function fetchMaterials(params: { category?: string; search?: string; product_id?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  if (params.product_id) qs.set('product_id', String(params.product_id));
  return request<Material[]>(`/materials?${qs.toString()}`);
}

export async function uploadMaterial(file: File, data: { category: string; description?: string; tags?: string[]; product_id?: number | null }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', data.category);
  if (data.description) formData.append('description', data.description);
  if (data.tags) formData.append('tags', JSON.stringify(data.tags));
  if (data.product_id) formData.append('product_id', String(data.product_id));
  const token = getToken();
  const res = await fetch(`${API_BASE}/materials/upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  const resData = await res.json();
  if (!res.ok || resData.success === false) throw new Error(resData.error || '上传失败');
  return resData.data as Material;
}

export async function updateMaterial(id: number, data: Partial<Material>) {
  return request<Material>(`/materials/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteMaterial(id: number) {
  return request<null>(`/materials/${id}`, { method: 'DELETE' });
}

export async function recordMaterialDownload(id: number) {
  return request<{ download_count: number }>(`/materials/${id}/download`, { method: 'POST' });
}

// ========== 打卡管理新接口 ==========

export async function fetchCheckinRecords(eventId: number, params: { status?: string; record_type?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.record_type) qs.set('record_type', params.record_type);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ records: any[]; total: number }>(`/checkin-events/${eventId}/records?${qs.toString()}`);
}

export async function reviewCheckinRecord(eventId: number, recordId: number, status: 'approved' | 'rejected', review_note?: string) {
  return request<any>(`/checkin-events/${eventId}/records/${recordId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, review_note })
  });
}

export async function fetchEventBadges(eventId: number) {
  return request<any[]>(`/checkin-events/${eventId}/badges`);
}

export async function createEventBadge(eventId: number, data: { name: string; description?: string; icon?: string; type: string; target_days: number }) {
  return request<any>(`/checkin-events/${eventId}/badges`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEventBadge(eventId: number, badgeId: number, data: Partial<{ name: string; description: string; icon: string; type: string; target_days: number }>) {
  return request<any>(`/checkin-events/${eventId}/badges/${badgeId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEventBadge(eventId: number, badgeId: number) {
  return request<{ deleted: boolean }>(`/checkin-events/${eventId}/badges/${badgeId}`, { method: 'DELETE' });
}

export async function fetchEventMaterials(eventId: number) {
  return request<any[]>(`/checkin-events/${eventId}/materials-manage`);
}

export async function createEventMaterial(eventId: number, data: { title: string; description?: string; file_url?: string; file_type?: string; sort_order?: number; is_active?: boolean }) {
  return request<any>(`/checkin-events/${eventId}/materials`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEventMaterial(eventId: number, materialId: number, data: Partial<{ title: string; description: string; file_url: string; file_type: string; sort_order: number; is_active: boolean }>) {
  return request<any>(`/checkin-events/${eventId}/materials/${materialId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteEventMaterial(eventId: number, materialId: number) {
  return request<{ deleted: boolean }>(`/checkin-events/${eventId}/materials/${materialId}`, { method: 'DELETE' });
}

export async function fetchEventRewards(eventId: number, params: { status?: string; search?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  return request<any[]>(`/checkin-events/${eventId}/rewards?${qs.toString()}`);
}

export async function distributeReward(eventId: number, participantId: number, reward_note?: string) {
  return request<any>(`/checkin-events/${eventId}/rewards/${participantId}/distribute`, {
    method: 'POST',
    body: JSON.stringify({ reward_note })
  });
}

export function getExportUrl(eventId: number) {
  const token = getToken();
  return `/api/checkin-events/${eventId}/export?token=${token}`;
}

// ========== 数据备份 ==========

export interface BackupFileInfo {
  name: string;
  size: number;
  createdAt: string;
}

export async function fetchBackups() {
  return request<BackupFileInfo[]>('/admin/backups');
}

export async function createBackup() {
  return request<BackupFileInfo>('/admin/backup', { method: 'POST' });
}

export async function downloadBackup(name: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/admin/backup/download?name=${encodeURIComponent(name)}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || '下载失败');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ========== 微信用户与积分 ==========

export async function adjustWxUserPoints(id: number, amount: number, note?: string) {
  return request<{ new_balance: number }>(`/wx-users/${id}/points`, { method: 'POST', body: JSON.stringify({ amount, note }) });
}

export async function fetchWxUserPoints(id: number, params: { page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ items: PointsLedgerItem[]; total: number; balance: number }>(`/wx-users/${id}/points?${qs.toString()}`);
}

export async function fetchPointsConfig() {
  return request<PointsConfig>('/settings/points');
}

export async function updatePointsConfig(data: Partial<PointsConfig>) {
  return request<PointsConfig>('/settings/points', { method: 'PUT', body: JSON.stringify(data) });
}

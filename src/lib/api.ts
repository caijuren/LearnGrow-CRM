import type { Customer, Product, Order, FollowUp, DashboardData, TodoItem, LiveCustomerCard, Customer360, CustomerSuggestion, WechatGroup, WechatGroupMember, Child, ChildWithProgress, Textbook, LearningPath, LearningStage, ChildLearningProgress } from '../../shared/types';

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

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

export async function fetchCustomers(params: { search?: string; importance?: string; tag?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.importance) qs.set('importance', params.importance);
  if (params.tag) qs.set('tag', params.tag);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ customers: Customer[]; total: number }>(`/customers?${qs.toString()}`);
}

export async function fetchAllTags() {
  return request<string[]>('/customers/all-tags');
}

export async function fetchCustomer(id: number) {
  return request<Customer360>(`/customers/${id}`);
}

export async function createCustomer(data: Partial<Customer>) {
  return request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCustomer(id: number, data: Partial<Customer>) {
  return request<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCustomer(id: number) {
  return request<null>(`/customers/${id}`, { method: 'DELETE' });
}

export async function updateCustomerTags(id: number, tags: string[]) {
  return request<Customer>(`/customers/${id}/tags`, { method: 'PUT', body: JSON.stringify({ tags }) });
}

export async function updateCustomerImportance(id: number, importance: string) {
  return request<Customer>(`/customers/${id}/importance`, { method: 'PUT', body: JSON.stringify({ importance }) });
}

export async function createFollowUp(customerId: number, data: Partial<FollowUp>) {
  return request<FollowUp>(`/customers/${customerId}/follow-ups`, { method: 'POST', body: JSON.stringify(data) });
}

export async function createOrder(customerId: number, data: Partial<Order>) {
  return request<Order>(`/customers/${customerId}/orders`, { method: 'POST', body: JSON.stringify(data) });
}

export async function fetchCustomerSuggestions(id: number) {
  return request<CustomerSuggestion[]>(`/customers/${id}/suggestions`);
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

export async function fetchOrders(params: { customer_id?: number; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.customer_id) qs.set('customer_id', String(params.customer_id));
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  return request<{ orders: (Order & { customer_name: string; product_name: string; product_tier: string; child_name?: string | null })[]; total: number }>(`/orders?${qs.toString()}`);
}

export async function deleteOrder(id: number) {
  return request<null>(`/orders/${id}`, { method: 'DELETE' });
}

export async function fetchFollowUps(customerId: number) {
  return request<FollowUp[]>(`/follow-ups/customer/${customerId}`);
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

export async function liveQuickNote(customer_id: number, content: string, child_id?: number | null) {
  return request<FollowUp>('/live/quick-note', { method: 'POST', body: JSON.stringify({ customer_id, content, child_id: child_id || null }) });
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

export async function fetchChildren(customerId: number) {
  return request<Child[]>(`/children?customer_id=${customerId}`);
}

export async function fetchChild(id: number) {
  return request<ChildWithProgress>(`/children/${id}`);
}

export async function createChild(data: Partial<Child> & { customer_id: number }) {
  return request<Child>('/children', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateChild(id: number, data: Partial<Child>) {
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

export async function createLearningPath(data: Partial<LearningPath> & { name: string; subject: string; stages?: Partial<LearningStage>[] }) {
  return request<LearningPath>('/learning-paths', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateLearningPath(id: number, data: Partial<LearningPath> & { stages?: Partial<LearningStage>[] }) {
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

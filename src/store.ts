import { create } from 'zustand';
import type { Customer, Product, Order, FollowUp, DashboardData, TodoItem, LiveCustomerCard, Customer360, WechatGroup, WechatGroupMember, Child, ChildWithProgress, LearningPath, Textbook } from '../shared/types';
import * as api from './lib/api';

interface AppState {
  token: string | null;
  currentUser: { id: number; username: string; role: string; display_name?: string } | null;
  isAuthenticated: boolean;

  dashboard: DashboardData | null;
  customers: Customer[];
  totalCustomers: number;
  customerPage: number;
  selectedCustomer: Customer360 | null;
  customerFilters: { search?: string; importance?: string; tag?: string };
  allTags: string[];

  products: Product[];
  totalProducts: number;
  productTier: string | null;
  allProducts: Product[];

  orders: (Order & { customer_name: string; product_name: string; product_tier: string; child_name?: string | null })[];
  totalOrders: number;

  selectedChild: ChildWithProgress | null;
  learningPaths: LearningPath[];
  textbooks: Textbook[];
  textbookRegions: string[];

  todos: TodoItem[];

  liveSearchResults: LiveCustomerCard[];

  users: { id: number; username: string; role: 'admin' | 'assistant'; display_name?: string; created_at: string }[];

  groups: WechatGroup[];
  selectedGroup: WechatGroup | null;
  groupFilters: { status?: string; search?: string };

  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadCurrentUser: () => Promise<void>;
  restoreAuth: () => void;

  loadDashboard: () => Promise<void>;
  loadTodos: () => Promise<void>;

  loadCustomers: (params?: { search?: string; importance?: string; tag?: string; page?: number; limit?: number }) => Promise<void>;
  loadCustomer: (id: number) => Promise<void>;
  addCustomer: (data: Partial<Customer>) => Promise<void>;
  editCustomer: (id: number, data: Partial<Customer>) => Promise<void>;
  removeCustomer: (id: number) => Promise<void>;
  editCustomerTags: (id: number, tags: string[]) => Promise<void>;
  editCustomerImportance: (id: number, importance: string) => Promise<void>;
  setCustomerFilters: (filters: Partial<AppState['customerFilters']>) => void;
  clearSelectedCustomer: () => void;

  addFollowUp: (customerId: number, data: Partial<FollowUp>) => Promise<void>;
  removeFollowUp: (id: number, customerId: number) => Promise<void>;
  addOrder: (customerId: number, data: Partial<Order>) => Promise<void>;

  loadChild: (id: number) => Promise<void>;
  addChild: (data: Partial<Child> & { customer_id: number }) => Promise<void>;
  editChild: (id: number, data: Partial<Child>) => Promise<void>;
  removeChild: (id: number, customerId: number) => Promise<void>;
  addChildProgress: (childId: number, pathId: number) => Promise<void>;
  advanceProgress: (childId: number, progressId: number, data: { completed_date?: string; notes?: string; next_stage_id?: number | null }) => Promise<void>;
  clearSelectedChild: () => void;

  loadLearningPaths: (params?: { subject?: string; is_active?: boolean }) => Promise<void>;
  addLearningPath: (data: Partial<LearningPath> & { name: string; subject: string; stages?: any[] }) => Promise<void>;
  editLearningPath: (id: number, data: Partial<LearningPath> & { stages?: any[] }) => Promise<void>;
  removeLearningPath: (id: number) => Promise<void>;

  loadTextbooks: (params?: { region?: string }) => Promise<void>;
  loadTextbookRegions: () => Promise<void>;

  loadProducts: (params?: { tier?: string; page?: number; limit?: number }) => Promise<void>;
  addProduct: (data: Partial<Product>) => Promise<void>;
  editProduct: (id: number, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  setProductTier: (tier: string | null) => void;

  loadOrders: (params?: { customer_id?: number; page?: number; limit?: number }) => Promise<void>;
  removeOrder: (id: number) => Promise<void>;

  liveSearch: (q: string) => Promise<void>;
  liveQuickNote: (customer_id: number, content: string, child_id?: number | null) => Promise<void>;

  loadUsers: () => Promise<void>;
  addUser: (data: { username: string; password: string; role: string; display_name?: string }) => Promise<void>;
  editUser: (id: number, data: { password?: string; role?: string; display_name?: string }) => Promise<void>;
  removeUser: (id: number) => Promise<void>;

  loadGroups: (params?: { status?: string; search?: string }) => Promise<void>;
  loadGroup: (id: number) => Promise<void>;
  addGroup: (data: Partial<WechatGroup>) => Promise<void>;
  editGroup: (id: number, data: Partial<WechatGroup>) => Promise<void>;
  removeGroup: (id: number) => Promise<void>;
  setGroupFilters: (filters: Partial<AppState['groupFilters']>) => void;
  clearSelectedGroup: () => void;

  addGroupMember: (groupId: number, data: Partial<WechatGroupMember>) => Promise<void>;
  editGroupMember: (groupId: number, memberId: number, data: Partial<WechatGroupMember>) => Promise<void>;
  removeGroupMember: (groupId: number, memberId: number) => Promise<void>;

  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('token'),
  currentUser: null,
  isAuthenticated: !!localStorage.getItem('token'),
  dashboard: null,
  customers: [],
  totalCustomers: 0,
  customerPage: 1,
  selectedCustomer: null,
  customerFilters: {},
  allTags: [],
  products: [],
  totalProducts: 0,
  productTier: null,
  allProducts: [],
  orders: [],
  totalOrders: 0,
  selectedChild: null,
  learningPaths: [],
  textbooks: [],
  textbookRegions: [],
  todos: [],
  liveSearchResults: [],
  users: [],
  groups: [],
  selectedGroup: null,
  groupFilters: {},
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login(username, password);
      localStorage.setItem('token', data.token);
      set({ token: data.token, currentUser: data.user, isAuthenticated: true, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
      throw e;
    }
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, currentUser: null, isAuthenticated: false });
  },
  loadCurrentUser: async () => {
    try {
      const user = await api.fetchCurrentUser();
      set({ currentUser: user });
    } catch (e) {
      localStorage.removeItem('token');
      set({ token: null, currentUser: null, isAuthenticated: false });
    }
  },
  restoreAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true });
      get().loadCurrentUser();
    }
  },

  loadDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchDashboard();
      set({ dashboard: data, todos: data.todos, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  loadTodos: async () => {
    try {
      const todos = await api.fetchTodos();
      set({ todos });
    } catch (e: any) { set({ error: e.message }); }
  },

  loadCustomers: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = { ...get().customerFilters, ...params };
      const data = await api.fetchCustomers({ ...filters, limit: 50 });
      set({ customers: data.customers, totalCustomers: data.total, customerPage: params?.page || 1, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  loadCustomer: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchCustomer(id);
      set({ selectedCustomer: data, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  addCustomer: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createCustomer(data);
      await get().loadCustomers({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editCustomer: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateCustomer(id, data);
      await get().loadCustomer(id);
      await get().loadCustomers({ page: get().customerPage });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeCustomer: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteCustomer(id);
      await get().loadCustomers({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  editCustomerTags: async (id, tags) => {
    try {
      await api.updateCustomerTags(id, tags);
      await get().loadCustomer(id);
      await get().loadCustomers({ page: get().customerPage });
    } catch (e: any) { set({ error: e.message }); }
  },
  editCustomerImportance: async (id, importance) => {
    try {
      await api.updateCustomerImportance(id, importance);
      await get().loadCustomer(id);
      await get().loadCustomers({ page: get().customerPage });
    } catch (e: any) { set({ error: e.message }); }
  },
  setCustomerFilters: (filters) => {
    set({ customerFilters: { ...get().customerFilters, ...filters } });
    get().loadCustomers({ page: 1 });
  },
  clearSelectedCustomer: () => set({ selectedCustomer: null }),

  addFollowUp: async (customerId, data) => {
    set({ loading: true, error: null });
    try {
      await api.createFollowUp(customerId, data);
      await get().loadCustomer(customerId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeFollowUp: async (id, customerId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteFollowUp(id);
      await get().loadCustomer(customerId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  addOrder: async (customerId, data) => {
    set({ loading: true, error: null });
    try {
      await api.createOrder(customerId, data);
      await get().loadCustomer(customerId);
      await get().loadDashboard();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },

  loadProducts: async (params) => {
    set({ loading: true, error: null });
    try {
      const tier = params?.tier ?? get().productTier ?? undefined;
      const data = await api.fetchProducts({ ...params, tier, limit: 100 });
      set({ products: data.products, totalProducts: data.total, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  addProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createProduct(data);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editProduct: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateProduct(id, data);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  deleteProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteProduct(id);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  setProductTier: (tier) => {
    set({ productTier: tier });
    get().loadProducts({ tier: tier ?? undefined, page: 1 });
  },

  loadOrders: async (params) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchOrders({ ...params, limit: 50 });
      set({ orders: data.orders, totalOrders: data.total, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  removeOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteOrder(id);
      await get().loadOrders({ page: 1 });
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  liveSearch: async (q) => {
    if (!q || q.length < 1) { set({ liveSearchResults: [] }); return; }
    try {
      const results = await api.liveSearch(q);
      set({ liveSearchResults: results });
    } catch (e: any) { set({ error: e.message }); }
  },
  liveQuickNote: async (customer_id, content, child_id) => {
    try {
      await api.liveQuickNote(customer_id, content, child_id);
      await get().liveSearch('');
    } catch (e: any) { set({ error: e.message }); throw e; }
  },

  loadUsers: async () => {
    set({ loading: true, error: null });
    try {
      const users = await api.fetchUsers();
      set({ users, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  addUser: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createUser(data);
      await get().loadUsers();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editUser: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateUser(id, data);
      await get().loadUsers();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteUser(id);
      await get().loadUsers();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadGroups: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = { ...get().groupFilters, ...params };
      const data = await api.fetchGroups(filters);
      set({ groups: data.groups, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  loadGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchGroup(id);
      set({ selectedGroup: data, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  addGroup: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createGroup(data);
      await get().loadGroups();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editGroup: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateGroup(id, data);
      await get().loadGroup(id);
      await get().loadGroups();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteGroup(id);
      await get().loadGroups();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  setGroupFilters: (filters) => {
    set({ groupFilters: { ...get().groupFilters, ...filters } });
    get().loadGroups();
  },
  clearSelectedGroup: () => set({ selectedGroup: null }),

  addGroupMember: async (groupId, data) => {
    set({ loading: true, error: null });
    try {
      await api.addGroupMember(groupId, data);
      await get().loadGroup(groupId);
      await get().loadGroups();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editGroupMember: async (groupId, memberId, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateGroupMember(groupId, memberId, data);
      await get().loadGroup(groupId);
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeGroupMember: async (groupId, memberId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteGroupMember(groupId, memberId);
      await get().loadGroup(groupId);
      await get().loadGroups();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadChild: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchChild(id);
      set({ selectedChild: data, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  clearSelectedChild: () => set({ selectedChild: null }),
  addChild: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createChild(data);
      await get().loadCustomer(data.customer_id);
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editChild: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateChild(id, data);
      const child = get().selectedChild;
      if (child) await get().loadChild(id);
      if (child) await get().loadCustomer(child.customer_id);
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeChild: async (id, customerId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteChild(id);
      await get().loadCustomer(customerId);
      set({ selectedChild: null, loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },
  addChildProgress: async (childId, pathId) => {
    set({ loading: true, error: null });
    try {
      await api.addChildProgress(childId, pathId);
      await get().loadChild(childId);
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  advanceProgress: async (childId, progressId, data) => {
    set({ loading: true, error: null });
    try {
      await api.advanceChildProgress(childId, progressId, data);
      await get().loadChild(childId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },

  loadLearningPaths: async (params) => {
    try {
      const data = await api.fetchLearningPaths(params);
      set({ learningPaths: data });
    } catch (e: any) { set({ error: e.message }); }
  },
  addLearningPath: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createLearningPath(data);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  editLearningPath: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateLearningPath(id, data);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); throw e; }
  },
  removeLearningPath: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteLearningPath(id);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e: any) { set({ error: e.message, loading: false }); }
  },

  loadTextbooks: async (params) => {
    try {
      const data = await api.fetchTextbooks(params);
      set({ textbooks: data });
    } catch (e: any) { set({ error: e.message }); }
  },
  loadTextbookRegions: async () => {
    try {
      const data = await api.fetchTextbookRegions();
      set({ textbookRegions: data });
    } catch (e: any) { set({ error: e.message }); }
  },

  clearError: () => set({ error: null }),
}));

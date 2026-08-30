import { create } from 'zustand';
import type { WxUser, WxUserFacets, Product, Order, FollowUp, DashboardData, TodoItem, LiveCustomerCard, WxUser360, WechatGroup, WechatGroupMember, Child, ChildPatch, ChildWithProgress, LearningPath, LearningStage, Textbook, CheckinEvent, CheckinEventDetail, Material, PointsLedgerItem, PointsConfig } from '../shared/types';
import * as api from './lib/api';

export const WX_USERS_PAGE_SIZE = 50;

interface AppState {
  token: string | null;
  currentUser: { id: number; username: string; role: string; display_name?: string } | null;
  isAuthenticated: boolean;

  dashboard: DashboardData | null;
  wxUsers: WxUser[];
  totalWxUsers: number;
  wxUserPage: number;
  selectedWxUser: WxUser360 | null;
  wxUserFilters: { search?: string; importance?: string; stage?: string; need_follow?: string; tag?: string; sort?: string; dir?: string };
  wxUserFacets: WxUserFacets | null;
  allTags: string[];

  products: Product[];
  totalProducts: number;
  productTier: string | null;
  allProducts: Product[];

  orders: (Order & { wx_user_name: string; product_name: string; product_tier: string; child_name?: string | null })[];
  totalOrders: number;

  selectedChild: ChildWithProgress | null;
  learningPaths: LearningPath[];
  textbooks: Textbook[];
  textbookRegions: string[];

  todos: TodoItem[];

  liveSearchResults: LiveCustomerCard[];

  users: { id: number; username: string; role: 'admin' | 'assistant'; display_name?: string; created_at: string }[];

  wxUserPoints: PointsLedgerItem[];
  wxUserPointsTotal: number;
  pointsConfig: PointsConfig | null;

  groups: WechatGroup[];
  selectedGroup: WechatGroup | null;
  groupFilters: { status?: string; search?: string };

  checkinEvents: CheckinEvent[];
  deletedCheckinEvents: CheckinEvent[];
  selectedCheckinEvent: CheckinEventDetail | null;
  checkinFilter: { status?: string };

  materials: Material[];
  materialCategory: string;
  materialSearch: string;

  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadCurrentUser: () => Promise<void>;
  restoreAuth: () => void;

  loadDashboard: () => Promise<void>;
  loadTodos: () => Promise<void>;

  loadWxUsers: (params?: { search?: string; importance?: string; stage?: string; need_follow?: string; tag?: string; sort?: string; dir?: string; page?: number; limit?: number }) => Promise<void>;
  loadWxUser: (id: number) => Promise<void>;
  addWxUser: (data: Partial<WxUser>) => Promise<void>;
  editWxUser: (id: number, data: Partial<WxUser>) => Promise<void>;
  removeWxUser: (id: number) => Promise<void>;
  editWxUserTags: (id: number, tags: string[]) => Promise<void>;
  editWxUserImportance: (id: number, importance: string) => Promise<void>;
  setWxUserFilters: (filters: Partial<AppState['wxUserFilters']>) => void;
  clearSelectedWxUser: () => void;

  addFollowUp: (wxUserId: number, data: Partial<FollowUp>) => Promise<void>;
  removeFollowUp: (id: number, wxUserId: number) => Promise<void>;
  addOrder: (wxUserId: number, data: Partial<Order>) => Promise<void>;

  loadChild: (id: number) => Promise<void>;
  addChild: (data: Partial<Child> & { wx_user_id: number }) => Promise<void>;
  editChild: (id: number, data: ChildPatch) => Promise<void>;
  removeChild: (id: number, wxUserId: number) => Promise<void>;
  addChildProgress: (childId: number, pathId: number) => Promise<void>;
  advanceProgress: (childId: number, progressId: number, data: { completed_date?: string; notes?: string; next_stage_id?: number | null }) => Promise<void>;
  clearSelectedChild: () => void;

  loadLearningPaths: (params?: { subject?: string; is_active?: boolean }) => Promise<void>;
  addLearningPath: (data: Omit<Partial<LearningPath>, 'stages'> & { name: string; subject: string; stages?: Partial<LearningStage>[] }) => Promise<void>;
  editLearningPath: (id: number, data: Omit<Partial<LearningPath>, 'stages'> & { stages?: Partial<LearningStage>[] }) => Promise<void>;
  removeLearningPath: (id: number) => Promise<void>;

  loadTextbooks: (params?: { region?: string }) => Promise<void>;
  loadTextbookRegions: () => Promise<void>;

  loadProducts: (params?: { tier?: string; page?: number; limit?: number }) => Promise<void>;
  addProduct: (data: Partial<Product>) => Promise<void>;
  editProduct: (id: number, data: Partial<Product>) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  setProductTier: (tier: string | null) => void;

  loadOrders: (params?: { wx_user_id?: number; page?: number; limit?: number }) => Promise<void>;
  removeOrder: (id: number) => Promise<void>;

  liveSearch: (q: string) => Promise<void>;
  liveQuickNote: (wx_user_id: number, content: string, child_id?: number | null) => Promise<void>;

  loadUsers: () => Promise<void>;
  addUser: (data: { username: string; password: string; role: string; display_name?: string }) => Promise<void>;
  editUser: (id: number, data: { password?: string; role?: string; display_name?: string }) => Promise<void>;
  removeUser: (id: number) => Promise<void>;

  adjustWxUserPoints: (id: number, amount: number, note?: string) => Promise<void>;
  loadWxUserPoints: (id: number, params?: { page?: number; limit?: number }) => Promise<void>;
  loadPointsConfig: () => Promise<void>;
  updatePointsConfig: (data: Partial<PointsConfig>) => Promise<void>;

  loadGroups: (params?: { status?: string; search?: string }) => Promise<void>;
  loadGroup: (id: number) => Promise<void>;
  addGroup: (data: Partial<WechatGroup>) => Promise<void>;
  editGroup: (id: number, data: Partial<WechatGroup>) => Promise<void>;
  removeGroup: (id: number) => Promise<void>;
  setGroupFilters: (filters: Partial<AppState['groupFilters']>) => void;
  clearSelectedGroup: () => void;

  addGroupMember: (groupId: number, data: Partial<WechatGroupMember>) => Promise<void>;
  batchAddGroupMembers: (groupId: number, names: string[], role?: string) => Promise<{ added: number; skipped: number; total: number }>;
  editGroupMember: (groupId: number, memberId: number, data: Partial<WechatGroupMember>) => Promise<void>;
  removeGroupMember: (groupId: number, memberId: number) => Promise<void>;

  loadCheckinEvents: (params?: { status?: string }) => Promise<void>;
  loadCheckinEvent: (id: number) => Promise<void>;
  addCheckinEvent: (data: Partial<CheckinEvent> & { name: string; start_date: string; end_date: string }) => Promise<void>;
  editCheckinEvent: (id: number, data: Partial<CheckinEvent>) => Promise<void>;
  removeCheckinEvent: (id: number) => Promise<void>;
  loadDeletedCheckinEvents: () => Promise<void>;
  restoreCheckinEvent: (id: number) => Promise<void>;
  permanentlyDeleteCheckinEvent: (id: number) => Promise<void>;
  setCheckinFilter: (filter: Partial<AppState['checkinFilter']>) => void;
  clearSelectedCheckinEvent: () => void;

  addCheckinParticipant: (eventId: number, data: { nickname: string; child_name?: string; member_id?: number; wx_user_id?: number }) => Promise<void>;
  removeCheckinParticipant: (eventId: number, participantId: number) => Promise<void>;
  doCheckin: (eventId: number, participantId: number, date: string, note?: string) => Promise<void>;
  doUncheckin: (eventId: number, recordId: number) => Promise<void>;
  doBatchCheckin: (eventId: number, date: string, participantIds: number[], note?: string) => Promise<void>;

  loadMaterials: (params?: { category?: string; search?: string; product_id?: number }) => Promise<void>;
  uploadMaterial: (file: File, data: { category: string; description?: string; tags?: string[]; product_id?: number | null }) => Promise<void>;
  editMaterial: (id: number, data: Partial<Material>) => Promise<void>;
  removeMaterial: (id: number) => Promise<void>;
  recordMaterialDownload: (id: number) => Promise<void>;
  setMaterialCategory: (category: string) => void;
  setMaterialSearch: (search: string) => void;

  clearError: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  token: localStorage.getItem('token'),
  currentUser: null,
  isAuthenticated: !!localStorage.getItem('token'),
  dashboard: null,
  wxUsers: [],
  totalWxUsers: 0,
  wxUserPage: 1,
  selectedWxUser: null,
  wxUserFilters: {},
  wxUserFacets: null,
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
  wxUserPoints: [],
  wxUserPointsTotal: 0,
  pointsConfig: null,
  groups: [],
  selectedGroup: null,
  groupFilters: {},
  checkinEvents: [],
  deletedCheckinEvents: [],
  selectedCheckinEvent: null,
  checkinFilter: {},
  materials: [],
  materialCategory: 'all',
  materialSearch: '',
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const data = await api.login(username, password);
      localStorage.setItem('token', data.token);
      set({ token: data.token, currentUser: data.user, isAuthenticated: true, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
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
    } catch {
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
      set({ dashboard: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadTodos: async () => {
    try {
      const todos = await api.fetchTodos();
      set({ todos });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  loadWxUsers: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = { ...get().wxUserFilters, ...params };
      const data = await api.fetchWxUsers({ ...filters, limit: WX_USERS_PAGE_SIZE });
      set({ wxUsers: data.users, totalWxUsers: data.total, wxUserFacets: data.facets ?? null, wxUserPage: params?.page || 1, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadWxUser: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchWxUser(id);
      set({ selectedWxUser: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addWxUser: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createWxUser(data);
      await get().loadWxUsers({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editWxUser: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateWxUser(id, data);
      await get().loadWxUser(id);
      await get().loadWxUsers({ page: get().wxUserPage });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeWxUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteWxUser(id);
      await get().loadWxUsers({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  editWxUserTags: async (id, tags) => {
    try {
      await api.updateWxUserTags(id, tags);
      await get().loadWxUser(id);
      await get().loadWxUsers({ page: get().wxUserPage });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  editWxUserImportance: async (id, importance) => {
    try {
      await api.updateWxUserImportance(id, importance);
      await get().loadWxUser(id);
      await get().loadWxUsers({ page: get().wxUserPage });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  setWxUserFilters: (filters) => {
    set({ wxUserFilters: { ...get().wxUserFilters, ...filters } });
    get().loadWxUsers({ page: 1 });
  },
  clearSelectedWxUser: () => set({ selectedWxUser: null }),

  addFollowUp: async (wxUserId, data) => {
    set({ loading: true, error: null });
    try {
      await api.createFollowUp(wxUserId, data);
      await get().loadWxUser(wxUserId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeFollowUp: async (id, wxUserId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteFollowUp(id);
      await get().loadWxUser(wxUserId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  addOrder: async (wxUserId, data) => {
    set({ loading: true, error: null });
    try {
      await api.createOrder(wxUserId, data);
      await get().loadWxUser(wxUserId);
      await get().loadDashboard();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },

  loadProducts: async (params) => {
    set({ loading: true, error: null });
    try {
      const tier = params?.tier ?? get().productTier ?? undefined;
      const data = await api.fetchProducts({ ...params, tier, limit: 100 });
      set({ products: data.products, totalProducts: data.total, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createProduct(data);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editProduct: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateProduct(id, data);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  deleteProduct: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteProduct(id);
      await get().loadProducts({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
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
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  removeOrder: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteOrder(id);
      await get().loadOrders({ page: 1 });
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },

  liveSearch: async (q) => {
    if (!q || q.length < 1) { set({ liveSearchResults: [] }); return; }
    try {
      const results = await api.liveSearch(q);
      set({ liveSearchResults: results });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  liveQuickNote: async (wx_user_id, content, child_id) => {
    try {
      await api.liveQuickNote(wx_user_id, content, child_id);
      await get().liveSearch('');
    } catch (e) { set({ error: (e as Error).message }); throw e; }
  },

  loadUsers: async () => {
    set({ loading: true, error: null });
    try {
      const users = await api.fetchUsers();
      set({ users, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addUser: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createUser(data);
      await get().loadUsers();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editUser: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateUser(id, data);
      await get().loadUsers();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeUser: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteUser(id);
      await get().loadUsers();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },

  adjustWxUserPoints: async (id, amount, note) => {
    set({ loading: true, error: null });
    try {
      await api.adjustWxUserPoints(id, amount, note);
      await get().loadWxUsers();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  loadWxUserPoints: async (id, params) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchWxUserPoints(id, params);
      set({ wxUserPoints: data.items, wxUserPointsTotal: data.total, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadPointsConfig: async () => {
    try {
      const data = await api.fetchPointsConfig();
      set({ pointsConfig: data });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  updatePointsConfig: async (data) => {
    try {
      const updated = await api.updatePointsConfig(data);
      set({ pointsConfig: updated });
    } catch (e) { set({ error: (e as Error).message }); throw e; }
  },

  loadGroups: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = { ...get().groupFilters, ...params };
      const data = await api.fetchGroups(filters);
      set({ groups: data.groups, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchGroup(id);
      set({ selectedGroup: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addGroup: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createGroup(data);
      await get().loadGroups();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editGroup: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateGroup(id, data);
      await get().loadGroup(id);
      await get().loadGroups();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeGroup: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteGroup(id);
      await get().loadGroups();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
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
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  batchAddGroupMembers: async (groupId, names, role = 'new') => {
    set({ loading: true, error: null });
    try {
      const result = await api.batchAddGroupMembers(groupId, names, role);
      await get().loadGroup(groupId);
      await get().loadGroups();
      set({ loading: false });
      return result;
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editGroupMember: async (groupId, memberId, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateGroupMember(groupId, memberId, data);
      await get().loadGroup(groupId);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeGroupMember: async (groupId, memberId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteGroupMember(groupId, memberId);
      await get().loadGroup(groupId);
      await get().loadGroups();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },

  loadChild: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchChild(id);
      set({ selectedChild: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  clearSelectedChild: () => set({ selectedChild: null }),
  addChild: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createChild(data);
      await get().loadWxUser(data.wx_user_id);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editChild: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateChild(id, data);
      const child = get().selectedChild;
      if (child) await get().loadChild(id);
      if (child) await get().loadWxUser(child.wx_user_id);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeChild: async (id, wxUserId) => {
    set({ loading: true, error: null });
    try {
      await api.deleteChild(id);
      await get().loadWxUser(wxUserId);
      set({ selectedChild: null, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addChildProgress: async (childId, pathId) => {
    set({ loading: true, error: null });
    try {
      await api.addChildProgress(childId, pathId);
      await get().loadChild(childId);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  advanceProgress: async (childId, progressId, data) => {
    set({ loading: true, error: null });
    try {
      await api.advanceChildProgress(childId, progressId, data);
      await get().loadChild(childId);
      await get().loadTodos();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },

  loadLearningPaths: async (params) => {
    try {
      const data = await api.fetchLearningPaths(params);
      set({ learningPaths: data });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  addLearningPath: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createLearningPath(data);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editLearningPath: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateLearningPath(id, data);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeLearningPath: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteLearningPath(id);
      await get().loadLearningPaths();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },

  loadTextbooks: async (params) => {
    try {
      const data = await api.fetchTextbooks(params);
      set({ textbooks: data });
    } catch (e) { set({ error: (e as Error).message }); }
  },
  loadTextbookRegions: async () => {
    try {
      const data = await api.fetchTextbookRegions();
      set({ textbookRegions: data });
    } catch (e) { set({ error: (e as Error).message }); }
  },

  loadCheckinEvents: async (params) => {
    set({ loading: true, error: null });
    try {
      const filters = { ...get().checkinFilter, ...params };
      const data = await api.fetchCheckinEvents(filters);
      set({ checkinEvents: data.events, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadCheckinEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchCheckinEvent(id);
      set({ selectedCheckinEvent: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  addCheckinEvent: async (data) => {
    set({ loading: true, error: null });
    try {
      await api.createCheckinEvent(data);
      await get().loadCheckinEvents();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editCheckinEvent: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateCheckinEvent(id, data);
      await get().loadCheckinEvent(id);
      await get().loadCheckinEvents();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeCheckinEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteCheckinEvent(id);
      await get().loadCheckinEvents();
      set({ selectedCheckinEvent: null, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  loadDeletedCheckinEvents: async () => {
    set({ loading: true, error: null });
    try {
      const data = await api.fetchDeletedCheckinEvents();
      set({ deletedCheckinEvents: data.events, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  restoreCheckinEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.restoreCheckinEvent(id);
      await get().loadDeletedCheckinEvents();
      await get().loadCheckinEvents();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  permanentlyDeleteCheckinEvent: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.permanentlyDeleteCheckinEvent(id);
      await get().loadDeletedCheckinEvents();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  setCheckinFilter: (filter) => {
    set({ checkinFilter: { ...get().checkinFilter, ...filter } });
    get().loadCheckinEvents();
  },
  clearSelectedCheckinEvent: () => set({ selectedCheckinEvent: null }),

  addCheckinParticipant: async (eventId, data) => {
    set({ loading: true, error: null });
    try {
      await api.addCheckinParticipant(eventId, data);
      await get().loadCheckinEvent(eventId);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeCheckinParticipant: async (eventId, participantId) => {
    set({ loading: true, error: null });
    try {
      await api.removeCheckinParticipant(eventId, participantId);
      await get().loadCheckinEvent(eventId);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  doCheckin: async (eventId, participantId, date, note) => {
    try {
      await api.checkin(eventId, participantId, date, note);
      await get().loadCheckinEvent(eventId);
    } catch (e) { set({ error: (e as Error).message }); throw e; }
  },
  doUncheckin: async (eventId, recordId) => {
    try {
      await api.uncheckin(eventId, recordId);
      await get().loadCheckinEvent(eventId);
    } catch (e) { set({ error: (e as Error).message }); throw e; }
  },
  doBatchCheckin: async (eventId, date, participantIds, note) => {
    set({ loading: true, error: null });
    try {
      await api.batchCheckin(eventId, date, participantIds, note);
      await get().loadCheckinEvent(eventId);
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },

  loadMaterials: async (params) => {
    set({ loading: true, error: null });
    try {
      const category = params?.category ?? get().materialCategory;
      const search = params?.search ?? get().materialSearch;
      const data = await api.fetchMaterials({ category: category === 'all' ? undefined : category, search, product_id: params?.product_id });
      set({ materials: data, loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  uploadMaterial: async (file, data) => {
    set({ loading: true, error: null });
    try {
      await api.uploadMaterial(file, data);
      await get().loadMaterials();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  editMaterial: async (id, data) => {
    set({ loading: true, error: null });
    try {
      await api.updateMaterial(id, data);
      await get().loadMaterials();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); throw e; }
  },
  removeMaterial: async (id) => {
    set({ loading: true, error: null });
    try {
      await api.deleteMaterial(id);
      await get().loadMaterials();
      set({ loading: false });
    } catch (e) { set({ error: (e as Error).message, loading: false }); }
  },
  recordMaterialDownload: async (id) => {
    try {
      const result = await api.recordMaterialDownload(id);
      set({ materials: get().materials.map(m => m.id === id ? { ...m, download_count: result.download_count } : m) });
    } catch { /* silent */ }
  },
  setMaterialCategory: (category) => {
    set({ materialCategory: category });
    get().loadMaterials({ category });
  },
  setMaterialSearch: (search) => {
    set({ materialSearch: search });
  },

  clearError: () => set({ error: null }),
}));

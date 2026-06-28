export type Importance = 'vip' | 'normal' | 'watch';
export type ProductTier = 'traffic' | 'main' | 'premium';
export type OrderType = 'first' | 'repurchase' | 'upsell';
export type FollowUpMethod = 'wechat' | 'phone' | 'group' | 'live' | 'moments';
export type FollowUpResult = 'closed' | 'considering' | 'no_need' | 'follow_up';
export type TodoType = 'vip_follow' | 'reminder' | 'considering' | 'long_time_no_talk' | 'stage_progress';
export type TodoPriority = 'high' | 'medium' | 'low';
export type CustomerSource = 'douyin_live' | 'douyin_dm' | 'referral' | 'wechat_group' | 'moments' | 'other';
export type CustomerStage = 'new_friend' | 'initial_chat' | 'interested' | 'purchased' | 'in_group' | 'repurchased' | 'silent';
export type WechatAccount = 'main' | 'assistant';
export type ProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'paused';

export interface Child {
  id: number;
  customer_id: number;
  nickname: string;
  gender: 'boy' | 'girl' | null;
  birth_date: string | null;
  grade: string;
  region: string | null;
  textbook_version: string | null;
  weak_subjects: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Textbook {
  id: number;
  region: string;
  subject: string;
  grade: string;
  version: string;
  publisher: string | null;
  is_default: boolean;
  notes: string | null;
  created_at: string;
}

export interface LearningPath {
  id: number;
  name: string;
  subject: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stages?: LearningStage[];
}

export interface LearningStage {
  id: number;
  path_id: number;
  order_index: number;
  name: string;
  description: string | null;
  duration_days: number | null;
  target_product_ids: number[];
  key_milestones: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChildLearningProgress {
  id: number;
  child_id: number;
  path_id: number;
  current_stage_id: number | null;
  status: ProgressStatus;
  start_date: string | null;
  completed_date: string | null;
  notes: string | null;
  updated_at: string;
  path?: LearningPath;
  current_stage?: LearningStage | null;
  target_products?: Product[];
  next_stage?: LearningStage | null;
}

export interface ChildWithProgress extends Child {
  learning_progress: ChildLearningProgress[];
  orders: OrderWithProduct[];
  follow_ups: FollowUp[];
}

export interface Customer {
  id: number;
  name: string;
  nickname: string | null;
  phone: string | null;
  wechat_id: string | null;
  wechat_remark: string | null;
  wechat_add_date: string | null;
  wechat_account: WechatAccount;
  douyin_nickname: string | null;
  avatar: string | null;
  source: CustomerSource | null;
  stage: CustomerStage;
  importance: Importance;
  tags: string[];
  remark: string | null;
  next_talk_topic: string | null;
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  last_follow_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  name: string;
  tier: ProductTier;
  category: string | null;
  price: number;
  commission_percent: number;
  image_url: string | null;
  selling_points: string | null;
  related_product_ids: number[];
  is_on_sale: boolean;
  sales_count: number;
  description: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_no: string;
  customer_id: number;
  child_id: number | null;
  product_id: number;
  amount: number;
  order_type: OrderType;
  remark: string | null;
  shipping_note: string | null;
  purchase_date: string;
  created_at: string;
}

export interface FollowUp {
  id: number;
  customer_id: number;
  child_id: number | null;
  child_name?: string | null;
  date: string;
  method: FollowUpMethod;
  content: string;
  result: FollowUpResult | null;
  next_follow_date: string | null;
  is_live_note: boolean;
  created_at: string;
}

export interface TodoItem {
  id: string;
  type: TodoType;
  priority: TodoPriority;
  customer_id: number;
  customer_name: string;
  child_id?: number;
  child_name?: string;
  title: string;
  description: string;
  due_date?: string;
  product_id?: number;
  product_name?: string;
  suggested_script?: string;
  follow_up_id?: number;
  stage_id?: number;
  path_id?: number;
  path_name?: string;
  stage_name?: string;
}

export interface CustomerSuggestion {
  type: string;
  title: string;
  reason: string;
  product?: Product;
  script: string;
}

export interface Customer360 {
  id: number;
  name: string;
  nickname: string | null;
  phone: string | null;
  wechat_id: string | null;
  wechat_remark: string | null;
  wechat_add_date: string | null;
  wechat_account: WechatAccount;
  douyin_nickname: string | null;
  avatar: string | null;
  source: CustomerSource | null;
  stage: CustomerStage;
  importance: Importance;
  tags: string[];
  remark: string | null;
  next_talk_topic: string | null;
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  last_follow_date: string | null;
  created_at: string;
  children: Child[];
  orders: OrderWithProduct[];
  follow_ups: FollowUp[];
  suggestions: CustomerSuggestion[];
}

export interface OrderWithProduct extends Order {
  product_name: string;
  product_tier: ProductTier;
  child_name?: string | null;
}

export interface LiveCustomerCard {
  id: number;
  name: string;
  nickname: string | null;
  avatar: string | null;
  importance: Importance;
  tags: string[];
  total_spent: number;
  order_count: number;
  last_order_date: string | null;
  last_follow_date: string | null;
  recent_orders: { product_name: string; purchase_date: string; amount: number }[];
  recent_follow_up: { content: string; date: string } | null;
  suggestions: CustomerSuggestion[];
  children?: { id: number; nickname: string; grade: string }[];
}

export interface DashboardData {
  stats: {
    today_revenue: number;
    month_revenue: number;
    total_customers: number;
    today_new_customers: number;
    pending_todos: number;
    need_follow_count: number;
    new_friends_count: number;
    silent_count: number;
  };
  stageStats: { stage: CustomerStage; count: number }[];
  needFollowCustomers: Pick<Customer, 'id' | 'name' | 'stage' | 'wechat_id' | 'wechat_account' | 'last_follow_date' | 'next_talk_topic' | 'importance'>[];
  revenueTrend: { date: string; revenue: number }[];
  todos: TodoItem[];
  recentOrders: OrderWithCustomer[];
}

export interface OrderWithCustomer extends Order {
  customer_name: string;
  product_name: string;
}

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  vip: '⭐重点',
  normal: '普通',
  watch: '观察中',
};

export const IMPORTANCE_COLORS: Record<Importance, string> = {
  vip: 'bg-amber-100 text-amber-700 border-amber-200',
  normal: 'bg-slate-100 text-slate-600 border-slate-200',
  watch: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const PRODUCT_TIER_LABELS: Record<ProductTier, string> = {
  traffic: '引流款',
  main: '主力款',
  premium: '高价款',
};

export const PRODUCT_TIER_COLORS: Record<ProductTier, string> = {
  traffic: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  main: 'bg-blue-100 text-blue-700 border-blue-200',
  premium: 'bg-purple-100 text-purple-700 border-purple-200',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  first: '首单',
  repurchase: '复购',
  upsell: '升单',
};

export const ORDER_TYPE_COLORS: Record<OrderType, string> = {
  first: 'bg-sky-100 text-sky-700',
  repurchase: 'bg-green-100 text-green-700',
  upsell: 'bg-orange-100 text-orange-700',
};

export const FOLLOW_UP_METHOD_LABELS: Record<FollowUpMethod, string> = {
  wechat: '微信私聊',
  phone: '电话',
  group: '群聊',
  live: '直播间',
  moments: '朋友圈',
};

export const FOLLOW_UP_RESULT_LABELS: Record<FollowUpResult, string> = {
  closed: '已成交',
  considering: '考虑中',
  no_need: '无需求',
  follow_up: '待跟进',
};

export const SOURCE_LABELS: Record<CustomerSource, string> = {
  douyin_live: '抖音直播',
  douyin_dm: '抖音私信',
  referral: '转介绍',
  wechat_group: '微信群',
  moments: '朋友圈',
  other: '其他',
};

export const STAGE_LABELS: Record<CustomerStage, string> = {
  new_friend: '新好友',
  initial_chat: '初步沟通',
  interested: '意向客户',
  purchased: '已成交',
  in_group: '已进群',
  repurchased: '复购客户',
  silent: '沉默客户',
};

export const STAGE_COLORS: Record<CustomerStage, string> = {
  new_friend: 'bg-blue-100 text-blue-700',
  initial_chat: 'bg-sky-100 text-sky-700',
  interested: 'bg-amber-100 text-amber-700',
  purchased: 'bg-emerald-100 text-emerald-700',
  in_group: 'bg-teal-100 text-teal-700',
  repurchased: 'bg-rose-100 text-rose-700',
  silent: 'bg-slate-100 text-slate-500',
};

export const WECHAT_ACCOUNT_LABELS: Record<WechatAccount, string> = {
  main: '主播号',
  assistant: '助理号',
};

export const TODO_TYPE_LABELS: Record<TodoType, string> = {
  vip_follow: '重点家长跟进',
  reminder: '跟进提醒',
  considering: '考虑中回访',
  long_time_no_talk: '久未联系',
  stage_progress: '学习阶段推进',
};

export const TODO_PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: 'border-l-red-500 bg-red-50',
  medium: 'border-l-amber-500 bg-amber-50',
  low: 'border-l-slate-300 bg-white',
};

export const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三',
  '高一', '高二', '高三',
];

export const GENDERS: Record<'boy' | 'girl', string> = {
  boy: '男孩',
  girl: '女孩',
};

export const SUBJECTS = ['语文', '数学', '英语'];

export const DEFAULT_CATEGORIES = ['语文', '数学', '英语', '科学', '其他'];

export const COMMON_TAGS = ['爽快', '爱比价', '宝妈', '成绩好', '基础弱', '要刷题', '要预习', '事多', '高消费', '价格敏感'];

export type GroupStatus = 'active' | 'building' | 'dormant' | 'closed';
export type GroupMemberRole = 'active' | 'koc' | 'admin' | 'new' | 'silent_vip' | 'assistant';

export interface WechatGroup {
  id: number;
  name: string;
  purpose: string | null;
  description: string | null;
  member_count: number;
  status: GroupStatus;
  tags: string[];
  group_rules: string | null;
  owner_note: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  active_members?: WechatGroupMember[];
}

export interface WechatGroupMember {
  id: number;
  group_id: number;
  wechat_name: string;
  nickname: string | null;
  role: GroupMemberRole;
  tags: string[];
  customer_id: number | null;
  activity_score: number;
  remark: string | null;
  created_at: string;
}

export const GROUP_STATUS_LABELS: Record<GroupStatus, string> = {
  active: '运营中',
  building: '建群中',
  dormant: '休眠',
  closed: '已解散',
};

export const GROUP_STATUS_COLORS: Record<GroupStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  building: 'bg-blue-100 text-blue-700 border-blue-200',
  dormant: 'bg-gray-100 text-gray-600 border-gray-200',
  closed: 'bg-red-100 text-red-600 border-red-200',
};

export const GROUP_MEMBER_ROLE_LABELS: Record<GroupMemberRole, string> = {
  active: '活跃粉',
  koc: 'KOC/意见领袖',
  admin: '群管/助理',
  new: '新粉',
  silent_vip: '潜水大佬',
  assistant: '气氛组',
};

export const GROUP_MEMBER_ROLE_COLORS: Record<GroupMemberRole, string> = {
  active: 'bg-orange-100 text-orange-700',
  koc: 'bg-amber-100 text-amber-700',
  admin: 'bg-rose-100 text-rose-700',
  new: 'bg-sky-100 text-sky-700',
  silent_vip: 'bg-violet-100 text-violet-700',
  assistant: 'bg-emerald-100 text-emerald-700',
};

export type CheckinEventStatus = 'active' | 'ended';

export interface CheckinEvent {
  id: number;
  name: string;
  group_id: number | null;
  group_name?: string;
  start_date: string;
  end_date: string;
  required_text: string | null;
  reward_rules: string | null;
  status: CheckinEventStatus;
  participant_count?: number;
  total_days?: number;
  created_at: string;
  updated_at: string;
}

export interface CheckinParticipant {
  id: number;
  event_id: number;
  member_id: number | null;
  customer_id: number | null;
  nickname: string;
  child_name: string | null;
  joined_at: string;
  checkin_days?: number;
  current_streak?: number;
  max_streak?: number;
  last_checkin_date?: string | null;
}

export interface CheckinRecord {
  id: number;
  event_id: number;
  participant_id: number;
  checkin_date: string;
  note: string | null;
  created_at: string;
}

export interface CheckinParticipantStats {
  participant: CheckinParticipant;
  records: CheckinRecord[];
  checkin_days: number;
  current_streak: number;
  max_streak: number;
  checked_dates: string[];
}

export interface CheckinEventDetail extends CheckinEvent {
  participants: CheckinParticipantStats[];
  calendar: { date: string; count: number }[];
}

export const CHECKIN_STATUS_LABELS: Record<CheckinEventStatus, string> = {
  active: '进行中',
  ended: '已结束',
};

export const CHECKIN_STATUS_COLORS: Record<CheckinEventStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ended: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const GROUP_COMMON_TAGS = ['转化群', '服务群', '宝妈群', '高年级', '低年级', 'VIP群', '体验群', '刷题群', '预习群', '升学群'];

export type MaterialCategory = 'sales' | 'internal' | 'product' | 'planning' | 'other';

export interface Material {
  id: number;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  category: MaterialCategory;
  tags: string[];
  description: string | null;
  product_id: number | null;
  uploaded_by: number | null;
  download_count: number;
  created_at: string;
  updated_at: string;
  product_name?: string;
  uploader_name?: string;
  url?: string;
}

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  sales: '销售资料',
  internal: '内部文档',
  product: '商品资料',
  planning: '规划路径',
  other: '其他',
};

export const MATERIAL_CATEGORY_COLORS: Record<MaterialCategory, string> = {
  sales: 'bg-rose-100 text-rose-700 border-rose-200',
  internal: 'bg-blue-100 text-blue-700 border-blue-200',
  product: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  planning: 'bg-violet-100 text-violet-700 border-violet-200',
  other: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const MATERIAL_COMMON_TAGS = ['PDF', '话术', '家长沟通', '试卷', '讲义', '视频', '图片', '规划表', 'SOP', '培训'];

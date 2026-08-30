import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// Users & Authentication
// ============================================================================

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  role: text('role', { enum: ['admin', 'assistant'] }).notNull().default('assistant'),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// WeChat Users (CRM)
// ============================================================================

export const wxUsers = sqliteTable('wx_users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  openid: text('openid').notNull().unique(),
  nickname: text('nickname'),
  avatarUrl: text('avatar_url'),
  childName: text('child_name'),
  lastLoginAt: text('last_login_at'),
  points: integer('points').notNull().default(0),
  name: text('name'),
  phone: text('phone'),
  douyinNickname: text('douyin_nickname'),
  source: text('source', { enum: ['douyin_live', 'douyin_dm', 'referral', 'wechat_group', 'moments', 'other'] }),
  importance: text('importance', { enum: ['vip', 'normal', 'watch'] }).notNull().default('normal'),
  tags: text('tags').default('[]'),
  remark: text('remark'),
  totalSpent: real('total_spent').notNull().default(0),
  orderCount: integer('order_count').notNull().default(0),
  lastOrderDate: text('last_order_date'),
  lastFollowDate: text('last_follow_date'),
  wechatId: text('wechat_id'),
  wechatRemark: text('wechat_remark'),
  wechatAddDate: text('wechat_add_date'),
  wechatAccount: text('wechat_account').default('main'),
  stage: text('stage').notNull().default('new_friend'),
  nextTalkTopic: text('next_talk_topic'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Products
// ============================================================================

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  tier: text('tier', { enum: ['traffic', 'main', 'premium'] }).notNull().default('main'),
  category: text('category'),
  price: real('price').notNull().default(0),
  commissionPercent: real('commission_percent').notNull().default(0),
  imageUrl: text('image_url'),
  sellingPoints: text('selling_points'),
  relatedProductIds: text('related_product_ids').default('[]'),
  isOnSale: integer('is_on_sale', { mode: 'boolean' }).notNull().default(true),
  salesCount: integer('sales_count').notNull().default(0),
  description: text('description'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Orders
// ============================================================================

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNo: text('order_no').notNull().unique(),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  amount: real('amount').notNull().default(0),
  orderType: text('order_type', { enum: ['first', 'repurchase', 'upsell'] }).notNull().default('first'),
  childId: integer('child_id'),
  remark: text('remark'),
  shippingNote: text('shipping_note'),
  purchaseDate: text('purchase_date').notNull().default('(date(\'now\'))'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Follow-ups
// ============================================================================

export const followUps = sqliteTable('follow_ups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  date: text('date').notNull().default('(date(\'now\'))'),
  method: text('method', { enum: ['wechat', 'phone', 'group', 'live', 'moments'] }).notNull(),
  content: text('content').notNull(),
  result: text('result', { enum: ['closed', 'considering', 'no_need', 'follow_up'] }),
  nextFollowDate: text('next_follow_date'),
  isLiveNote: integer('is_live_note', { mode: 'boolean' }).notNull().default(false),
  childId: integer('child_id'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Children
// ============================================================================

export const children = sqliteTable('children', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  nickname: text('nickname').notNull(),
  gender: text('gender', { enum: ['boy', 'girl'] }),
  birthDate: text('birth_date'),
  grade: text('grade').notNull(),
  gradeAsOf: text('grade_as_of'),
  region: text('region'),
  textbookVersion: text('textbook_version'),
  weakSubjects: text('weak_subjects').default('[]'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Learning Paths & Stages
// ============================================================================

export const learningPaths = sqliteTable('learning_paths', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

export const learningStages = sqliteTable('learning_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pathId: integer('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  durationDays: integer('duration_days'),
  targetProductIds: text('target_product_ids').default('[]'),
  keyMilestones: text('key_milestones'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

export const childLearningProgress = sqliteTable('child_learning_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  childId: integer('child_id').notNull().references(() => children.id, { onDelete: 'cascade' }),
  pathId: integer('path_id').notNull().references(() => learningPaths.id, { onDelete: 'cascade' }),
  currentStageId: integer('current_stage_id').references(() => learningStages.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['not_started', 'in_progress', 'completed', 'paused'] }).notNull().default('not_started'),
  startDate: text('start_date'),
  completedDate: text('completed_date'),
  notes: text('notes'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Textbooks
// ============================================================================

export const textbooks = sqliteTable('textbooks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  region: text('region').notNull(),
  subject: text('subject').notNull(),
  grade: text('grade').notNull(),
  version: text('version').notNull(),
  publisher: text('publisher'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// WeChat Groups & Members
// ============================================================================

export const wechatGroups = sqliteTable('wechat_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  purpose: text('purpose'),
  description: text('description'),
  memberCount: integer('member_count').notNull().default(0),
  status: text('status', { enum: ['active', 'building', 'dormant', 'closed'] }).notNull().default('active'),
  tags: text('tags').default('[]'),
  groupRules: text('group_rules'),
  ownerNote: text('owner_note'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

export const wechatGroupMembers = sqliteTable('wechat_group_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  groupId: integer('group_id').notNull().references(() => wechatGroups.id, { onDelete: 'cascade' }),
  wechatName: text('wechat_name').notNull(),
  nickname: text('nickname'),
  role: text('role', { enum: ['active', 'koc', 'admin', 'new', 'silent_vip', 'assistant'] }).notNull().default('active'),
  tags: text('tags').default('[]'),
  wxUserId: integer('wx_user_id').references(() => wxUsers.id, { onDelete: 'set null' }),
  activityScore: integer('activity_score').notNull().default(50),
  remark: text('remark'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Materials
// ============================================================================

export const materials = sqliteTable('materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull().default(0),
  mimeType: text('mime_type'),
  category: text('category', { enum: ['sales', 'internal', 'product', 'planning', 'other'] }).notNull().default('sales'),
  tags: text('tags').default('[]'),
  description: text('description'),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  downloadCount: integer('download_count').notNull().default(0),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Check-in Events & Participants & Records
// ============================================================================

export const checkinEvents = sqliteTable('checkin_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  groupId: integer('group_id').references(() => wechatGroups.id, { onDelete: 'set null' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  signupDeadline: text('signup_deadline'),
  requiredText: text('required_text'),
  rewardRules: text('reward_rules'),
  allowMakeup: integer('allow_makeup', { mode: 'boolean' }).notNull().default(false),
  makeupWindowDays: integer('makeup_window_days').notNull().default(3),
  makeupLimitPerUser: integer('makeup_limit_per_user').notNull().default(3),
  makeupRequiresReview: integer('makeup_requires_review', { mode: 'boolean' }).notNull().default(true),
  makeupCountsForStreak: integer('makeup_counts_for_streak', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['active', 'ended'] }).notNull().default('active'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: text('deleted_at'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

export const checkinParticipants = sqliteTable('checkin_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => checkinEvents.id, { onDelete: 'cascade' }),
  memberId: integer('member_id').references(() => wechatGroupMembers.id, { onDelete: 'set null' }),
  wxUserId: integer('wx_user_id').references(() => wxUsers.id, { onDelete: 'set null' }),
  nickname: text('nickname').notNull(),
  childName: text('child_name'),
  joinedAt: text('joined_at').notNull().default('(datetime(\'now\'))'),
  rewardStatus: text('reward_status', { enum: ['none', 'pending', 'distributed'] }).notNull().default('none'),
  rewardDistributedAt: text('reward_distributed_at'),
  rewardNote: text('reward_note'),
});

export const checkinRecords = sqliteTable('checkin_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => checkinEvents.id, { onDelete: 'cascade' }),
  participantId: integer('participant_id').notNull().references(() => checkinParticipants.id, { onDelete: 'cascade' }),
  checkinDate: text('checkin_date').notNull(),
  note: text('note'),
  imageUrl: text('image_url'),
  imageHash: text('image_hash'),
  mediaType: text('media_type', { enum: ['image', 'video'] }).notNull().default('image'),
  isMakeup: integer('is_makeup', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('approved'),
  reviewedBy: integer('reviewed_by'),
  reviewedAt: text('reviewed_at'),
  reviewNote: text('review_note'),
  displayName: text('display_name'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Check-in Badges & Achievements
// ============================================================================

export const checkinBadges = sqliteTable('checkin_badges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').notNull().references(() => checkinEvents.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon'),
  type: text('type', { enum: ['streak', 'total', 'milestone'] }).notNull().default('streak'),
  targetDays: integer('target_days').notNull().default(0),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

export const checkinBadgeAchievements = sqliteTable('checkin_badge_achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  badgeId: integer('badge_id').notNull().references(() => checkinBadges.id, { onDelete: 'cascade' }),
  participantId: integer('participant_id').notNull().references(() => checkinParticipants.id, { onDelete: 'cascade' }),
  achievedAt: text('achieved_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Check-in Materials
// ============================================================================

export const checkinMaterials = sqliteTable('checkin_materials', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventId: integer('event_id').references(() => checkinEvents.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  fileUrl: text('file_url'),
  fileType: text('file_type'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// WeChat Subscribe Templates & Records
// ============================================================================

export const wxSubscribeTemplates = sqliteTable('wx_subscribe_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  templateId: text('template_id').notNull().unique(),
  scene: text('scene').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

export const wxSubscribeRecords = sqliteTable('wx_subscribe_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull(),
  scene: text('scene').notNull(),
  status: text('status', { enum: ['pending', 'sent', 'failed'] }).notNull().default('pending'),
  errorMsg: text('error_msg'),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Check-in Reminders
// ============================================================================

export const checkinReminders = sqliteTable('checkin_reminders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  eventId: integer('event_id').notNull().references(() => checkinEvents.id, { onDelete: 'cascade' }),
  remindTime: text('remind_time').notNull().default('20:00'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  lastSentDate: text('last_sent_date'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Check-in Record Likes
// ============================================================================

export const checkinRecordLikes = sqliteTable('checkin_record_likes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recordId: integer('record_id').notNull().references(() => checkinRecords.id, { onDelete: 'cascade' }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Settings
// ============================================================================

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: text('updated_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Points Ledger
// ============================================================================

export const pointsLedger = sqliteTable('points_ledger', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  wxUserId: integer('wx_user_id').notNull().references(() => wxUsers.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  type: text('type', { enum: ['checkin', 'order', 'adjust'] }).notNull(),
  refType: text('ref_type', { enum: ['none', 'checkin_record', 'order'] }).notNull().default('none'),
  refId: integer('ref_id'),
  note: text('note'),
  operatorId: integer('operator_id'),
  createdAt: text('created_at').notNull().default('(datetime(\'now\'))'),
});

// ============================================================================
// Relations
// ============================================================================

export const wxUsersRelations = relations(wxUsers, ({ many }) => ({
  orders: many(orders),
  followUps: many(followUps),
  children: many(children),
  groupMembers: many(wechatGroupMembers),
  subscribeRecords: many(wxSubscribeRecords),
  reminders: many(checkinReminders),
  likes: many(checkinRecordLikes),
  ledgerEntries: many(pointsLedger),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  wxUser: one(wxUsers, { fields: [orders.wxUserId], references: [wxUsers.id] }),
  product: one(products, { fields: [orders.productId], references: [products.id] }),
}));

export const followUpsRelations = relations(followUps, ({ one }) => ({
  wxUser: one(wxUsers, { fields: [followUps.wxUserId], references: [wxUsers.id] }),
}));

export const childrenRelations = relations(children, ({ one, many }) => ({
  wxUser: one(wxUsers, { fields: [children.wxUserId], references: [wxUsers.id] }),
  progress: many(childLearningProgress),
}));

export const learningPathsRelations = relations(learningPaths, ({ many }) => ({
  stages: many(learningStages),
  progress: many(childLearningProgress),
}));

export const learningStagesRelations = relations(learningStages, ({ one }) => ({
  path: one(learningPaths, { fields: [learningStages.pathId], references: [learningPaths.id] }),
}));

export const childLearningProgressRelations = relations(childLearningProgress, ({ one }) => ({
  child: one(children, { fields: [childLearningProgress.childId], references: [children.id] }),
  path: one(learningPaths, { fields: [childLearningProgress.pathId], references: [learningPaths.id] }),
  currentStage: one(learningStages, { fields: [childLearningProgress.currentStageId], references: [learningStages.id] }),
}));

export const wechatGroupsRelations = relations(wechatGroups, ({ many }) => ({
  members: many(wechatGroupMembers),
  events: many(checkinEvents),
}));

export const wechatGroupMembersRelations = relations(wechatGroupMembers, ({ one }) => ({
  group: one(wechatGroups, { fields: [wechatGroupMembers.groupId], references: [wechatGroups.id] }),
  wxUser: one(wxUsers, { fields: [wechatGroupMembers.wxUserId], references: [wxUsers.id] }),
}));

export const materialsRelations = relations(materials, ({ one }) => ({
  product: one(products, { fields: [materials.productId], references: [products.id] }),
  uploader: one(users, { fields: [materials.uploadedBy], references: [users.id] }),
}));

export const checkinEventsRelations = relations(checkinEvents, ({ one, many }) => ({
  group: one(wechatGroups, { fields: [checkinEvents.groupId], references: [wechatGroups.id] }),
  participants: many(checkinParticipants),
  records: many(checkinRecords),
  badges: many(checkinBadges),
  materials: many(checkinMaterials),
}));

export const checkinParticipantsRelations = relations(checkinParticipants, ({ one, many }) => ({
  event: one(checkinEvents, { fields: [checkinParticipants.eventId], references: [checkinEvents.id] }),
  member: one(wechatGroupMembers, { fields: [checkinParticipants.memberId], references: [wechatGroupMembers.id] }),
  wxUser: one(wxUsers, { fields: [checkinParticipants.wxUserId], references: [wxUsers.id] }),
  records: many(checkinRecords),
  achievements: many(checkinBadgeAchievements),
}));

export const checkinRecordsRelations = relations(checkinRecords, ({ one, many }) => ({
  event: one(checkinEvents, { fields: [checkinRecords.eventId], references: [checkinEvents.id] }),
  participant: one(checkinParticipants, { fields: [checkinRecords.participantId], references: [checkinParticipants.id] }),
  likes: many(checkinRecordLikes),
}));

export const checkinBadgesRelations = relations(checkinBadges, ({ one, many }) => ({
  event: one(checkinEvents, { fields: [checkinBadges.eventId], references: [checkinEvents.id] }),
  achievements: many(checkinBadgeAchievements),
}));

export const checkinBadgeAchievementsRelations = relations(checkinBadgeAchievements, ({ one }) => ({
  badge: one(checkinBadges, { fields: [checkinBadgeAchievements.badgeId], references: [checkinBadges.id] }),
  participant: one(checkinParticipants, { fields: [checkinBadgeAchievements.participantId], references: [checkinParticipants.id] }),
}));

export const checkinMaterialsRelations = relations(checkinMaterials, ({ one }) => ({
  event: one(checkinEvents, { fields: [checkinMaterials.eventId], references: [checkinEvents.id] }),
}));

export const wxSubscribeRecordsRelations = relations(wxSubscribeRecords, ({ one }) => ({
  wxUser: one(wxUsers, { fields: [wxSubscribeRecords.wxUserId], references: [wxUsers.id] }),
}));

export const checkinRemindersRelations = relations(checkinReminders, ({ one }) => ({
  wxUser: one(wxUsers, { fields: [checkinReminders.wxUserId], references: [wxUsers.id] }),
  event: one(checkinEvents, { fields: [checkinReminders.eventId], references: [checkinEvents.id] }),
}));

export const checkinRecordLikesRelations = relations(checkinRecordLikes, ({ one }) => ({
  record: one(checkinRecords, { fields: [checkinRecordLikes.recordId], references: [checkinRecords.id] }),
  wxUser: one(wxUsers, { fields: [checkinRecordLikes.wxUserId], references: [wxUsers.id] }),
}));

export const pointsLedgerRelations = relations(pointsLedger, ({ one }) => ({
  wxUser: one(wxUsers, { fields: [pointsLedger.wxUserId], references: [wxUsers.id] }),
}));

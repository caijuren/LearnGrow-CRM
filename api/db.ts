import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'learngrow.db');
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export default sqlite;

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    douyin_nickname TEXT,
    avatar TEXT,
    source TEXT CHECK(source IN ('douyin_live', 'douyin_dm', 'referral', 'other')),
    importance TEXT NOT NULL DEFAULT 'normal' CHECK(importance IN ('vip', 'normal', 'watch')),
    tags TEXT DEFAULT '[]',
    remark TEXT,
    total_spent REAL NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    last_order_date TEXT,
    last_follow_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'main' CHECK(tier IN ('traffic', 'main', 'premium')),
    category TEXT,
    price REAL NOT NULL DEFAULT 0,
    commission_percent REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    selling_points TEXT,
    related_product_ids TEXT DEFAULT '[]',
    is_on_sale INTEGER NOT NULL DEFAULT 1,
    sales_count INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    order_type TEXT NOT NULL DEFAULT 'first' CHECK(order_type IN ('first', 'repurchase', 'upsell')),
    remark TEXT,
    shipping_note TEXT,
    purchase_date TEXT NOT NULL DEFAULT (date('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS follow_ups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    date TEXT NOT NULL DEFAULT (date('now')),
    method TEXT NOT NULL CHECK(method IN ('wechat', 'phone', 'group', 'live', 'moments')),
    content TEXT NOT NULL,
    result TEXT CHECK(result IN ('closed', 'considering', 'no_need', 'follow_up')),
    next_follow_date TEXT,
    is_live_note INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'assistant' CHECK(role IN ('admin', 'assistant')),
    display_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_customers_importance ON customers(importance);
  CREATE INDEX IF NOT EXISTS idx_customers_last_follow_date ON customers(last_follow_date);
  CREATE INDEX IF NOT EXISTS idx_customers_last_order_date ON customers(last_order_date);
  CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
  CREATE INDEX IF NOT EXISTS idx_orders_purchase_date ON orders(purchase_date);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_customer_id ON follow_ups(customer_id);
  CREATE INDEX IF NOT EXISTS idx_follow_ups_next_follow_date ON follow_ups(next_follow_date);
  CREATE INDEX IF NOT EXISTS idx_products_tier ON products(tier);
  CREATE INDEX IF NOT EXISTS idx_products_is_on_sale ON products(is_on_sale);
`);

const existingProductCols = (sqlite.prepare("PRAGMA table_info(products)").all() as any[]).map(c => c.name);
if (!existingProductCols.includes('commission_percent')) {
  sqlite.exec("ALTER TABLE products ADD COLUMN commission_percent REAL NOT NULL DEFAULT 0");
}

const existingOrderCols = (sqlite.prepare("PRAGMA table_info(orders)").all() as any[]).map(c => c.name);
if (!existingOrderCols.includes('child_id')) {
  sqlite.exec("ALTER TABLE orders ADD COLUMN child_id INTEGER");
}
const existingFollowUpCols = (sqlite.prepare("PRAGMA table_info(follow_ups)").all() as any[]).map(c => c.name);
if (!existingFollowUpCols.includes('child_id')) {
  sqlite.exec("ALTER TABLE follow_ups ADD COLUMN child_id INTEGER");
}

const existingCustomerCols = (sqlite.prepare("PRAGMA table_info(customers)").all() as any[]).map(c => c.name);
if (!existingCustomerCols.includes('wechat_id')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN wechat_id TEXT");
}
if (!existingCustomerCols.includes('wechat_remark')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN wechat_remark TEXT");
}
if (!existingCustomerCols.includes('wechat_add_date')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN wechat_add_date TEXT");
}
if (!existingCustomerCols.includes('wechat_account')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN wechat_account TEXT DEFAULT 'main'");
}
if (!existingCustomerCols.includes('stage')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN stage TEXT NOT NULL DEFAULT 'new_friend'");
}
if (!existingCustomerCols.includes('next_talk_topic')) {
  sqlite.exec("ALTER TABLE customers ADD COLUMN next_talk_topic TEXT");
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS wechat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    purpose TEXT,
    description TEXT,
    member_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'building', 'dormant', 'closed')),
    tags TEXT DEFAULT '[]',
    group_rules TEXT,
    owner_note TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wechat_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    wechat_name TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL DEFAULT 'active' CHECK(role IN ('active', 'koc', 'admin', 'new', 'silent_vip', 'assistant')),
    tags TEXT DEFAULT '[]',
    customer_id INTEGER,
    activity_score INTEGER NOT NULL DEFAULT 50,
    remark TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES wechat_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_groups_status ON wechat_groups(status);
  CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON wechat_group_members(group_id);
  CREATE INDEX IF NOT EXISTS idx_group_members_customer_id ON wechat_group_members(customer_id);
`);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS children (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    nickname TEXT NOT NULL,
    gender TEXT CHECK(gender IN ('boy', 'girl')),
    birth_date TEXT,
    grade TEXT NOT NULL,
    region TEXT,
    textbook_version TEXT,
    weak_subjects TEXT DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS learning_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS learning_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path_id INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_days INTEGER,
    target_product_ids TEXT DEFAULT '[]',
    key_milestones TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (path_id) REFERENCES learning_paths(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS child_learning_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    child_id INTEGER NOT NULL,
    path_id INTEGER NOT NULL,
    current_stage_id INTEGER,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started', 'in_progress', 'completed', 'paused')),
    start_date TEXT,
    completed_date TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
    FOREIGN KEY (path_id) REFERENCES learning_paths(id) ON DELETE CASCADE,
    FOREIGN KEY (current_stage_id) REFERENCES learning_stages(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS textbooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade TEXT NOT NULL,
    version TEXT NOT NULL,
    publisher TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_children_customer_id ON children(customer_id);
  CREATE INDEX IF NOT EXISTS idx_progress_child_id ON child_learning_progress(child_id);
  CREATE INDEX IF NOT EXISTS idx_progress_path_id ON child_learning_progress(path_id);
  CREATE INDEX IF NOT EXISTS idx_stages_path_id ON learning_stages(path_id);
  CREATE INDEX IF NOT EXISTS idx_textbooks_region ON textbooks(region);
  CREATE INDEX IF NOT EXISTS idx_textbooks_subject ON textbooks(subject);
`);

const pathCount = (sqlite.prepare('SELECT COUNT(*) as count FROM learning_paths').get() as any).count;
if (pathCount === 0) {
  const insertPath = sqlite.prepare(`
    INSERT INTO learning_paths (name, subject, description, is_active) VALUES (?, ?, ?, 1)
  `);
  const insertStage = sqlite.prepare(`
    INSERT INTO learning_stages (path_id, order_index, name, description, duration_days, target_product_ids, key_milestones)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPaths = sqlite.transaction(() => {
    const paths = [
      ['语文阅读理解提分路径', '语文', '从基础到进阶的阅读理解能力培养，适合3-6年级语文薄弱的孩子'],
      ['数学思维训练路径', '数学', '奥数入门+思维拓展，培养孩子逻辑思维能力'],
      ['英语单词记忆路径', '英语', '艾宾浩斯记忆法+自然拼读，系统提升英语词汇量'],
      ['小学计算能力提升', '数学', '从口算到竖式计算，每天10分钟打好计算基础'],
      ['作文入门与提升', '语文', '从好词好句积累到独立写作，分年级作文训练'],
    ];
    const stagesData: { pathId: number; stages: any[] }[] = [];
    for (const p of paths) {
      const result = insertPath.run(...p);
      stagesData.push({ pathId: result.lastInsertRowid as number, stages: [] });
    }
    const allStages = [
      [0, 0, '基础诊断', '了解孩子当前阅读水平，找出薄弱点', 7, '[]', '完成3篇基础阅读测试，定位问题'],
      [0, 1, '答题技巧入门', '学习基本阅读答题方法和公式', 14, '[2]', '掌握概括题、词语解释题答题技巧'],
      [0, 2, '分类专项训练', '按题型进行专项突破练习', 21, '[2]', '记叙文、说明文各10篇练习达标'],
      [0, 3, '综合提升', '真题演练+错题复盘', 28, '[2,5]', '期末测试阅读理解得分率80%以上'],
      [1, 0, '计算基础', '巩固四则运算和简便计算', 7, '[8]', '口算速度达到每分钟20题'],
      [1, 1, '图形认知', '平面图形和立体图形基础', 14, '[3]', '掌握基本图形面积体积计算'],
      [1, 2, '应用题突破', '典型应用题分类训练', 21, '[3]', '行程、工程、鸡兔同笼等问题熟练'],
      [1, 3, '思维拓展', '奥数入门题型训练', 28, '[3,6]', '能独立完成中等难度思维题'],
      [2, 0, '自然拼读入门', '学习字母和字母组合发音规则', 14, '[9]', '见词能读，听音能写'],
      [2, 1, '基础词汇积累', '高频词汇记忆+默写', 21, '[4]', '掌握300个核心词汇'],
      [2, 2, '分级阅读', '简单绘本阅读+单词巩固', 28, '[4,9]', '能独立阅读简单英语短文'],
      [3, 0, '口算热身', '每天10分钟口算训练', 7, '[8]', '100以内加减法5分钟100题'],
      [3, 1, '竖式计算', '加减乘除竖式规范训练', 14, '[8]', '竖式计算准确率95%以上'],
      [3, 2, '简便运算', '运算定律和巧算方法', 21, '[3]', '能灵活运用运算律简便计算'],
      [4, 0, '好词好句积累', '摘抄+仿写优美句子', 7, '[]', '积累100个好词50个好句'],
      [4, 1, '段落写作', '学习写一段话，有中心有顺序', 14, '[7]', '能独立写出200字通顺段落'],
      [4, 2, '完整作文', '命题作文结构训练', 21, '[7]', '40分钟完成400字作文'],
      [4, 3, '作文提升', '修改润色+不同文体', 28, '[7,5]', '作文达到班级中上水平'],
    ];
    for (const s of allStages) {
      insertStage.run(stagesData[s[0]].pathId, s[1], s[2], s[3], s[4], s[5], s[6]);
    }
  });
  insertPaths();
}

const textbookCount = (sqlite.prepare('SELECT COUNT(*) as count FROM textbooks').get() as any).count;
if (textbookCount === 0) {
  const insertTextbook = sqlite.prepare(`
    INSERT INTO textbooks (region, subject, grade, version, publisher, is_default) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const textbooks = [
    ['人教版', '语文', '一年级', '部编版', '人民教育出版社', 1],
    ['人教版', '语文', '二年级', '部编版', '人民教育出版社', 1],
    ['人教版', '语文', '三年级', '部编版', '人民教育出版社', 1],
    ['人教版', '语文', '四年级', '部编版', '人民教育出版社', 1],
    ['人教版', '语文', '五年级', '部编版', '人民教育出版社', 1],
    ['人教版', '语文', '六年级', '部编版', '人民教育出版社', 1],
    ['人教版', '数学', '一年级', '人教版', '人民教育出版社', 1],
    ['人教版', '数学', '二年级', '人教版', '人民教育出版社', 1],
    ['人教版', '数学', '三年级', '人教版', '人民教育出版社', 1],
    ['人教版', '数学', '四年级', '人教版', '人民教育出版社', 1],
    ['人教版', '数学', '五年级', '人教版', '人民教育出版社', 1],
    ['人教版', '数学', '六年级', '人教版', '人民教育出版社', 1],
    ['人教版', '英语', '三年级', 'PEP版', '人民教育出版社', 1],
    ['人教版', '英语', '四年级', 'PEP版', '人民教育出版社', 1],
    ['人教版', '英语', '五年级', 'PEP版', '人民教育出版社', 1],
    ['人教版', '英语', '六年级', 'PEP版', '人民教育出版社', 1],
    ['苏教版', '数学', '一年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['苏教版', '数学', '二年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['苏教版', '数学', '三年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['苏教版', '数学', '四年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['苏教版', '数学', '五年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['苏教版', '数学', '六年级', '苏教版', '江苏凤凰教育出版社', 0],
    ['北师大版', '数学', '一年级', '北师大版', '北京师范大学出版社', 0],
    ['北师大版', '数学', '二年级', '北师大版', '北京师范大学出版社', 0],
    ['北师大版', '数学', '三年级', '北师大版', '北京师范大学出版社', 0],
    ['北师大版', '数学', '四年级', '北师大版', '北京师范大学出版社', 0],
    ['北师大版', '数学', '五年级', '北师大版', '北京师范大学出版社', 0],
    ['北师大版', '数学', '六年级', '北师大版', '北京师范大学出版社', 0],
  ];
  const insertTextbooks = sqlite.transaction((books: any[][]) => {
    for (const b of books) insertTextbook.run(...b);
  });
  insertTextbooks(textbooks);
}

const productCount = (sqlite.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
if (productCount === 0) {
  const insertProduct = sqlite.prepare(`
    INSERT INTO products (name, tier, category, price, commission_percent, selling_points, related_product_ids, description, image_url, sales_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProducts = sqlite.transaction((products: any[][]) => {
    for (const p of products) insertProduct.run(...p);
  });
  insertProducts([
    ['9.9元小升初语文资料包', 'traffic', '语文', 9.9, 10, '电子版，基础知识点汇总+真题精选，适合5-6年级', '[]', '引流福利款，低价吸引家长加微信', null, 0],
    ['小学语文阅读理解专项训练', 'main', '语文', 69, 20, '分年级版本，答题技巧+80篇练习+答案解析，提分明显', '[3,7]', '主力款，语文薄弱的孩子都需要', null, 0],
    ['小学数学思维训练题集', 'main', '数学', 79, 25, '举一反三，奥数入门，培养逻辑思维，带视频讲解', '[4,8]', '数学拔高主力款，成绩好的孩子家长最爱买', null, 0],
    ['小学英语单词打卡手册', 'main', '英语', 59, 20, '按年级分册，每天5个单词，艾宾浩斯记忆法，带默写本', '[5,9]', '英语基础款，几乎每个家长都需要', null, 0],
    ['期末冲刺卷（语数英套装）', 'main', '其他', 129, 20, '1-6年级可选，名校真题，考前刷题必备，三科一套', '[2,3,4]', '考试前爆款，每学期都能卖', null, 0],
    ['VIP1对1学习规划服务', 'premium', '其他', 399, 30, '根据孩子情况定制学期学习计划，1次线上沟通+月度跟进', '[]', '高端服务，给消费力强、重视教育的家长推', null, 0],
    ['同步作文仿写训练', 'main', '语文', 75, 20, '课本单元同步，好词好句+范文仿写，3-6年级', '[2]', '语文作文痛点，家长愿意花钱', null, 0],
    ['数学计算题天天练', 'traffic', '数学', 19.9, 10, '每天10分钟口算+竖式计算，上下册可选，打好计算基础', '[3]', '高频刚需引流款，几乎所有小学生都需要', null, 0],
    ['英语自然拼读启蒙课', 'main', '英语', 99, 25, '视频课+练习册，零基础入门，见词能读听音能写', '[4]', '低年级英语启蒙刚需，好评率高', null, 0],
    ['科学实验套装（小学版）', 'main', '科学', 89, 20, '30个家庭小实验，材料齐全，视频教程，动手又动脑', '[]', '素质教育款，宝妈群体爱买', null, 0],
  ]);
}

const customerCount = (sqlite.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count;
if (customerCount === 0) {
  const insertCustomer = sqlite.prepare(`
    INSERT INTO customers (name, nickname, phone, douyin_nickname, source, importance, tags, remark, total_spent, order_count, last_order_date, last_follow_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrder = sqlite.prepare(`
    INSERT INTO orders (order_no, customer_id, product_id, amount, order_type, purchase_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertFollowUp = sqlite.prepare(`
    INSERT INTO follow_ups (customer_id, date, method, content, result, next_follow_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const seedCustomers = sqlite.transaction(() => {
    const customers = [
      ['轩轩妈妈-三年级', '轩妈', '138****1234', '轩轩妈妈爱生活', 'douyin_live', 'vip', '["宝妈","爽快","要刷题"]', '孩子语文阅读理解差，特别着急，愿意花钱补，老公做生意有钱', 352, 4, '2026-06-20', '2026-06-24'],
      ['朵朵爸爸-五年级', '朵爸', null, '朵朵她爸', 'douyin_live', 'normal', '["爽快"]', '给女儿买数学资料，不太懂教育但愿意听推荐', 79, 1, '2026-06-15', '2026-06-10'],
      ['萌萌妈妈-初一', '萌萌妈', null, '陪读的萌萌妈', 'douyin_dm', 'watch', '["价格敏感","基础弱"]', '预算有限，只买9.9福利，孩子基础差但舍不得花钱', 9.9, 1, '2026-06-01', '2026-05-28'],
      ['浩浩外婆-转介绍', '浩浩外婆', '139****5678', null, 'referral', 'vip', '["宝妈","高消费","爽快"]', '女儿推荐来的，外孙成绩好，舍得给外孙花钱，基本不还价', 577, 5, '2026-06-22', '2026-06-25'],
      ['阳阳爸爸-程序员', '阳阳爸', null, '码农带娃记', 'douyin_live', 'normal', '["高消费","爽快"]', '程序员，重视孩子思维训练，买数学类多', 399, 1, '2026-06-18', null],
      ['甜甜妈妈-英语老师', '甜妈', '137****9012', '甜甜的英语角', 'douyin_live', 'vip', '["成绩好","要预习","高消费"]', '自己是英语老师，对资料要求高，认可了就一直买还推荐朋友', 327, 3, '2026-06-10', '2026-06-20'],
      ['磊磊奶奶-退休', '磊奶奶', null, null, 'referral', 'normal', '["爽快"]', '邻居推荐来的，给孙子买资料不太会用微信，电话沟通', 129, 1, '2026-05-20', '2026-05-20'],
      ['芊芊妈妈-主播同行', '芊妈', '186****3456', '芊妈带娃日常', 'douyin_live', 'vip', '["高消费","爽快","要刷题"]', '也是做妈妈账号的，粉丝不多但购买力强，孩子4年级什么都买', 617, 4, '2026-06-23', '2026-06-23'],
      ['宇宇爸爸-薅羊毛', '宇爸', null, '宇爸育儿经', 'douyin_live', 'watch', '["价格敏感"]', '只蹲直播间9.9福利，买完不说话', 29.8, 2, '2026-04-10', null],
      ['航航妈妈-新粉', '航妈', null, '家有小学生航航', 'douyin_live', 'normal', '["宝妈","基础弱"]', '刚加微信，买了计算题天天练，说孩子计算总错，等反馈', 19.9, 1, '2026-06-25', '2026-06-25'],
      ['琪琪妈妈-全职太太', '琪琪妈', null, '琪琪妈的精致生活', 'douyin_live', 'vip', '["高消费","爽快","成绩好"]', '家里条件好，孩子成绩也好，只买最好的，不看价格', 727, 4, '2026-06-18', '2026-06-22'],
      ['然然妈妈-二年级', '然妈', null, '然然的小窝', 'douyin_dm', 'watch', '["价格敏感","基础弱"]', '孩子二年级，刚关注，还在观望', 9.9, 1, '2026-05-15', null],
    ];

    const customerIds: number[] = [];
    for (const c of customers) {
      const result = insertCustomer.run(...c);
      customerIds.push(result.lastInsertRowid as number);
    }

    const orders = [
      ['ORD20260620001', customerIds[0], 1, 9.9, 'first', '2026-05-01'],
      ['ORD20260620002', customerIds[0], 7, 75, 'repurchase', '2026-05-15'],
      ['ORD20260620003', customerIds[0], 5, 129, 'upsell', '2026-06-01'],
      ['ORD20260620004', customerIds[0], 2, 69, 'repurchase', '2026-06-20'],
      ['ORD20260615001', customerIds[1], 3, 79, 'first', '2026-06-15'],
      ['ORD20260601001', customerIds[2], 1, 9.9, 'first', '2026-06-01'],
      ['ORD20260510001', customerIds[3], 1, 9.9, 'first', '2026-05-10'],
      ['ORD20260520001', customerIds[3], 8, 19.9, 'repurchase', '2026-05-20'],
      ['ORD20260601002', customerIds[3], 5, 129, 'repurchase', '2026-06-01'],
      ['ORD20260610001', customerIds[3], 6, 399, 'upsell', '2026-06-10'],
      ['ORD20260622001', customerIds[3], 4, 59, 'repurchase', '2026-06-22'],
      ['ORD20260618001', customerIds[4], 6, 399, 'first', '2026-06-18'],
      ['ORD20260520002', customerIds[5], 9, 99, 'first', '2026-05-20'],
      ['ORD20260601003', customerIds[5], 5, 129, 'repurchase', '2026-06-01'],
      ['ORD20260610002', customerIds[5], 10, 89, 'repurchase', '2026-06-10'],
      ['ORD20260520003', customerIds[6], 5, 129, 'first', '2026-05-20'],
      ['ORD20260601004', customerIds[7], 5, 129, 'first', '2026-06-01'],
      ['ORD20260615002', customerIds[7], 6, 399, 'upsell', '2026-06-15'],
      ['ORD20260623001', customerIds[7], 2, 69, 'upsell', '2026-06-23'],
      ['ORD20260410001', customerIds[8], 1, 9.9, 'first', '2026-04-10'],
      ['ORD20260410002', customerIds[8], 8, 19.9, 'repurchase', '2026-04-10'],
      ['ORD20260625001', customerIds[9], 8, 19.9, 'first', '2026-06-25'],
      ['ORD20260515001', customerIds[10], 5, 129, 'first', '2026-05-15'],
      ['ORD20260601005', customerIds[10], 6, 399, 'upsell', '2026-06-01'],
      ['ORD20260610003', customerIds[10], 9, 99, 'upsell', '2026-06-10'],
      ['ORD20260618002', customerIds[10], 10, 89, 'repurchase', '2026-06-18'],
      ['ORD20260515002', customerIds[11], 1, 9.9, 'first', '2026-05-15'],
    ];
    for (const o of orders) insertOrder.run(...o);

    const followUps = [
      [customerIds[0], '2026-06-24', 'wechat', '轩轩妈妈说阅读资料在用，问有没有作文的，推荐了同步作文，说等发工资买', 'considering', '2026-06-27'],
      [customerIds[3], '2026-06-25', 'wechat', '浩浩外婆说试卷做完了，外孙成绩进步了，推荐VIP规划服务，说跟女儿商量下', 'considering', null],
      [customerIds[5], '2026-06-20', 'phone', '甜甜妈妈自己是老师，说资料不错，问有没有自然拼读的，已经推了', 'closed', null],
      [customerIds[7], '2026-06-23', 'live', '直播间芊芊妈妈直接拍了科学实验套装，说上次的计算题孩子很喜欢', 'closed', null],
      [customerIds[9], '2026-06-25', 'wechat', '航航妈妈刚加，买了计算题，教她怎么用，说孩子做了两天有点效果，继续跟进', 'follow_up', '2026-06-29'],
      [customerIds[10], '2026-06-22', 'wechat', '琪琪妈妈说试卷好用，问有没有二年级的预习资料，告诉她7月上新', 'closed', null],
    ];
    for (const f of followUps) insertFollowUp.run(...f);

    const updateStage = sqlite.prepare(`UPDATE customers SET stage = ?, wechat_add_date = ?, wechat_remark = ? WHERE id = ?`);
    updateStage.run('purchased', '2026-04-20', '轩轩妈妈-三年级', customerIds[0]);
    updateStage.run('purchased', '2026-05-10', '朵朵爸爸-五年级', customerIds[1]);
    updateStage.run('silent', '2026-05-20', '萌萌妈妈-初一', customerIds[2]);
    updateStage.run('repurchased', '2026-04-01', '浩浩外婆-转介绍', customerIds[3]);
    updateStage.run('purchased', '2026-06-01', '阳阳爸爸-程序员', customerIds[4]);
    updateStage.run('repurchased', '2026-05-01', '甜甜妈妈-英语老师', customerIds[5]);
    updateStage.run('purchased', '2026-05-15', '磊磊奶奶-退休', customerIds[6]);
    updateStage.run('repurchased', '2026-05-20', '芊芊妈妈-主播同行', customerIds[7]);
    updateStage.run('silent', '2026-03-20', '宇宇爸爸-薅羊毛', customerIds[8]);
    updateStage.run('interested', '2026-06-20', '航航妈妈-新粉', customerIds[9]);
    updateStage.run('repurchased', '2026-05-01', '琪琪妈妈-全职太太', customerIds[10]);
    updateStage.run('initial_chat', '2026-05-10', '然然妈妈-二年级', customerIds[11]);
  });
  seedCustomers();
}

const childCount = (sqlite.prepare('SELECT COUNT(*) as count FROM children').get() as any).count;
if (childCount === 0) {
  const insertChild = sqlite.prepare(`
    INSERT INTO children (customer_id, nickname, gender, grade, region, textbook_version, weak_subjects, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const customerIds = (sqlite.prepare('SELECT id FROM customers ORDER BY id').all() as { id: number }[]).map(c => c.id);
  const children = [
    [customerIds[0], '轩轩', 'boy', '三年级', '人教版', '部编版', '["语文"]', '语文阅读理解差，作文也不太会写'],
    [customerIds[1], '朵朵', 'girl', '五年级', '人教版', '人教版', '["数学"]', '数学思维不太好，应用题容易错'],
    [customerIds[2], '萌萌', 'girl', '初一', '人教版', '人教版', '["数学","英语"]', '基础比较弱，需要从简单内容开始'],
    [customerIds[3], '浩浩', 'boy', '四年级', '人教版', '部编版', '[]', '成绩不错，想拔高'],
    [customerIds[5], '甜甜', 'girl', '二年级', '人教版', 'PEP版', '["英语"]', '英语启蒙阶段，妈妈自己是老师'],
    [customerIds[7], '芊芊', 'girl', '四年级', '人教版', '部编版', '[]', '成绩不错，妈妈购买力强，什么都愿意尝试'],
    [customerIds[9], '航航', 'boy', '一年级', '人教版', '人教版', '["数学"]', '计算总是粗心出错'],
    [customerIds[10], '琪琪', 'girl', '六年级', '人教版', '部编版', '[]', '成绩好，准备小升初，需要拔高和预习'],
  ];
  const insertChildren = sqlite.transaction((kids: any[][]) => {
    for (const c of kids) insertChild.run(...c);
  });
  insertChildren(children);
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT,
    category TEXT NOT NULL DEFAULT 'sales' CHECK(category IN ('sales', 'internal', 'product', 'planning', 'other')),
    tags TEXT DEFAULT '[]',
    description TEXT,
    product_id INTEGER,
    uploaded_by INTEGER,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
  CREATE INDEX IF NOT EXISTS idx_materials_product_id ON materials(product_id);
`);

const userCount = (sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
if (userCount === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  sqlite.prepare("INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)")
    .run('admin', hash, 'admin', '主播');
  sqlite.prepare("INSERT INTO users (username, password, role, display_name) VALUES (?, ?, ?, ?)")
    .run('assistant', bcrypt.hashSync('assist123', 10), 'assistant', '小助理');
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS checkin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    group_id INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    required_text TEXT,
    reward_rules TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'ended')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES wechat_groups(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS checkin_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    member_id INTEGER,
    customer_id INTEGER,
    nickname TEXT NOT NULL,
    child_name TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES checkin_events(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES wechat_group_members(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS checkin_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    participant_id INTEGER NOT NULL,
    checkin_date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (event_id) REFERENCES checkin_events(id) ON DELETE CASCADE,
    FOREIGN KEY (participant_id) REFERENCES checkin_participants(id) ON DELETE CASCADE,
    UNIQUE(event_id, participant_id, checkin_date)
  );

  CREATE INDEX IF NOT EXISTS idx_checkin_events_status ON checkin_events(status);
  CREATE INDEX IF NOT EXISTS idx_checkin_events_group_id ON checkin_events(group_id);
  CREATE INDEX IF NOT EXISTS idx_checkin_participants_event_id ON checkin_participants(event_id);
  CREATE INDEX IF NOT EXISTS idx_checkin_records_event_id ON checkin_records(event_id);
  CREATE INDEX IF NOT EXISTS idx_checkin_records_participant_id ON checkin_records(participant_id);
  CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(checkin_date);
`);

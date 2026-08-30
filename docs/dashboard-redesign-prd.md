# 驾驶舱改造 PRD（产品需求文档）

**版本：** v1.0  
**创建日期：** 2026-08-29  
**负责人：** 产品经理 + 前端开发 + 后端开发  
**优先级：** P0（高优先级，客户核心关注模块）

---

## 一、背景与目标

### 1.1 业务背景

当前驾驶舱存在以下问题：
- **数据失真**：大量硬编码假数据（热销产品、客户结构、周活跃等），无法反映真实业务状况
- **指标错位**：展示"零售/分销/批发"等电商概念，但实际业务是教育培训（课程报名、打卡、学习路径）
- **核心缺失**：缺少客户真正关心的关键指标（微信用户增长、打卡活跃度）
- **功能冗余**：AI助手、复购率仪表盘等使用率低或无实际价值

**客户反馈：**
> "我目前主要关注的就是微信用户和打卡，其他的板块我不怎么关心。"

### 1.2 改造目标

打造一个**聚焦于微信用户运营和打卡活跃度**的驾驶舱，帮助业务方：
- 📊 **实时监控**：一屏看清用户池规模、拉新速度、打卡活跃度
- 🔍 **快速洞察**：识别用户增长趋势、活跃用户特征、热门活动
- ⚡ **及时行动**：发现异常（如打卡率骤降）立即干预

### 1.3 成功标准

- ✅ 所有数据来自真实数据库，零硬编码
- ✅ 页面加载时间 < 2 秒
- ✅ 核心指标一目了然，无需滚动即可看到 4 个关键数字
- ✅ 支持钻取到详细列表页（点击卡片跳转）

---

## 二、功能需求

### 2.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  顶部核心指标栏（4 个大卡片横排）                              │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  左侧主区域（2/3 宽度）   │  右侧辅助区域（1/3 宽度）         │
│                          │                                  │
│  • 近 30 天增长&打卡趋势  │  • 今日实时动态                   │
│  • 用户阶段分布           │  • 用户来源渠道分析               │
│  • 热门打卡活动排行       │  • 打卡达人榜                     │
│                          │  • 需跟进用户提醒                 │
└──────────────────────────┴──────────────────────────────────┘
```

---

### 2.2 顶部核心指标栏

#### **卡片 1：微信用户总数**
- **主数字**：`wx_users` 表总人数
- **辅助信息**：今日新增 X 人
- **趋势提示**：较昨日 ↑Y% 或 ↓Z%
- **交互**：点击跳转到 `/wx-users`（微信用户列表）
- **数据源**：
  ```sql
  SELECT COUNT(*) as total FROM wx_users;
  SELECT COUNT(*) as today_new FROM wx_users WHERE date(created_at) = CURDATE();
  ```

#### **卡片 2：累计打卡人次**
- **主数字**：历史累计审核通过的打卡记录数
- **辅助信息**：今日打卡 X 次，本周累计 Y 次
- **交互**：点击跳转到 `/checkin`（打卡统计页）
- **数据源**：
  ```sql
  SELECT COUNT(*) as total FROM checkin_records WHERE status = 'approved';
  SELECT COUNT(*) as today FROM checkin_records 
    WHERE status = 'approved' AND date(checkin_date) = CURDATE();
  SELECT COUNT(*) as this_week FROM checkin_records 
    WHERE status = 'approved' AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);
  ```

#### **卡片 3：活跃用户数**
- **定义**：近 7 天有至少 1 次打卡的去重用户数
- **主数字**：活跃用户数
- **辅助信息**：占总用户数 X%
- **数据源**：
  ```sql
  SELECT COUNT(DISTINCT p.wx_user_id) as active_users
  FROM checkin_participants p
  JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
  WHERE r.checkin_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY);
  ```

#### **卡片 4：打卡率**
- **定义**：今日打卡人数 / 已报名活动的去重用户数
- **主数字**：X%
- **辅助信息**：目标 80%，当前差距 ±Y%
- **数据源**：
  ```sql
  -- 今日打卡人数
  SELECT COUNT(DISTINCT p.wx_user_id) as today_checkers
  FROM checkin_participants p
  JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
  WHERE date(r.checkin_date) = CURDATE();
  
  -- 已报名活动用户数
  SELECT COUNT(DISTINCT wx_user_id) as total_participants 
  FROM checkin_participants;
  ```

---

### 2.3 左侧主区域

#### **模块 1：近 30 天用户增长 & 打卡趋势（组合图）**

**功能描述：**
双轴组合图表，同时展示每日新增用户数和每日打卡人次，帮助观察拉新与活跃的关联性。

**图表类型：**
- 左轴（柱状图）：每日新增用户数
- 右轴（折线图）：每日打卡人次

**时间范围切换：**
- 支持"近 7 天 / 近 30 天 / 近 90 天"三个选项
- 默认显示近 30 天

**数据源：**
```sql
-- 每日新增用户
SELECT date(created_at) as day, COUNT(*) as new_users
FROM wx_users
WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY day ORDER BY day;

-- 每日打卡人次
SELECT date(checkin_date) as day, COUNT(*) as checkins
FROM checkin_records
WHERE status = 'approved' 
  AND checkin_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY day ORDER BY day;
```

**交互说明：**
- Hover 时显示具体数值
- 点击某一天可跳转到订单列表并筛选该日期范围（未来扩展）

**视觉要求：**
- 柱状图用蓝色系（#2563EB）
- 折线图用绿色系（#22C55E）
- 添加网格线便于读数

---

#### **模块 2：用户阶段分布（横向条形图）**

**功能描述：**
展示微信用户在各个转化阶段的人数分布，帮助识别运营瓶颈。

**阶段定义（按转化顺序）：**
1. 新朋友（new_friend）
2. 初步沟通（initial_chat）
3. 感兴趣（interested）
4. 已购买（purchased）
5. 在群里（in_group）
6. 复购（repurchased）
7. 沉默用户（silent）

**数据源：**
后端已有接口 `stageStats`，SQL 为：
```sql
SELECT stage, COUNT(*) as count 
FROM wx_users 
GROUP BY stage;
```

**展示方式：**
```
新朋友      ████████████  234人 (23%)
初步沟通    ████████      156人 (15%)
感兴趣      ██████        112人 (11%)
已购买      ████           78人 (8%)
在群里      ███            56人 (5%)
复购        ██             34人 (3%)
沉默用户    █████████      180人 (18%)
```

**交互说明：**
- 点击某个阶段，跳转到 `/wx-users` 并自动筛选该阶段
- Hover 显示百分比和具体人数

**视觉要求：**
- 不同阶段用不同颜色区分（参考现有配色）
- 按人数从多到少排序

---

#### **模块 3：热门打卡活动排行（表格）**

**功能描述：**
展示参与人数最多、打卡最活跃的活动排行，指导后续活动策划。

**展示字段：**
| 排名 | 活动名称 | 参与人数 | 累计打卡人次 | 人均打卡次数 |
|------|---------|---------|-------------|------------|

**数据源：**
```sql
SELECT a.name, 
       COUNT(DISTINCT p.wx_user_id) as participant_count,
       COUNT(r.id) as checkin_count,
       ROUND(COUNT(r.id) / COUNT(DISTINCT p.wx_user_id), 1) as avg_checkins_per_user
FROM activities a
JOIN checkin_participants p ON p.activity_id = a.id
JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
GROUP BY a.id
ORDER BY checkin_count DESC
LIMIT 10;
```

**交互说明：**
- 点击活动名称跳转到打卡详情页（未来扩展）
- 支持按"参与人数"或"打卡人次"排序

**视觉要求：**
- 前三名用 🥇🥈🥉 图标标识
- 表格行 hover 时高亮

---

### 2.4 右侧辅助区域

#### **模块 4：今日实时动态（滚动列表）**

**功能描述：**
像"心跳监测"一样实时展示最新业务动态。

**内容组成：**

**Part A：最新加入的微信用户（Top 5）**
- 昵称（或姓名）
- 加入时间（格式：HH:mm）
- 来源渠道（如果有记录）

**Part B：今日最新打卡记录（Top 10）**
- 用户昵称
- 打卡活动名称
- 打卡时间（格式：HH:mm）
- 审核状态（待审核/已通过/已拒绝）

**数据源：**
```sql
-- 最新用户
SELECT COALESCE(NULLIF(name, ''), nickname, child_name, '') as display_name,
       created_at, source_channel
FROM wx_users
ORDER BY created_at DESC
LIMIT 5;

-- 最新打卡
SELECT COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') as user_name,
       a.name as activity_name,
       r.checkin_date,
       r.status
FROM checkin_records r
JOIN checkin_participants p ON r.participant_id = p.id
JOIN wx_users u ON p.wx_user_id = u.id
JOIN activities a ON p.activity_id = a.id
WHERE date(r.checkin_date) = CURDATE()
ORDER BY r.checkin_date DESC
LIMIT 10;
```

**交互说明：**
- 每 30 秒自动刷新（可选开关）
- 手动刷新按钮（右上角）
- 点击用户昵称跳转到微信用户详情

**视觉要求：**
- 用时间轴样式展示
- 新用户用绿色圆点标记，打卡记录用蓝色圆点

---

#### **模块 5：用户来源渠道分析（饼图）**

**功能描述：**
了解用户从哪里来，优化投放策略。

**图表类型：**
环形饼图（Donut Chart）+ 百分比标签

**数据源：**
```sql
SELECT source_channel, COUNT(*) as count
FROM wx_users
WHERE source_channel IS NOT NULL AND source_channel != ''
GROUP BY source_channel
ORDER BY count DESC;
```

**示例数据：**
- 微信群分享 45%
- 朋友圈海报 30%
- 老用户推荐 15%
- 其他 10%

**交互说明：**
- Hover 显示具体人数
- 点击某个渠道可筛选用户列表（未来扩展）

**视觉要求：**
- 用柔和的渐变色区分不同渠道
- 中心显示总人数

---

#### **模块 6：打卡达人榜（Top 10 排行榜）**

**功能描述：**
激励用户持续打卡，也可用于评选优秀学员。

**展示字段：**
- 排名（🥇🥈🥉 + 数字）
- 用户头像（如有）
- 用户昵称
- 累计打卡次数

**数据源：**
```sql
SELECT u.id, 
       COALESCE(NULLIF(u.name, ''), u.nickname, u.child_name, '') as display_name,
       u.avatar_url,
       COUNT(r.id) as checkin_count
FROM wx_users u
JOIN checkin_participants p ON p.wx_user_id = u.id
JOIN checkin_records r ON r.participant_id = p.id AND r.status = 'approved'
GROUP BY u.id
ORDER BY checkin_count DESC
LIMIT 10;
```

**交互说明：**
- 点击用户跳转到微信用户详情页
- 前三名有特殊徽章标识

**视觉要求：**
- 前三名用金色/银色/铜色背景
- 头像圆形裁剪，无头像则显示首字母

---

#### **模块 7：需跟进用户提醒（精简版）**

**功能描述：**
防止重要客户流失，只显示最需要跟进的用户。

**展示逻辑：**
- 只显示 VIP 用户 或 超过 15 天未跟进的用户
- 最多显示 5 条

**展示字段：**
- 用户昵称
- 重要性标签（VIP/普通）
- 最后跟进时间（格式：X 天前）
- 下次沟通主题（如果有记录）

**数据源：**
后端已有接口 `needFollowUsers`，SQL 逻辑为：
```sql
SELECT id, 
       COALESCE(NULLIF(name, ''), nickname, child_name, '') as name,
       stage, importance, last_follow_date, next_talk_topic
FROM wx_users
WHERE (importance = 'vip' OR last_follow_date < DATE_SUB(CURDATE(), INTERVAL 15 DAY))
  AND stage != 'purchased' 
  AND stage != 'repurchased'
ORDER BY CASE importance WHEN 'vip' THEN 1 ELSE 2 END,
         last_follow_date ASC
LIMIT 5;
```

**交互说明：**
- 点击用户跳转到微信用户详情页
- 标记为"已跟进"后从列表移除（未来扩展）

**视觉要求：**
- VIP 用户用红色边框高亮
- 超过 30 天未跟进的用橙色警告标识

---

## 三、技术实现

### 3.1 后端接口设计

**接口地址：** `GET /api/dashboard`

**请求参数：**
```typescript
{
  trendDays?: 7 | 30 | 90;  // 趋势图时间范围，默认 30
}
```

**返回数据结构：**
```typescript
interface DashboardData {
  // 顶部核心指标
  stats: {
    total_wx_users: number;
    today_new_wx_users: number;
    yesterday_new_wx_users: number;  // 用于计算趋势
    total_checkins: number;
    today_checkins: number;
    week_checkins: number;
    active_users_7d: number;
    checkin_rate: number;  // 百分比，0-100
    total_participants: number;  // 已报名活动用户数
  };

  // 近 N 天趋势数据
  newUserTrend: Array<{ date: string; count: number }>;
  checkinTrend: Array<{ date: string; count: number }>;

  // 用户阶段分布
  stageStats: Array<{ stage: string; count: number }>;

  // 热门打卡活动
  popularActivities: Array<{
    name: string;
    participant_count: number;
    checkin_count: number;
    avg_checkins_per_user: number;
  }>;

  // 今日实时动态
  recentUsers: Array<{
    display_name: string;
    created_at: string;
    source_channel?: string;
  }>;

  recentCheckins: Array<{
    user_name: string;
    activity_name: string;
    checkin_date: string;
    status: string;
  }>;

  // 用户来源渠道
  sourceChannels: Array<{
    channel: string;
    count: number;
  }>;

  // 打卡达人榜
  topCheckinUsers: Array<{
    id: number;
    display_name: string;
    avatar_url?: string;
    checkin_count: number;
  }>;

  // 需跟进用户
  needFollowUsers: Array<{
    id: number;
    name: string;
    stage: string;
    importance: string;
    last_follow_date?: string;
    next_talk_topic?: string;
  }>;
}
```

---

### 3.2 前端组件结构

**文件路径：** `src/pages/Dashboard.tsx`

**组件拆分：**
```tsx
Dashboard
├── KPICards (顶部 4 个核心指标卡片)
│   ├── KPICard ({ title, value, subtext, trend, onClick })
│   └── ...
├── MainGrid (左右两栏布局)
│   ├── LeftPanel (2/3 宽度)
│   │   ├── TrendChart (近 N 天增长&打卡趋势)
│   │   ├── StageDistribution (用户阶段分布)
│   │   └── PopularActivities (热门打卡活动排行)
│   └── RightPanel (1/3 宽度)
│       ├── RealtimeFeed (今日实时动态)
│       ├── SourceChannelPie (用户来源渠道分析)
│       ├── CheckinLeaderboard (打卡达人榜)
│       └── FollowUpReminders (需跟进用户提醒)
```

**状态管理：**
```typescript
const { dashboard, loadDashboard } = useStore();

// 本地状态
const [trendDays, setTrendDays] = useState<7 | 30 | 90>(30);
const [lastRefreshTime, setLastRefreshTime] = useState<Date>();
```

**数据获取：**
```typescript
useEffect(() => {
  loadDashboard({ trendDays });
}, [trendDays]);
```

---

### 3.3 数据库查询优化

**性能要求：**
- 所有查询必须在 100ms 内完成
- 建议添加以下索引：

```sql
-- wx_users 表
CREATE INDEX IF NOT EXISTS idx_wx_users_created_at ON wx_users(created_at);
CREATE INDEX IF NOT EXISTS idx_wx_users_stage ON wx_users(stage);
CREATE INDEX IF NOT EXISTS idx_wx_users_importance ON wx_users(importance);
CREATE INDEX IF NOT EXISTS idx_wx_users_last_follow ON wx_users(last_follow_date);
CREATE INDEX IF NOT EXISTS idx_wx_users_source ON wx_users(source_channel);

-- checkin_records 表
CREATE INDEX IF NOT EXISTS idx_checkin_records_date ON checkin_records(checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkin_records_status ON checkin_records(status);

-- checkin_participants 表
CREATE INDEX IF NOT EXISTS idx_checkin_participants_wx_user ON checkin_participants(wx_user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_participants_activity ON checkin_participants(activity_id);
```

---

### 3.4 缓存策略

**后端缓存：**
- 驾驶舱数据缓存 5 分钟（Redis 或内存缓存）
- 缓存键：`dashboard:{trendDays}`
- 例外：实时动态部分不缓存，每次请求都查最新数据

**前端缓存：**
- 使用 React Query 或 SWR 进行数据缓存
- 静默后台刷新（stale-while-revalidate）

---

## 四、UI/UX 设计规范

### 4.1 色彩系统

**主色调：**
- 品牌蓝：#2563EB（用于用户相关）
- 成功绿：#22C55E（用于打卡相关）
- 警告橙：#F59E0B（用于需跟进提醒）
- 危险红：#EF4444（用于异常警示）

**背景色：**
- 页面背景：#F9FAFB
- 卡片背景：#FFFFFF
- 卡片边框：#E5E7EB

**文字颜色：**
- 主标题：#111827
- 次要文字：#6B7280
- 辅助文字：#9CA3AF

---

### 4.2 字体规范

**数字显示：**
- 大数字（KPI 卡片）：32px, font-weight: 700
- 中等数字（图表标签）：18px, font-weight: 600
- 小数字（辅助信息）：14px, font-weight: 500

**文字显示：**
- 模块标题：16px, font-weight: 600
- 正文：14px, font-weight: 400
- 辅助说明：12px, font-weight: 400

---

### 4.3 间距规范

**卡片内边距：**
- 上下：24px
- 左右：20px

**卡片间距：**
- 顶部 KPI 卡片之间：16px
- 左右面板之间：24px
- 模块之间：24px

---

### 4.4 动画效果

**入场动画：**
- 卡片从下往上淡入（duration: 0.4s, ease: cubic-bezier(0.16, 1, 0.3, 1)）
-  stagger 延迟：每个卡片延迟 0.05s

**交互动画：**
- Hover 时卡片轻微上浮（translateY: -2px）+ 阴影加深
- 数字变化时用滚动动画（react-countup）

**加载状态：**
- 骨架屏（Skeleton）占位
- 图表加载时显示旋转 spinner

---

## 五、数据埋点与监控

### 5.1 用户行为埋点

**需要追踪的事件：**
- `dashboard_view`：页面浏览
- `kpi_card_click`：点击 KPI 卡片（记录哪个卡片）
- `trend_period_switch`：切换趋势图时间范围
- `stage_filter_click`：点击用户阶段筛选
- `user_detail_navigate`：从驾驶舱跳转到用户详情

**埋点工具：**
- 使用现有的埋点系统（如有）
- 或集成 Google Analytics / 神策分析

---

### 5.2 性能监控

**关键指标：**
- 页面首次加载时间（FCP）：< 1.5 秒
- 接口响应时间：< 200ms（P95）
- 图表渲染时间：< 500ms

**监控工具：**
- Sentry（错误监控）
- Web Vitals（性能监控）

---

## 六、测试计划

### 6.1 单元测试

**后端测试：**
- 测试 `/api/dashboard` 接口返回数据结构正确性
- 测试各种边界情况（如无用户、无打卡记录时）

**前端测试：**
- 测试组件渲染是否正常
- 测试数据为空时的兜底展示

---

### 6.2 集成测试

**测试场景：**
1. 正常数据加载流程
2. 接口超时/失败时的错误处理
3. 时间范围切换功能
4. 点击跳转功能
5. 自动刷新功能

---

### 6.3 兼容性测试

**浏览器兼容：**
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

**分辨率兼容：**
- 1920×1080（主流桌面）
- 1366×768（笔记本）
- 2560×1440（高分屏）

---

## 七、上线计划

### 7.1 开发排期

| 阶段 | 任务 | 负责人 | 工时 |
|------|------|--------|------|
| Phase 1 | 后端接口开发 | 后端开发 | 2 天 |
| Phase 2 | 前端页面重构 | 前端开发 | 3 天 |
| Phase 3 | UI 精修与动画 | 前端开发 | 1 天 |
| Phase 4 | 联调与测试 | 前后端共同 | 1 天 |
| Phase 5 | Bug 修复与优化 | 前后端共同 | 1 天 |

**总计：** 8 个工作日

---

### 7.2 灰度发布

**第一阶段（内部测试）：**
- 部署到测试环境
- 内部团队试用 2 天
- 收集反馈并修复问题

**第二阶段（小范围上线）：**
- 对 10% 用户开放新功能
- 监控性能和错误率
- 运行 3 天

**第三阶段（全量上线）：**
- 对所有用户开放
- 保留旧版入口 1 周（作为回滚方案）

---

### 7.3 回滚方案

**触发条件：**
- 接口错误率 > 5%
- 页面加载时间 > 5 秒
- 客户明确反馈不可用

**回滚步骤：**
1. 切换流量到旧版接口
2. 前端回滚到上一个稳定版本
3. 通知客户并道歉

---

## 八、风险与应对

### 8.1 技术风险

**风险 1：数据库查询慢**
- **影响：** 页面加载超时
- **应对：** 
  - 提前添加索引
  - 实施缓存策略
  - 设置查询超时保护（5 秒）

**风险 2：数据量过大导致图表卡顿**
- **影响：** 用户体验差
- **应对：**
  - 限制返回数据量（最多 90 天）
  - 使用虚拟滚动（如需要）
  - 图表降级为简化版

---

### 8.2 业务风险

**风险 1：客户不接受新设计**
- **影响：** 需要重新设计
- **应对：**
  - 开发前与客户确认原型图
  - 提供旧版入口作为过渡

**风险 2：某些数据字段缺失**
- **影响：** 部分模块无法展示
- **应对：**
  - 提前检查数据完整性
  - 设计兜底方案（如"暂无数据"提示）

---

## 九、后续迭代规划

### 9.1 Phase 2（上线后 1 个月）

**新增功能：**
- 导出驾驶舱报表（PDF/Excel）
- 自定义看板（用户可选择显示哪些模块）
- 数据对比功能（如本月 vs 上月）

---

### 9.2 Phase 3（上线后 3 个月）

**新增功能：**
- AI 智能洞察（自动识别异常并给出建议）
- 预测模型（如下月预计新增用户数）
- 移动端适配（手机/平板查看）

---

## 十、附录

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| 微信用户 | 在 `wx_users` 表中记录的用户 |
| 打卡人次 | 审核通过的打卡记录数（同一用户多次打卡累加） |
| 活跃用户 | 近 7 天有至少 1 次打卡的去重用户 |
| 打卡率 | 今日打卡人数 / 已报名活动的去重用户数 |
| 用户阶段 | 用户在转化漏斗中的位置（新朋友 → 初步沟通 → ... → 复购） |

---

### 10.2 参考资料

- [现有驾驶舱代码](../src/pages/Dashboard.tsx)
- [后端 API 代码](../api/app.ts)
- [数据库 Schema](../api/db.ts)
- [用户反馈记录](../../memory/admin-wx-user-list-polish.md)

---

**文档结束**

# Phase 2 深度方案：一致性收口

**文档性质**：迭代方案（供决策，非代码改动记录）
**基于事实**：2026-09-14 对 `/api`、`/src`、`/tests` 当前代码的逐项核实 + 2026-09-01《产品阶段性独立评审报告》对比
**适用前提**：Phase 1（安全收口 + 驾驶舱工作台化 + 小程序习惯引擎）已就绪或并行推进中

---

## 一、结论先行

Phase 2 的题眼是"**让后台配得上小程序，让已删的数据真消失，让测试真能信**"。它不是加功能，是把已经存在但散落、断裂、各说各话的东西收成一套可信的整体。

本轮核实发现：**09-01 评审以来的代码已在动**，且与评审结论有显著分叉。因此本方案**不照抄评审**，而是以当前代码实测状态为基线重排优先级。

**四大必做项 + 一项信任项**：

| 编号 | 工作流 | 性质 | 工作量 | 杠杆 |
|---|---|---|---|---|
| P2-A | 后台品牌主色统一（去 indigo/blue 冲突色） | 视觉一致性 | 中 | 高（"一眼认出是同一个产品"） |
| P2-B | 顶栏装饰性界面清除（假搜索/红点/硬编码邮箱） | 专业感/信任 | 小 | 高（第一印象） |
| P2-C | 导航补全（订单/账号/直播进侧边栏 + 待审角标） | 信息架构 | 小 | 高（功能可见性） |
| P2-D | 软删除链路补全（列表查询加 deleted 过滤） | 合规 | 中 | 必做（法律风险级） |
| P2-E | 测试跑通 + 补边界回归（软删/越权） | 信任地基 | 中 | 高（CI 绿才可信） |

---

## 二、事实基线：当前代码 vs 09-01 评审

下表区分**实测事实**（本次核实）与评估，避免把已修复的项重复列入。

### 2.1 已修复（本轮实测确认，Phase 2 不再做）

| 项 | 证据 | 说明 |
|---|---|---|
| 跨身份越权 | `api/app.ts:2141` 小程序登录带 `type:'wx'`；`authMiddleware` 校验 `user.type!=='admin'` 返回 401；删除端点挂 `adminOnly` | 评审头号 P0 已在代码层修复，但**仍需一次运行时鉴权测试坐实**（见 P2-E） |
| 退出登录清 token | `src/components/Layout.tsx:211` 调用 `logout()` | 评审"退出不清 token"已修复 |
| 集成测试转向活体 | `tests/integration/` 引用真实表（`wx_users`/`orders`/`points_ledger`/`checkin_events` 等）+ 真实 service（`user-delete.service`/`auth`） | 评审"对着虚构 schema 的死测试"已不存在 |
| 影子架构关键词消失 | 全仓库 Grep `repositories`/`registerAllRoutes` 零匹配 | 评审"从未接线的三层架构"已清理或从未接线 |
| Dashboard 死按钮清除 | 全仓库 Grep `alert(`/`查看更多` 零匹配 | 评审"热门活动排行整行 alert 查看更多"已清除 |

### 2.2 半修复（路由在、入口不在）

| 项 | 证据 | 缺口 |
|---|---|---|
| 订单/账号/直播 | `src/App.tsx:81/83/84` 已注册 `/orders` `/live` `/users` 路由 | `src/components/Layout.tsx:23-57` 的 `navSections` 仍无这三个入口 → 页面存在但用户进不去（P2-C） |

### 2.3 未动（Phase 2 主战场）

| 项 | 证据 | 影响 |
|---|---|---|
| 顶栏装饰性界面 | `Layout.tsx:143-155` 假搜索框（`<input>` 无 onChange/提交）；`:166-169` 常亮红点（无逻辑）；`:181-199` 硬编码"管理员/超级管理员/admin@example.com" | 一眼暴露"还没团队在认真用" |
| 页面硬编码 5 套主色 | 全后台普遍：`ChildDetail` 219 处、`LearningPathConfig` 130、`CheckinDetail` 109、`Dashboard` 69、`GroupManagement` 77、`ProductList` 64、`LiveDesk` 63、`MaterialLibrary` 50；`CheckinList` 内联 `#2563EB` 蓝 + `#5B5CE2` 紫混搭 | "三个团队做的四个产品"的拼装感根源 |
| ui 组件库零消费 | `components/ui/` 13 个组件，仅 `Loading` 被 8 个页面引用；`Button`/`Card`/`Badge`/`Status` 等 12 个零引用 | 设计系统"存在于 CSS，不存在于产品" |
| 软删除列表零过滤 | 全仓库 Grep `deleted_at IS NULL` / `is_deleted=0` **零匹配**；`user-delete.service.ts` 已标记 `deleted_at`，但列表查询不过滤 | 已"删除"的用户/数据仍在前台出现 = 合规事故 |
| 测试能否跑通未验证 | 测试已指向活代码，但**未实测是否 green** | "假绿"风险仍在，需 P2-E 坐实 |

---

## 三、各工作流详细方案

### P2-A 后台品牌主色统一（去拼装感核心）

**目标**：全后台共享同一套品牌主色，去掉与 token 紫（`#5B5CE2`）冲突的 indigo/blue，使后台与小程序/彼此之间视觉同源。

**原则（重要，避免无底洞）**：
- **冲突主色必改**：`indigo-*`、`blue-*`、`#2563EB`、`from-indigo-500 to-blue-500` 等品牌色 → 统一映射到 token（`primary` / `primary-soft` / `gradient-brand`）。
- **中性色可渐进**：`slate-*`、`bg-white`、`text-gray-*` 在 light 主题下与 token 视觉接近，**不强制全改**（强改是体力活、易回归、ROI 低）。统一用 token 变量类（`text-text-primary/secondary`、`bg-bg-surface`）作为新代码的规范，存量中性色随业务改动顺手迁移。
- **语义色保留**：`red-500`/`green-` 用于销毁/成功按钮是合法的，映射到 `danger`/`success` token 即可。

**改动清单（按冲突集中度排序）**：

| 文件 | 冲突主色处数 | 重点 |
|---|---|---|
| `src/pages/LearningPathConfig.tsx` | ~130 | 整页 indigo/blue/white/slate 体系，副标题仍写"驱动自动跟进"（空头文案，见 P2-C 备注） |
| `src/pages/CheckinList.tsx` | ~10 + 内联 | `style` 内联 `#2563EB`/`#60A5FA` 渐变、SVG `#5B5CE2` |
| `src/pages/ChildDetail.tsx` | 219（多为 slate 中性） | 优先改其中的 indigo/blue 冲突色，中性色渐进 |
| `src/pages/CheckinDetail.tsx` | 109（多为 slate 中性） | 同上 |
| `src/pages/Dashboard.tsx` | 69 | 复用 `.t-*`/`.card`/`.btn-*` token 类 |
| `src/pages/GroupManagement.tsx` | 77 | 同上 |
| `src/pages/ProductList.tsx` | 64 | 同上 |
| `src/pages/LiveDesk.tsx` | 63 | 同上 |
| 其余（MaterialLibrary 50 / WxUserDetail 2 / WxUserList 9 / UserManagement 14 / Login 3 / Settings 2） | 累计 ~78 | 顺手收口 |

**验收标准**：
1. 全后台 Grep `indigo-|blue-5|#2563EB|#60A5FA|from-indigo|to-blue` 归零（或仅剩语义性残留并登记）。
2. 任意两个后台页面截图并排，主色一致（紫 `#5B5CE2` 体系），无蓝/靛冲突。
3. 配合 P2-B/C 后，后台与小程序的"去掉 Logo 能否认出同一产品"问题显著缓解。

**工作量**：约 3~4 个工作日（可脚本辅助替换冲突色 + 人工校对关键页面）。

---

### P2-B 顶栏装饰性界面清除（信任第一印象）

**目标**：消除"还没团队在认真用"的视觉信号。

**改动清单（全部在 `src/components/Layout.tsx`）**：

| 行 | 现状 | 处置 |
|---|---|---|
| `:143-155` 假搜索框 | `<input placeholder="搜索用户、商品、订单...">` 无任何事件/提交/连接 | 二选一：① 接真实全局搜索（后端若已有搜索接口则接线，否则先做"跳转到对应列表页并带关键词"的最小可用版）；② 若 Phase 2 不做搜索，直接移除输入框，避免"假控件" |
| `:166-169` 常亮红点 | `<span className="...bg-danger...">` 永远亮着，无数据驱动 | 接真实通知数（待审/待跟进），为 0 时隐藏；或 Phase 2 先移除红点 |
| `:181-199` 硬编码身份 | "管理员 / 超级管理员 / admin@example.com" 写死 | 改为读取 `useStore` 当前登录用户（`loadCurrentUser` 已在 `App.tsx` 调用），展示真实 display_name / role / email |

**验收标准**：顶栏无永不响应的控件、无写死的管理员身份。

**工作量**：约 0.5~1 个工作日。

---

### P2-C 导航补全（功能可见性）

**目标**：让已上线的订单、账号管理、直播工作台"对用户存在"。

**改动清单（`src/components/Layout.tsx` 的 `navSections`）**：

1. 补三个 `NavItem`：`/orders`（交易管理分组，与商品并列）、`/users`（系统分组，账号管理）、`/live`（用户运营或独立分组，直播工作台）。
2. **待审角标**：`NavItem.badge` 属性已定义但未使用。把后端"待审核打卡数"接入驾驶舱已算好的统计，亮到打卡/审核相关入口（具体接哪个入口由高师傅定：建议挂在"打卡统计"或新增"审核"入口）。

**备注（产品判断，非技术债）**：`LearningPathConfig.tsx:226` 副标题仍写"规划学科学习阶段，关联产品，**驱动自动跟进**"——评审已确认"自动跟进"代码不存在。本次收口**不实现自动跟进**，但应把这句误导文案改掉（改为"规划学科学习阶段，关联产品"），否则是"承诺了没做的空头功能"继续挂在前台。

**验收标准**：左侧导航能直达订单/账号/直播三页；待审数有角标外露（或明确决定不外露并登记）。

**工作量**：约 0.5~1 个工作日。

---

### P2-D 软删除链路补全（合规硬要求）

**目标**：既然对监管/用户承诺了"可删除数据"，就必须真删得掉、删后不可见。

**事实**：`user-delete.service.ts` 已正确标记 `deleted_at` 并级联子表；但**所有列表查询不过滤 `deleted_at IS NULL`**，导致已删记录仍返回前台。`checkin_events` 用了另一套 `is_deleted` 字段（回收站查询 `app.ts:1776` 用 `is_deleted=1`），两套字段并存，需对齐。

**改动清单**：

1. **逐表核查 + 加过滤**（按表列清单，避免漏）：
   - `wx_users`：列表/详情/驾驶舱 `needFollowUsers`/`recentUsers` 查询加 `deleted_at IS NULL`
   - `children` / `follow_ups` / `orders` / `products` / `materials` / `wechat_groups` / `checkin_records`：列表查询加对应 deleted 过滤
   - 注意 `checkin_events` 用 `is_deleted`（0/1），其余用 `deleted_at`（NULL/时间戳）——**先统一字段语义**（建议全量改用 `deleted_at`，或至少在查询层分别处理且不留例外）
2. **回收站/批量删除端点**：确认 `app.ts:1768-1784` 的 `is_deleted` 回收站查询与恢复端点已注册可用；`user-delete.service.ts` 的 `getExpiredSoftDeletedUsers` 清理策略（90 天保留）需有明确触发方（定时任务 or 手动），否则永不清。
3. **审计可见性**：软删后数据仍存（用于审计），但前台所有列表不可见——用集成测试固化（见 P2-E）。

**验收标准**：
- 软删一个 `wx_user` 后，列表/驾驶舱/搜索均不再出现该用户。
- 全仓库列表查询 Grep 确认每个含软删字段的表都有对应过滤（登记清单，零例外）。
- 一条集成测试固化"软删后列表不返回"。

**工作量**：约 2~3 个工作日（含逐表核查 + 测试）。

**风险**：列表查询分散在 3710 行的 `app.ts` 单体里，逐个改易漏。建议配套一个"软删表 → 查询点"清单作为改动 checklist，改完逐项勾。

---

### P2-E 测试跑通 + 补边界回归（信任地基）

**目标**：把"可能假绿"变"真绿"，并锁住最贵的两条不变量（越权已修、软删已通）。

**事实**：`tests/unit`（group/product/child/dashboard service）与 `tests/integration`（user-delete/order/checkin/auth）已指向活体代码，比评审时好。**但未实测是否真能跑通**。

**改动清单**：

1. **跑通现有套件**：`vitest run` 全量执行，修复任何失败（这是把"假绿"坐实为"真绿"的第一步，也是本方案最该先做的验证动作——若现有测试已红，说明代码比评审时更糟，需立即上报）。
2. **补两条回归测试（高杠杆）**：
   - **越权回归**：用小程序 `type:'wx'` token 请求 `/api/wx-users`/删除类端点，断言 401。锁住 P1 已修的越权，防止回滚。
   - **软删回归**：软删后列表查询断言不返回已删记录。锁住 P2-D。
3. **CI 门禁**：若已有 CI，确保 `vitest` 是必过门禁；若无，先把本地 `npm test` 作为发版前人工门禁写进 `RELEASE_CHECKLIST.md`。

**验收标准**：`vitest run` 全绿；两条新回归测试存在且绿；发版清单含"测试必过"。

**工作量**：约 1.5~2 个工作日（含修红）。

---

## 四、实施顺序与里程碑

建议分两个子冲刺，避免一次性改动面过大导致回归难查：

**冲刺 2.1（约 1 周）— 信任与可见性（低风险、高杠杆）**
1. P2-E 先跑通测试（确认基线是否绿）→ 这是后续所有改动的安全网
2. P2-B 顶栏装饰性界面清除
3. P2-C 导航补全 + 待审角标 + 改"自动跟进"误导文案
4. P2-A 品牌主色统一（先冲突主色 indigo/blue，中性色渐进）

**冲刺 2.2（约 1~1.5 周）— 合规与锁定（中风险、必做）**
5. P2-D 软删除链路补全（逐表 + 测试固化）
6. P2-E 补越权/软删回归测试
7. P2-A 收尾（剩余页面中性色顺手迁移）

**总工作量估算**：约 2.5~3.5 周（单人，含测试与回归）。不阻塞 Phase 1 的安全项。

---

## 五、明确不做（防范围蔓延）

- **不重做页面布局/交互**：只收颜色与控件一致性，不重构信息架构以外的 UX。
- **不强改中性色（slate/white）全量**：保留可读性，只规范新代码 + 顺手迁移。
- **不实现"学习路径自动跟进"**：Phase 2 只改掉误导文案，功能本身属 P1/P2 范围外，需单独立项。
- **不做多租户/RBAC/支付**（评审 P2 明确暂缓）：等第二家机构付费意愿验证后。
- **不碰 `app.ts` 单体拆分**：软删过滤在现有单体里加，不借机重构（避免引入新风险）。

---

## 六、待高师傅拍板的决策点

1. **P2-B 假搜索框**：接真实搜索（需确认后端有无搜索接口）还是直接移除？我倾向 Phase 2 先移除假控件，搜索作为独立小功能后续做。
2. **P2-C 待审角标**：挂哪个入口？（建议"打卡统计"或新增"审核"导航项）
3. **P2-D 字段语义**：`checkin_events` 的 `is_deleted` 与其余表的 `deleted_at` 是否统一为 `deleted_at`？（统一更干净，但改动面略大）
4. **P2-A 中性色**：是否同意"冲突色必改、中性色渐进"的边界？（若要求全量 token 化，工作量翻倍且 ROI 低，我不建议）

---

## 七、风险与回滚

- **颜色替换回归**：P2-A 用脚本批量替换冲突色后，需人工校对关键页面（ChildDetail/CheckinDetail/LearningPathConfig）无样式崩坏。回滚：git 单文件 revert。
- **软删过滤漏改**：清单化逐表勾选 + 集成测试固化，漏改会被测试拦截。
- **测试基线若红**：P2-E 第一步若发现现有测试已红，立即暂停并报高师傅——说明代码状态比 09-01 更需关注，不应在红基线上叠加改动。

---

*本方案全部"事实"均来自 2026-09-14 对当前代码的逐项核实（行号/Grep 结果可复核），"建议/判断"已在本文件中明确标注，不混入事实。*

---

## 八、执行记录（phase2-consistency 分支，2026-09-14）

**重要更正（P2-D 真实状态）**：执行时复核实测发现，原方案 2.3 节"软删除列表零过滤"的前提**不成立**——运行时 schema（`api/db.ts`）里 `wx_users` 及其级联子表（`children`/`orders`/`follow_ups`/`checkin_records`/`checkin_participants` 等）**根本不存在 `deleted_at` 列**。仅有 `checkin_events` 同时有 `is_deleted`+`deleted_at` 且过滤正确。因此 `user-delete.service.ts` 的 `UPDATE wx_users SET deleted_at = ?` 在首条语句即抛 `no such column: deleted_at`——软删功能在运行时是**整体坏的**（不是"标了但没过滤"，而是"标不上"）。原判断源于一次 grep 假阴性（`\|` 在 BRE 里匹配字面竖线），已在执行时纠正。

**P2-D 实际落地（已合并进分支）**：
1. **补齐列（schema 修复）**：`api/db.ts` 在 checkin_events ALTER 块后新增幂等守卫，给 9 张被软删级联触及的表补齐 `deleted_at TEXT`（已存在则跳过）。这是让软删真正能跑通的前提。
2. **列表/统计/搜索过滤**：在 `api/app.ts` 与 `api/services/dashboard.service.ts` 的全部用户可见查询（wx_users 列表/搜索/getTodos 工作台、dashboard 各项 KPI 与排行、orders/follow_ups/children 列表、recentCheckins）注入 `deleted_at IS NULL` 过滤。注入点包括 `wx_users` 列表的 `buildWhere` 基础条件（一处覆盖 4 个查询）。
3. **回归测试**：新增 `tests/unit/soft-delete-filter.test.ts`（5 例），锁住"软删后驾驶舱与列表不再返回该用户及其级联子记录"；并修复 `dashboard.service.test.ts` 对已重构字段 `stageStats` 的过时断言（改为 `activityDistribution`）。

**执行中捕获的 bug（测试救场）**：首版注入在 `FROM wx_users u ... LEFT JOIN / JOIN` 之间插了 `WHERE deleted_at IS NULL`，违反 SQL"WHERE 必须在 JOIN 之后"的语法，导致 `activityDistribution` 与 `topCheckinUsers` 两处子查询报 `near "LEFT": syntax error`。已由回归测试暴露并修正为"WHERE 置于 JOIN 之后、GROUP BY 之前"。app.ts 与 dashboard.service.ts 各 2 处，共 4 处。

**测试结果（node 26 跑 vitest）**：完整套件 87 通过 / 4 失败 / 3 跳过（基线 73/5/3）。新增 + 修复共净增约 14 个通过；4 个残留失败均为集成 e2e（`auth`/`order`/`checkin`）需后端在 :3456 运行，属环境性失败（基线已如此），非本次引入。

**已知残留（未在本分支做，待高师傅定）**：
- `checkin_events` 用 `is_deleted`（0/1），其余表用 `deleted_at`（NULL/时间戳），两套字段并存未统一（方案决策点 #3 选了"分别处理、不留例外"）。
- 小程序按 `openid` 登录查询未过滤 `deleted_at`：已软删用户仍可用同一微信登录看到自己的数据。是否阻断属产品决策（且可能涉及同微信重新注册），未动。
- 越权（P1）回归测试未补：集成 e2e 需起服务，本环境未起；现有 `security.test.ts` 未覆盖 401，留待 CI 接入后端后补。

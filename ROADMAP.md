# LearnGrow CRM 商业化迭代路线图

**最后更新:** 2026-08-30  
**当前版本:** v2.6.0 (管理端) / v3.6.0 (小程序)  
**目标:** 3个月内完成商业化准备，支撑10+机构私有化部署

---

## 版本策略说明

### 版本号规范
采用语义化版本 `MAJOR.MINOR.PATCH`:
- **MAJOR**: 架构级变更或不兼容更新（如多租户改造）
- **MINOR**: 新功能向后兼容（如新增API接口）
- **PATCH**: Bug修复和小优化

### 双版本管理
- **管理端版本**: `package.json` 中的 `version` 字段
- **小程序版本**: `miniprogram/config.js` 中的 `APP_VERSION`
- 两者独立维护，但在发版记录中关联说明

---

## 迭代计划总览

| 版本 | 主题 | 时间窗口 | 核心目标 | 风险等级 |
|------|------|---------|---------|---------|
| **v2.7.0** | 安全合规加固 | 2026-09-01 ~ 09-07 | 消除致命安全风险，满足法律合规 | 🔴 高 |
| **v2.8.0** | API文档与测试 | 2026-09-08 ~ 09-14 | 补充核心接口文档，测试覆盖率达70% | 🟡 中 |
| **v2.9.0** | 架构模块化重构 | 2026-09-15 ~ 09-30 | 拆分单体文件，开启TS严格模式 | 🔴 高 |
| **v3.0.0** | 数据库迁移系统 | 2026-10-01 ~ 10-07 | 引入Drizzle Kit，建立迁移流程 | 🟡 中 |
| **v3.1.0** | CI/CD自动化 | 2026-10-08 ~ 10-14 | GitHub Actions自动部署+健康检查 | 🟢 低 |
| **v3.2.0** | 监控告警体系 | 2026-10-15 ~ 10-21 | Sentry接入，关键指标告警 | 🟢 低 |
| **v3.3.0** | 性能优化 | 2026-10-22 ~ 10-31 | Dashboard缓存，bundle优化 | 🟢 低 |
| **v4.0.0** | 多租户隔离 | 2026-11-01 ~ 11-15 | 支持多机构数据隔离 | 🔴 高 |
| **v4.1.0** | 订阅付费功能 | 2026-11-16 ~ 11-30 | 微信支付集成，套餐管理 | 🟡 中 |
| **v4.2.0** | 权限分级控制 | 2026-12-01 ~ 12-07 | 细粒度角色权限 | 🟡 中 |

---

## 详细迭代计划

### v2.7.0 - 安全合规加固
**时间:** 2026-09-01 ~ 09-07 (7天)  
**负责人:** 后端开发 + 前端开发  
**优先级:** P0 (阻塞商业化)

#### 需求清单
- [ ] **密钥轮换与安全检查**
  - 生成新的JWT_SECRET(≥32字符)
  - 重新生成微信密钥
  - 检查git历史确认.env未泄露
  - 更新服务器配置并验证功能
  
- [ ] **隐私政策页面实现**
  - 小程序 `/pages/privacy/privacy` 页面内容
  - 明确说明收集信息及用途
  - 管理端增加隐私政策链接
  
- [ ] **用户数据删除接口**
  - `DELETE /api/wx-users/:id` 级联删除
  - 软删除策略(deleted_at标记)
  - 管理端UI二次确认弹窗
  
- [ ] **备份加密**
  - AES256加密zip包
  - 恢复脚本支持解密
  - 环境变量管理加密密钥

#### 验收标准
- ✅ 所有密钥已轮换且服务正常运行
- ✅ git历史无敏感信息泄露
- ✅ 隐私政策页面可访问且内容完整
- ✅ 删除用户后关联数据全部清理
- ✅ 备份文件加密后可正常恢复
- ✅ 通过安全扫描工具检查(如npm audit)

#### 风险与预案
| 风险 | 概率 | 影响 | 预案 |
|------|------|------|------|
| 密钥轮换导致登录失败 | 中 | 高 | 保留旧密钥24小时回滚窗口 |
| 级联删除遗漏表 | 低 | 高 | 编写外键约束测试用例 |
| 加密后备份体积过大 | 低 | 中 | 先压缩再加密 |

#### 交付物
- `docs/PRIVACY_POLICY.md` - 隐私政策文档
- `scripts/rotate-keys.ts` - 密钥轮换脚本
- `api/routes/user-delete.ts` - 删除接口实现
- 更新的 `.env.example` 模板

---

### v2.8.0 - API文档与测试补充
**时间:** 2026-09-08 ~ 09-14 (7天)  
**负责人:** 后端开发 + QA  
**优先级:** P0 (阻塞客户对接)

#### 需求清单
- [ ] **OpenAPI文档生成**
  - 安装 `@fastify/swagger` 和 `@fastify/swagger-ui`
  - 为核心路由添加Swagger注解
  - 部署后可访问 `/api-docs`
  - 至少覆盖: 认证、微信用户、打卡、订单
  
- [ ] **集成测试补充**
  - `tests/integration/auth.test.ts` - 登录/JWT验证
  - `tests/integration/checkin.test.ts` - 完整打卡流程
  - `tests/integration/order.test.ts` - 订单+积分计算
  - 测试覆盖率报告 >70%
  
- [ ] **README完善**
  - 项目介绍和核心功能说明
  - 开发环境搭建步骤
  - 环境变量详细说明
  - 部署指南(含常见问题)

#### 验收标准
- ✅ 访问 `/api-docs` 可查看交互式文档
- ✅ 所有核心接口有请求/响应示例
- ✅ `npm test` 运行通过率100%
- ✅ 新成员按README能在30分钟内启动开发环境
- ✅ 错误码文档完整(400/401/403/404/500)

#### 交付物
- `docs/API.md` - OpenAPI文档导出
- `tests/integration/*.test.ts` - 集成测试套件
- 更新的 `README.md`
- `.github/CONTRIBUTING.md` - 贡献指南

---

### v2.9.0 - 架构模块化重构
**时间:** 2026-09-15 ~ 09-30 (16天)  
**负责人:** 后端开发  
**优先级:** P1 (提升可维护性)

#### 需求清单
- [ ] **路由层拆分**
  ```
  api/routes/
  ├── auth.routes.ts        # 认证相关(~200行)
  ├── wxUser.routes.ts      # 微信用户(~300行)
  ├── checkin.routes.ts     # 打卡相关(~400行)
  ├── order.routes.ts       # 订单相关(~250行)
  ├── dashboard.routes.ts   # 驾驶舱(~150行)
  └── index.ts              # 统一注册入口
  ```
  
- [ ] **服务层抽取**
  ```
  api/services/
  ├── auth.service.ts       # JWT生成/验证
  ├── checkin.service.ts    # 打卡统计逻辑
  ├── points.service.ts     # 积分计算
  └── backup.service.ts     # 备份恢复
  ```
  
- [ ] **仓储层封装**
  ```
  api/repositories/
  ├── wxUser.repo.ts        # SQL查询封装
  ├── checkin.repo.ts
  ├── order.repo.ts
  └── base.repo.ts          # 通用CRUD方法
  ```
  
- [ ] **中间件整理**
  ```
  api/middleware/
  ├── auth.middleware.ts    # JWT验证
  ├── rateLimit.middleware.ts
  └── errorHandler.middleware.ts
  ```
  
- [ ] **TypeScript严格模式**
  - 修改 `tsconfig.json`: `"strict": true`
  - 修复所有类型错误
  - 移除不必要的 `eslint-disable`

#### 验收标准
- ✅ `api/app.ts` 文件大小 <5KB
- ✅ 单个文件最大行数 <500行
- ✅ 无循环依赖(import不形成环)
- ✅ `npm run check` 无类型错误
- ✅ 所有集成测试通过
- ✅ 本地手动验证核心功能正常

#### 迁移策略
1. **第1-3天**: 抽取service层(不动路由)
2. **第4-7天**: 抽取repository层
3. **第8-12天**: 拆分routes文件
4. **第13-14天**: 开启TS严格模式并修复
5. **第15-16天**: 回归测试和bug修复

#### 风险与预案
| 风险 | 概率 | 影响 | 预案 |
|------|------|------|------|
| 重构引入隐藏bug | 高 | 高 | 每步都运行测试，保留git tag回滚点 |
| 循环依赖导致启动失败 | 中 | 高 | 使用dependency-cruiser检测 |
| 工期延误 | 中 | 中 | 优先拆分核心模块，次要模块延后 |

#### 交付物
- 重构后的 `api/` 目录结构
- `docs/ARCHITECTURE.md` - 新架构说明
- 更新的单元测试适配新结构

---

### v3.0.0 - 数据库迁移系统
**时间:** 2026-10-01 ~ 10-07 (7天)  
**负责人:** 后端开发  
**优先级:** P1 (防止数据丢失)

#### 需求清单
- [ ] **Drizzle Kit集成**
  - 安装 `drizzle-kit` 和 `drizzle-orm`
  - 创建 `drizzle.config.ts`
  - 定义schema文件 `api/schema.ts`
  
- [ ] **生成历史迁移**
  - 根据当前db.ts生成初始迁移: `0001_init-schema.sql`
  - 验证在空数据库上能成功执行
  - 保留原db.ts作为fallback
  
- [ ] **迁移流程规范**
  - 编写 `MIGRATION_GUIDE.md`
  - 每次schema变更必须生成迁移脚本
  - 生产环境通过命令执行迁移
  
- [ ] **回滚机制**
  - 每个迁移脚本包含down.sql
  - 测试回滚后再应用新迁移

#### 验收标准
- ✅ `npx drizzle-kit generate` 能生成迁移
- ✅ `npx drizzle-kit migrate` 能应用到生产库
- ✅ 空数据库从零迁移后功能正常
- ✅ 迁移失败能自动回滚(事务保护)
- ✅ 文档清晰说明迁移流程

#### 交付物
- `migrations/` 目录及历史迁移脚本
- `drizzle.config.ts` 配置文件
- `docs/MIGRATION_GUIDE.md` 操作手册
- `scripts/migrate-prod.sh` 生产迁移脚本

---

### v3.1.0 - CI/CD自动化部署
**时间:** 2026-10-08 ~ 10-14 (7天)  
**负责人:** DevOps/后端开发  
**优先级:** P1 (提升交付效率)

#### 需求清单
- [ ] **GitHub Actions配置**
  ```yaml
  # .github/workflows/deploy.yml
  name: Deploy to Production
  on:
    push:
      branches: [main]
  
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - checkout
        - npm ci
        - npm test
        - npm run check
    
    deploy:
      needs: test
      runs-on: self-hosted
      steps:
        - rsync上传代码
        - npm ci && npm run build
        - pm2 reload
        - 健康检查
  ```
  
- [ ] **Self-hosted Runner配置**
  - 腾讯云服务器安装GitHub Actions Runner
  - 配置systemd服务保持运行
  - 限制runner权限(仅部署目录)
  
- [ ] **部署脚本优化**
  - 原子化部署(先部署到临时目录再切换)
  - 失败自动回滚到上一个版本
  - 部署后发送通知(钉钉/企业微信)
  
- [ ] **环境隔离**
  - 区分staging和production环境
  - staging用于预发布验证

#### 验收标准
- ✅ push到main分支自动触发流水线
- ✅ 测试失败自动拦截不部署
- ✅ 部署成功后健康检查返回200
- ✅ 部署失败自动回滚并发送告警
- ✅ 从push到上线总耗时 <10分钟

#### 交付物
- `.github/workflows/deploy.yml`
- `scripts/setup-runner.sh` - Runner安装脚本
- `docs/CI_CD_GUIDE.md` - 配置说明
- 企业微信webhook通知集成

---

### v3.2.0 - 监控告警体系
**时间:** 2026-10-15 ~ 10-21 (7天)  
**负责人:** 后端开发  
**优先级:** P2 (提升稳定性)

#### 需求清单
- [ ] **Sentry错误监控**
  - 前端安装 `@sentry/react`
  - 后端安装 `@sentry/node`
  - 配置DSN和环境变量
  - 测试错误上报正常
  
- [ ] **关键指标监控**
  - API响应时间P95 <500ms
  - 接口错误率 <1%
  - 每日活跃用户数
  - 打卡提交成功率
  
- [ ] **告警规则配置**
  - 错误率>5%持续10分钟 → 发送邮件
  - 服务不可用 → 发送企业微信
  - 磁盘空间<10% → 发送短信
  
- [ ] **日志聚合**
  - Nginx访问日志轮转(每天一个文件)
  - 后端错误日志持久化到文件
  - 可选: 接入Loki/Grafana可视化

#### 验收标准
- ✅ Sentry后台能看到实时错误
- ✅ 故意抛出错误能收到告警通知
- ✅ 日志文件按日期分割且不占满磁盘
- ✅ Dashboard显示关键指标趋势图

#### 交付物
- `sentry.config.ts` 配置文件
- `scripts/log-rotate.sh` - 日志轮转脚本
- `docs/MONITORING.md` - 监控配置说明
- Grafana Dashboard JSON模板(可选)

---

### v3.3.0 - 性能优化
**时间:** 2026-10-22 ~ 10-31 (10天)  
**负责人:** 前后端开发  
**优先级:** P2 (提升用户体验)

#### 需求清单
- [ ] **后端缓存策略**
  - Dashboard数据内存缓存(TTL 5分钟)
  - 微信用户列表分页缓存
  - 缓存失效时后台刷新
  
- [ ] **数据库索引优化**
  - 为高频查询字段添加索引
  - 分析慢查询日志
  - 压测验证索引效果
  
- [ ] **前端Bundle优化**
  - 启用代码分割(lazy loading)
  - 压缩图片资源
  - 移除未使用的依赖
  - 目标: 首屏加载 <1.5秒
  
- [ ] **静态资源CDN**
  - 图片/视频上传到腾讯云COS
  - 配置CDN加速
  - 前端引用改为CDN地址

#### 验收标准
- ✅ Dashboard接口响应时间 <100ms(缓存命中)
- ✅ 前端bundle体积(gzip) <500KB
- ✅ Lighthouse评分 >90分
- ✅ 并发100用户时无明显延迟

#### 交付物
- `api/cache.ts` - 缓存工具类
- 优化的 `vite.config.ts`
- 腾讯云COS集成代码
- 性能测试报告

---

### v4.0.0 - 多租户隔离
**时间:** 2026-11-01 ~ 11-15 (15天)  
**负责人:** 架构师 + 后端开发  
**优先级:** P3 (SaaS化必备)

#### 需求清单
- [ ] **租户表设计**
  ```sql
  CREATE TABLE tenants (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    api_key TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  ```
  
- [ ] **数据隔离改造**
  - 所有业务表增加 `tenant_id` 字段
  - 中间件根据api_key识别租户
  - 所有SQL自动加上 `WHERE tenant_id = ?`
  
- [ ] **租户管理后台**
  - 创建/编辑/禁用租户
  - 查看租户用量统计
  - 生成API密钥
  
- [ ] **迁移现有数据**
  - 将当前数据迁移到默认租户
  - 验证隔离效果

#### 验收标准
- ✅ 租户A无法访问租户B的数据
- ✅ 创建新租户后能独立使用系统
- ✅ 禁用租户后立即无法访问API
- ✅ 迁移后原有功能完全正常

#### 风险与预案
| 风险 | 概率 | 影响 | 预案 |
|------|------|------|------|
| SQL遗漏tenant_id过滤 | 高 | 高 | 编写自动化审计脚本检查所有查询 |
| 迁移过程数据损坏 | 中 | 高 | 全量备份+校验和验证 |
| 性能下降(额外JOIN) | 中 | 中 | 为tenant_id添加索引 |

#### 交付物
- `api/middleware/tenant.ts` - 租户识别中间件
- `api/routes/tenant-admin.ts` - 租户管理接口
- 数据迁移脚本
- `docs/MULTI_TENANT.md` - 架构说明

---

### v4.1.0 - 订阅付费功能
**时间:** 2026-11-16 ~ 11-30 (15天)  
**负责人:** 后端开发 + 前端开发  
**优先级:** P3 (商业化核心)

#### 需求清单
- [ ] **套餐管理**
  ```sql
  CREATE TABLE plans (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,           -- 基础版/专业版/企业版
    price_monthly INTEGER,        -- 月付价格(分)
    max_users INTEGER,
    features TEXT                 -- JSON数组
  );
  ```
  
- [ ] **微信支付集成**
  - JSAPI支付(小程序内)
  - H5支付(管理端网页)
  - 支付回调验签
  - 退款接口
  
- [ ] **订阅状态机**
  - trial → active → expired → cancelled
  - 定时任务检查到期续费
  - 过期前7天/3天/当天提醒
  
- [ ] **用量限制**
  - 超过max_users禁止新增用户
  - 高级功能权限控制

#### 验收标准
- ✅ 能成功创建订单并完成支付
- ✅ 支付回调后订阅状态正确更新
- ✅ 过期后自动降级功能
- ✅ 退款后正确处理数据

#### 交付物
- `api/routes/payment.ts` - 支付接口
- `api/services/wechat-pay.ts` - 微信支付SDK封装
- 管理端套餐配置页面
- `docs/PAYMENT.md` - 支付流程说明

---

### v4.2.0 - 权限分级控制
**时间:** 2026-12-01 ~ 12-07 (7天)  
**负责人:** 后端开发  
**优先级:** P3 (企业客户需求)

#### 需求清单
- [ ] **角色表设计**
  ```sql
  CREATE TABLE roles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,           -- admin/operator/viewer
    permissions TEXT              -- JSON数组
  );
  
  CREATE TABLE user_roles (
    user_id INTEGER,
    role_id INTEGER,
    PRIMARY KEY (user_id, role_id)
  );
  ```
  
- [ ] **权限中间件**
  - `requirePermission('wx_users.write')`
  - 基于RBAC模型
  
- [ ] **UI权限控制**
  - 根据角色隐藏无权操作按钮
  - 路由守卫防止直接访问
  
- [ ] **预设角色**
  - 超级管理员(所有权限)
  - 运营人员(读写用户/订单)
  - 客服(只读+跟进记录)
  - 财务(只读订单)

#### 验收标准
- ✅ operator无法删除用户
- ✅ viewer只能查看不能修改
- ✅ 前端按钮根据权限动态显示
- ✅ 直接访问URL被拦截

#### 交付物
- `api/middleware/rbac.ts` - 权限中间件
- `src/hooks/usePermission.ts` - 前端权限Hook
- 角色管理UI页面
- `docs/RBAC.md` - 权限模型说明

---

## 版本依赖关系

```
v2.7.0 (安全) → v2.8.0 (文档) → v2.9.0 (重构)
                                    ↓
                              v3.0.0 (迁移)
                                    ↓
                              v3.1.0 (CI/CD)
                                    ↓
                          ┌──── v3.2.0 (监控)
                          │
                          └──── v3.3.0 (性能)
                                    ↓
                              v4.0.0 (多租户)
                                    ↓
                              v4.1.0 (支付)
                                    ↓
                              v4.2.0 (权限)
```

**关键路径:** v2.7.0 → v2.8.0 → v2.9.0 → v3.0.0 → v3.1.0 → v4.0.0 → v4.1.0

---

## 发版检查清单(通用)

每个版本发布前必须完成:

### 代码质量
- [ ] `npm test` 通过率100%
- [ ] `npm run check` 无类型错误
- [ ] `npm run lint` 无warning
- [ ] Code Review至少1人通过

### 功能验证
- [ ] 本地手动验证核心功能
- [ ] 测试环境部署验证
- [ ] 真机回归测试(小程序)
- [ ] 兼容性测试(Chrome/Safari/Firefox)

### 文档更新
- [ ] CHANGELOG.md 更新
- [ ] README.md 同步(如有变更)
- [ ] API文档重新生成
- [ ] 用户手册更新(如有新功能)

### 部署准备
- [ ] 数据库备份
- [ ] 迁移脚本测试(如有schema变更)
- [ ] 回滚方案准备
- [ ] 通知相关人员发版时间

### 发版后
- [ ] 观察错误监控30分钟
- [ ] 验证关键接口响应正常
- [ ] 收集用户反馈
- [ ] 更新版本号并提交tag

---

## 风险管理

### 高风险版本
- **v2.7.0**: 密钥轮换可能影响线上用户
- **v2.9.0**: 大规模重构可能引入隐藏bug
- **v4.0.0**: 多租户改造涉及全量数据迁移

### 缓解措施
1. 高风险版本安排在周末低峰期发布
2. 提前1天冻结代码，专注测试
3. 准备快速回滚脚本(5分钟内完成)
4. 发版后专人值守2小时

---

## 沟通机制

### 日常同步
- **站会**: 每日上午10:00，15分钟
- **周报**: 每周五下午发送进度邮件
- **演示**: 每个版本完成后demo给产品负责人

### 问题升级
- **Blocker**: 立即电话沟通
- **Critical**: 2小时内响应
- **Major**: 当日解决
- **Minor**: 纳入下一迭代

---

## 成功标准

### 技术指标
- ✅ 测试覆盖率 >70%
- ✅ API响应时间P95 <500ms
- ✅ 部署频率 ≥每周1次
- ✅ 故障恢复时间 <30分钟

### 业务指标
- ✅ 支持10+机构同时使用
- ✅ 单机构最多1000用户
- ✅ 数据安全零事故
- ✅ 客户满意度 >4.5/5

---

**下一步行动:**
1. 创建GitHub Project看板，将上述版本转化为Milestone
2. 为v2.7.0创建具体Issue并分配负责人
3. 召开kickoff会议确认排期和依赖

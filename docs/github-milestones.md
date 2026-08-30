# GitHub Milestones 配置指南

本文档用于将ROADMAP.md中的版本计划导入为GitHub Milestones。

---

## 如何创建Milestone

1. 访问: https://github.com/caijuren/LearnGrow-CRM/milestones
2. 点击 "New milestone"
3. 填写以下信息并保存

---

## Milestone列表

### Milestone 1: v2.7.0 - 安全合规加固
- **标题:** v2.7.0 - Security & Compliance Hardening
- **描述:** 消除致命安全风险，满足法律合规要求（密钥轮换、隐私政策、数据删除、备份加密）
- **截止日期:** 2026-09-07
- **优先级:** 🔴 P0

**关联Issue:**
- #1 密钥轮换与安全检查
- #2 隐私政策页面实现
- #3 用户数据删除接口
- #4 备份加密实现
- #5 文档更新

---

### Milestone 2: v2.8.0 - API文档与测试补充
- **标题:** v2.8.0 - API Documentation & Testing
- **描述:** 补充核心接口OpenAPI文档，集成测试覆盖率达70%
- **截止日期:** 2026-09-14
- **优先级:** 🔴 P0

**关联Issue:**
- #6 OpenAPI文档生成
- #7 核心流程集成测试
- #8 README完善

---

### Milestone 3: v2.9.0 - 架构模块化重构
- **标题:** v2.9.0 - Architecture Modularization
- **描述:** 拆分api/app.ts单体文件为路由/服务/仓储三层，开启TS严格模式
- **截止日期:** 2026-09-30
- **优先级:** 🟡 P1

**关联Issue:**
- #9 路由层拆分
- #10 服务层抽取
- #11 仓储层封装
- #12 TypeScript严格模式开启

---

### Milestone 4: v3.0.0 - 数据库迁移系统
- **标题:** v3.0.0 - Database Migration System
- **描述:** 引入Drizzle Kit管理schema变更，建立迁移流程规范
- **截止日期:** 2026-10-07
- **优先级:** 🟡 P1

**关联Issue:**
- #13 Drizzle Kit集成
- #14 历史迁移脚本生成
- #15 迁移流程文档

---

### Milestone 5: v3.1.0 - CI/CD自动化
- **标题:** v3.1.0 - CI/CD Automation
- **描述:** GitHub Actions实现自动测试+部署+健康检查
- **截止日期:** 2026-10-14
- **优先级:** 🟡 P1

**关联Issue:**
- #16 GitHub Actions配置
- #17 Self-hosted Runner安装
- #18 部署脚本优化

---

### Milestone 6: v3.2.0 - 监控告警体系
- **标题:** v3.2.0 - Monitoring & Alerting
- **描述:** Sentry错误监控接入，关键指标告警配置
- **截止日期:** 2026-10-21
- **优先级:** 🟢 P2

**关联Issue:**
- #19 Sentry前端接入
- #20 Sentry后端接入
- #21 告警规则配置

---

### Milestone 7: v3.3.0 - 性能优化
- **标题:** v3.3.0 - Performance Optimization
- **描述:** Dashboard缓存、bundle优化、CDN加速
- **截止日期:** 2026-10-31
- **优先级:** 🟢 P2

**关联Issue:**
- #22 Dashboard缓存策略
- #23 前端Bundle优化
- #24 图片CDN集成

---

### Milestone 8: v4.0.0 - 多租户隔离
- **标题:** v4.0.0 - Multi-Tenancy Isolation
- **描述:** 支持多机构数据隔离，SaaS化基础架构
- **截止日期:** 2026-11-15
- **优先级:** 🔴 P3

**关联Issue:**
- #25 租户表设计
- #26 数据隔离改造
- #27 租户管理后台
- #28 现有数据迁移

---

### Milestone 9: v4.1.0 - 订阅付费功能
- **标题:** v4.1.0 - Subscription & Payment
- **描述:** 微信支付集成，套餐管理，订阅状态机
- **截止日期:** 2026-11-30
- **优先级:** 🟡 P3

**关联Issue:**
- #29 套餐管理
- #30 微信支付集成
- #31 订阅状态机实现
- #32 用量限制

---

### Milestone 10: v4.2.0 - 权限分级控制
- **标题:** v4.2.0 - RBAC Permission System
- **描述:** 细粒度角色权限控制，企业客户必备
- **截止日期:** 2026-12-07
- **优先级:** 🟡 P3

**关联Issue:**
- #33 角色表设计
- #34 权限中间件
- #35 UI权限控制
- #36 预设角色配置

---

## 批量创建脚本 (可选)

如果你想通过GitHub API批量创建Milestone，可以使用以下脚本：

```bash
#!/bin/bash
# scripts/create-milestones.sh

TOKEN="your_github_token"
REPO="caijuren/LearnGrow-CRM"

# v2.7.0
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/$REPO/milestones \
  -d '{
    "title": "v2.7.0 - Security & Compliance Hardening",
    "description": "消除致命安全风险，满足法律合规要求",
    "state": "open",
    "due_on": "2026-09-07T23:59:59Z"
  }'

# 依次创建其他Milestone...
```

---

## Issue模板使用

创建Issue时，使用以下标签分类：

- `priority:p0` - 阻塞商业化，必须本周完成
- `priority:p1` - 重要但不紧急
- `priority:p2` - 锦上添花
- `priority:p3` - 长期规划
- `type:feature` - 新功能
- `type:bug` - Bug修复
- `type:refactor` - 重构
- `type:docs` - 文档更新

示例：
```
标题: [P0] 密钥轮换与安全检查
标签: priority:p0, type:feature, milestone:v2.7.0
指派给: @caijuren
```

---

## 进度跟踪

每个Milestone的完成度会自动计算：
- 0% - 未开始
- 1-99% - 进行中
- 100% - 已完成

建议在README顶部添加Milestone进度徽章：

```markdown
## 当前迭代进度

[![v2.7.0进度](https://img.shields.io/badge/v2.7.0-30%25-yellow)](https://github.com/caijuren/LearnGrow-CRM/milestone/1)
[![v2.8.0进度](https://img.shields.io/badge/v2.8.0-0%25-lightgrey)](https://github.com/caijuren/LearnGrow-CRM/milestone/2)
```

---

## 下一步行动

1. ✅ 手动或通过API创建上述10个Milestone
2. ✅ 为v2.7.0创建5个具体Issue（参考docs/v2.7.0-tasks.md）
3. ✅ 将Issue分配到对应Milestone
4. ✅ 设置Issue负责人和截止日期
5. ✅ 在GitHub Projects看板中可视化展示

# LearnGrow CRM - 教育机构私域运营工具

> 微信小程序打卡系统 + 管理端后台，帮助教育机构高效运营微信私域流量

**当前版本:** v2.6.0 | **下一个版本:** v2.7.0 (安全合规加固)

---

## 🚀 快速开始

### 商业化迭代计划

📋 **完整路线图:** [ROADMAP.md](./ROADMAP.md)  
📝 **版本日志:** [CHANGELOG.md](./CHANGELOG.md)  
📂 **交付物清单:** [docs/DELIVERABLES.md](./docs/DELIVERABLES.md)

**当前正在进行的版本:**
- 🔴 **v2.7.0** - 安全合规加固 (2026-09-01 ~ 09-07)
  - 密钥轮换与安全检查
  - 隐私政策页面实现
  - 用户数据删除接口
  - 备份加密

**立即启动v2.7.0:**
```bash
bash scripts/start-v2.7.0.sh
```

### 核心功能

- ✅ **微信小程序打卡系统** - 活动创建、每日打卡、积分徽章、排行榜
- ✅ **微信用户管理** - 360视图、标签管理、跟进记录
- ✅ **订单与产品管理** - 快速下单、复购周期、关联推荐
- ✅ **驾驶舱Dashboard** - 聚焦微信用户增长和打卡活跃度
- ✅ **数据备份恢复** - 自动备份、异地拉回、媒体文件校验

### 技术栈

**前端 (管理端)**
- React 18 + TypeScript + Vite 6
- Tailwind CSS 3 + Tremor (数据可视化)
- Zustand 5 (状态管理) + React Router 7

**后端 (API服务)**
- Fastify 5 (高性能Node.js框架)
- SQLite 3 + better-sqlite3
- Drizzle ORM (类型安全查询)

**微信小程序**
- 原生小程序开发 (WXML/WXSS/JS)
- 当前版本: v3.6.0

---

## 📖 开发文档

### 环境搭建

```bash
# 1. 克隆仓库
git clone git@github.com:caijuren/LearnGrow-CRM.git
cd LearnGrow-CRM

# 2. 安装依赖
npm ci

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实值

# 4. 启动开发服务器 (前后端同时运行)
npm run dev

# 访问:
# - 管理端: http://localhost:5173
# - API: http://localhost:3456
```

### 环境变量说明

创建 `.env` 或 `.env.production` 文件，配置以下变量：

```bash
# ============================================
# LearnGrow CRM - 环境变量配置
# ============================================

# 服务端安全配置
# 生产环境必须使用至少32位随机字符串
JWT_SECRET=replace_with_a_long_random_secret_at_least_32_chars

# 首次初始化生产数据库时使用，至少12位；已有用户后不会再使用
INITIAL_ADMIN_PASSWORD=replace_with_a_strong_initial_password

# 可选：生产环境数据库目录，默认使用项目 data 目录
DATA_DIR=/absolute/path/to/learngrow-data

# 微信小程序配置
WX_APPID=your_wx_appid_here
WX_SECRET=your_wx_secret_here

# 备份加密密钥（64位十六进制字符串）
BACKUP_ENCRYPTION_KEY=generate_with_node_crypto_randomBytes_32_hex

# 上传限流配置（可选，默认每分钟30次）
UPLOAD_RATE_PER_MIN=30
```

**生成安全的密钥：**
```bash
# JWT_SECRET (至少32字符)
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"

# BACKUP_ENCRYPTION_KEY (64位十六进制)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# INITIAL_ADMIN_PASSWORD (至少12位强密码)
node -e "console.log(require('crypto').randomBytes(9).toString('base64'))"
```

**⚠️ 安全提醒：**
- `.env` 和 `.env.production` 已加入 `.gitignore`，不会提交到代码库
- 生产环境务必使用强随机密钥，不要使用示例值
- 定期轮换密钥（建议JWT_SECRET每3个月，BACKUP_ENCRYPTION_KEY每6个月）
- 参考 [密钥轮换指南](./docs/KEY_ROTATION.md) 了解详细流程

### 常用命令

```bash
# 开发
npm run dev          # 前后端同时启动
npm run client:dev   # 仅前端 (Vite)
npm run server:dev   # 仅后端 (Nodemon)

# 构建与测试
npm run build        # 构建前端
npm test             # 运行测试
npm run check        # TypeScript类型检查

# 部署
./deploy.sh          # 部署到生产服务器
npm run backup       # 数据库备份
```

### 项目结构

```
LearnGrow-CRM/
├── src/                  # Web管理端前端
│   ├── pages/           # 页面组件
│   ├── components/      # 通用组件
│   └── store/           # Zustand状态管理
├── api/                  # 后端API服务
│   ├── routes/          # 路由层 (v2.9.0重构后)
│   ├── services/        # 业务逻辑层
│   └── repositories/    # 数据访问层
├── miniprogram/          # 微信小程序客户端
│   ├── pages/           # 小程序页面
│   └── config.js        # API配置
├── shared/               # 共享类型定义
├── docs/                 # 文档目录
│   ├── ROADMAP.md       # 商业化迭代路线图
│   ├── CHANGELOG.md     # 版本更新日志
│   └── DELIVERABLES.md  # 交付物清单
└── scripts/              # 自动化脚本
    ├── start-v2.7.0.sh  # v2.7.0快速启动
    ├── backup.ts        # 数据库备份
    └── deploy.sh        # 部署脚本
```

---

## 🚀 生产环境部署指南

### 前置要求

- Node.js >= 20.9.0 (推荐 v24.x)
- npm >= 10.x
- Linux服务器 (Ubuntu 22.04 LTS推荐)
- PM2进程管理器 (用于生产环境)

### 部署步骤

#### 1. 服务器准备

```bash
# SSH登录服务器
ssh ubuntu@your-server-ip

# 创建项目目录
sudo mkdir -p /var/www/learngrow-crm
sudo chown -R ubuntu:ubuntu /var/www/learngrow-crm
cd /var/www/learngrow-crm

# 安装PM2 (如未安装)
npm install -g pm2
```

#### 2. 代码同步

使用提供的deploy.sh脚本自动部署：

```bash
# 在本地机器执行
cd LearnGrow-CRM
bash deploy.sh
```

该脚本会自动：
- 上传代码到服务器临时目录
- 同步到项目目录（排除node_modules、数据库等）
- 安装依赖 (`npm ci`)
- 运行类型检查和测试
- 构建前端资源
- 执行生产预检
- 重启PM2服务
- 验证API健康状态

#### 3. 环境变量配置

首次部署需要配置 `.env.production`：

```bash
ssh ubuntu@your-server-ip
cd /var/www/learngrow-crm

# 复制模板并编辑
cp .env.example .env.production
nano .env.production
```

填入真实值后，重启PM2加载配置：

```bash
pm2 restart learngrow-crm --update-env
```

#### 4. 数据库迁移

如果版本包含数据库schema变更：

```bash
cd /var/www/learngrow-crm
npx tsx scripts/add-deleted-at-columns.ts  # 示例迁移脚本
```

**重要：** 迁移前务必备份数据库！

```bash
cd /var/www/learngrow-crm
npm run backup
```

#### 5. 验证部署

```bash
# 检查PM2状态
pm2 status

# 查看日志
pm2 logs learngrow-crm --lines 50

# 测试API
curl http://localhost:3456/api/health

# 预期输出:
# {"success":true,"message":"ok","version":"2.7.0"}
```

### 回滚方案

如果部署后出现问题：

```bash
# 方法1: 回滚到上一个git版本
ssh ubuntu@your-server-ip
cd /var/www/learngrow-crm
git checkout <previous-version-tag>
npm ci
npm run build
pm2 restart learngrow-crm --update-env

# 方法2: 恢复数据库备份
cd /var/www/learngrow-crm
npx tsx scripts/restore-backup.ts backups/latest_backup.zip
```

### 常见问题

**Q: 部署后API返回502错误？**  
A: 检查PM2日志 `pm2 logs learngrow-crm`，确认服务是否正常启动。

**Q: 前端页面空白？**  
A: 确认 `npm run build` 是否成功，检查 `dist/` 目录是否存在。

**Q: 数据库连接失败？**  
A: 检查 `DATA_DIR` 环境变量是否正确，确认数据库文件权限。

**Q: 上传文件失败？**  
A: 确认 `uploads/` 目录权限，应为 `ubuntu:ubuntu` 所有。

详细部署问题参考 [部署检查清单](./docs/DEPLOYMENT-CHECKLIST.md)。

---

## 📚 重要文档索引

### 产品文档
- [商业化评估报告](./docs/commercial-assessment.md) - 从商业化角度的全面分析
- [Dashboard重新设计PRD](./docs/dashboard-redesign-prd.md) - 驾驶舱产品需求
- [微信小程序发布检查清单](./RELEASE_CHECKLIST.md) - 提审前必查项

### 技术文档
- [架构设计说明](./docs/ARCHITECTURE.md) - 系统架构与模块划分
- [API文档](./docs/API.md) - OpenAPI接口文档 (v2.8.0生成)
- [数据库迁移指南](./docs/MIGRATION_GUIDE.md) - schema变更流程
- [部署指南](./docs/DEPLOYMENT.md) - 生产环境部署步骤

### 运维文档
- [监控告警配置](./docs/MONITORING.md) - Sentry接入与告警规则
- [密钥轮换指南](./docs/KEY_ROTATION.md) - 安全管理最佳实践
- [故障排查手册](./docs/TROUBLESHOOTING.md) - 常见问题解决方案

### 用户文档
- [管理员操作手册](./docs/USER_MANUAL.md) - 管理端功能说明
- [隐私政策](./docs/PRIVACY_POLICY.md) - 数据收集与使用说明

---

## 🎯 商业化路线图

| 版本 | 主题 | 时间窗口 | 状态 |
|------|------|---------|------|
| v2.7.0 | 安全合规加固 | 2026-09-01 ~ 09-07 | 📋 待启动 |
| v2.8.0 | API文档与测试 | 2026-09-08 ~ 09-14 | 📋 待启动 |
| v2.9.0 | 架构模块化重构 | 2026-09-15 ~ 09-30 | 📋 待启动 |
| v3.0.0 | 数据库迁移系统 | 2026-10-01 ~ 10-07 | 📋 待启动 |
| v3.1.0 | CI/CD自动化 | 2026-10-08 ~ 10-14 | 📋 待启动 |
| v4.0.0 | 多租户隔离 | 2026-11-01 ~ 11-15 | 📋 待启动 |
| v4.1.0 | 订阅付费功能 | 2026-11-16 ~ 11-30 | 📋 待启动 |

**详细计划:** [查看完整ROADMAP](./ROADMAP.md)

---

## 🤝 团队协作

### Git工作流

```bash
# 创建特性分支
git checkout -b feature/your-feature-name

# 提交代码 (约定式提交)
git commit -m "feat: add user deletion endpoint (#3)"

# 创建Pull Request
# 在GitHub网页端创建PR并关联Issue
```

### Code Review规范
- 每个PR至少1人Review
- 重点关注: 安全性、性能、可维护性
- 使用GitHub Review功能逐行评论

### Commit规范
采用[约定式提交](https://www.conventionalcommits.org/zh-hans/):
- `feat:` 新功能
- `fix:` Bug修复
- `refactor:` 重构
- `docs:` 文档更新
- `test:` 测试相关
- `chore:` 构建/工具链

---

## ⚠️ 安全注意事项

1. **永远不要提交敏感信息**
   - `.env` 和 `.env.production` 已在 `.gitignore` 中排除
   - 如意外提交，立即执行git历史清理

2. **密钥管理**
   - JWT_SECRET至少32字符随机字符串
   - 每3个月轮换一次密钥
   - 通过安全渠道传递（不要明文发送）

3. **生产环境部署**
   - 使用HTTPS域名
   - 定期备份数据库
   - 监控错误日志

---

## 📊 项目状态

[![License](https://img.shields.io/badge/license-proprietary-red)]()
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18-blue)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/fastify-5-black)](https://fastify.dev/)

**当前迭代进度:**
- [v2.7.0 Milestone](https://github.com/caijuren/LearnGrow-CRM/milestone/1) - 安全合规加固

---

## 📞 联系方式

- **项目负责人:** @caijuren
- **技术支持:** support@example.com
- **问题反馈:** [GitHub Issues](https://github.com/caijuren/LearnGrow-CRM/issues)

---

## 📄 许可证

本项目为商业软件，未经授权不得用于商业用途。

---

*最后更新: 2026-08-30*

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // other configs...
    // Enable lint rules for React
    reactX.configs['recommended-typescript'],
    // Enable lint rules for React DOM
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

# CI/CD 自动化部署指南

本文档说明 LearnGrow CRM 的持续集成和持续部署配置。

## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   GitHub    │────▶│ GitHub       │────▶│ Self-hosted      │
│   Repository│     │ Actions      │     │ Runner (腾讯云服务器) │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                │
                                                ▼
                                         ┌─────────────────┐
                                         │ PM2 + Fastify   │
                                         │ Production Server│
                                         └─────────────────┘
```

## 工作流程

### 自动触发流程

1. **开发者推送代码到 main 分支**
2. **GitHub Actions 自动触发**:
   - `test` job: 运行类型检查和测试
   - `deploy` job: 部署到生产环境（需要 test 通过）
3. **部署步骤**:
   - 备份当前版本
   - 同步代码到发布目录
   - 安装依赖并构建
   - 原子化切换 symlink
   - 重载 PM2 服务
   - 健康检查
   - 发送企业微信通知

### 手动触发

可以通过 GitHub UI 手动触发部署：

1. 访问: https://github.com/caijuren/LearnGrow-CRM/actions/workflows/deploy.yml
2. 点击 "Run workflow"
3. 选择目标环境（staging/production）
4. 点击 "Run workflow"

## 前置条件

### 1. 腾讯云服务器配置

确保服务器满足以下要求：

- Ubuntu 20.04+ / CentOS 7+
- Node.js 20.x
- PM2 进程管理器
- Git
- rsync

### 2. 安装 Self-hosted Runner

在腾讯云服务器上执行：

```bash
# 下载脚本
curl -O https://raw.githubusercontent.com/caijuren/LearnGrow-CRM/main/scripts/setup-runner.sh

# 赋予执行权限
chmod +x setup-runner.sh

# 以 root 身份运行
sudo ./setup-runner.sh
```

按照提示输入 GitHub Personal Access Token。

### 3. 环境变量配置

在生产服务器上创建 `.env.production` 文件：

```bash
# /opt/learngrow-crm/.env.production
NODE_ENV=production
PORT=3456
DATABASE_URL=/opt/learngrow-crm/data/learngrow.db
DATA_DIR=/opt/learngrow-crm/data
JWT_SECRET=<your-jwt-secret>
INITIAL_ADMIN_PASSWORD=<secure-password>
WECHAT_APP_ID=<wechat-app-id>
WECHAT_APP_SECRET=<wechat-app-secret>
```

### 4. GitHub Secrets 配置

在 GitHub Repository Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 | 示例 |
|--------|------|------|
| `WECHAT_WEBHOOK_URL` | 企业微信群机器人 Webhook URL | `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx` |

### 5. GitHub Variables 配置

在 GitHub Repository Settings → Secrets and variables → Actions → Variables 中配置：

| Variable | 说明 | 默认值 |
|----------|------|--------|
| `DATA_DIR` | 数据库目录 | `./data` |
| `DEPLOY_DIR` | 部署根目录 | `/opt/learngrow-crm` |

## 目录结构

```
/opt/learngrow-crm/
├── current -> releases/<commit-sha>    # 当前版本 symlink
├── latest -> releases/<commit-sha>     # 最新版本 symlink
├── releases/                           # 历史版本目录
│   ├── <commit-sha-1>/
│   ├── <commit-sha-2>/
│   └── <commit-sha-3>/
├── backups/                            # 部署备份
│   ├── release_20260830_120000/
│   └── release_20260830_130000/
├── .env.production                     # 生产环境配置
└── ecosystem.config.js                 # PM2 配置文件
```

## 部署脚本使用

### 本地部署测试

```bash
# Dry-run 模式（不实际部署）
./scripts/deploy.sh --dry-run

# 实际部署
./scripts/deploy.sh

# 回滚到上一个版本
./scripts/deploy.sh --rollback
```

### 服务器端部署

SSH 登录到服务器后：

```bash
cd /opt/learngrow-crm/current

# 手动部署当前 git HEAD
./scripts/deploy.sh

# 查看部署历史
ls -lt ../releases/

# 回滚到指定版本
ln -sfn ../releases/<commit-sha> ../current
pm2 reload ecosystem.config.js --env production
```

## 健康检查

部署完成后会自动执行健康检查：

```bash
curl http://localhost:3456/api/health
```

预期响应：

```json
{
  "status": "ok",
  "timestamp": "2026-08-30T10:30:00.000Z",
  "uptime": 120,
  "database": "connected"
}
```

## 故障排查

### 1. Runner 离线

```bash
# 检查服务状态
sudo systemctl status github-runner

# 查看日志
sudo journalctl -u github-runner -f

# 重启服务
sudo systemctl restart github-runner
```

### 2. 部署失败

```bash
# 查看 GitHub Actions 日志
# 访问: https://github.com/caijuren/LearnGrow-CRM/actions

# 查看服务器端 PM2 日志
pm2 logs

# 查看应用日志
tail -f /opt/learngrow-crm/current/logs/app.log
```

### 3. 健康检查失败

```bash
# 检查端口是否监听
netstat -tlnp | grep 3456

# 检查 PM2 进程
pm2 status

# 手动重启
pm2 restart all

# 检查数据库连接
node -e "const db = require('./api/db').default; console.log('DB OK');"
```

### 4. 数据库迁移失败

```bash
# 手动执行迁移
cd /opt/learngrow-crm/current
NODE_ENV=production npx drizzle-kit migrate --config=drizzle.config.ts

# 查看迁移历史
cat migrations/meta/_journal.json
```

### 5. 回滚操作

```bash
# 自动回滚（部署脚本内置）
./scripts/deploy.sh --rollback

# 手动回滚到上一版本
cd /opt/learngrow-crm
PREV=$(ls -t releases/ | head -n 2 | tail -n 1)
ln -sfn releases/$PREV current
pm2 reload ecosystem.config.js --env production
```

## 安全最佳实践

### 1. 权限控制

- Runner 用户 (`github-runner`) 仅对部署目录有写权限
- systemd 服务配置了 `ProtectSystem=true` 和 `ProtectHome=true`
- 数据库文件权限设置为 `600`

### 2. 密钥管理

- 所有敏感信息存储在 GitHub Secrets
- 生产环境 `.env.production` 文件不在 git 中
- JWT secret 定期轮换

### 3. 网络隔离

- 服务器防火墙仅开放必要端口（80, 443, 3456）
- 数据库不对外网开放
- 使用 HTTPS 传输

## 性能优化建议

### 1. 缓存策略

- npm 依赖缓存：GitHub Actions 自动缓存 node_modules
- 构建产物缓存：前端构建输出可缓存

### 2. 并行部署

对于多服务器部署，考虑：

- 使用负载均衡器
- 蓝绿部署策略
- 滚动更新

### 3. 监控告警

建议集成：

- Sentry 错误监控（v3.2.0 计划）
- Prometheus + Grafana 性能监控
- Uptime Robot 可用性监控

## 常见问题

### Q: 如何跳过测试直接部署？

A: 不建议跳过测试。如确实需要，可以手动触发部署并选择环境。

### Q: 部署会中断服务吗？

A: 不会。使用 symlink 原子化切换和 PM2 reload 实现零停机部署。

### Q: 如何查看部署历史？

A: 
```bash
ls -lt /opt/learngrow-crm/releases/
git log --oneline -10
```

### Q: 部署失败后数据会丢失吗？

A: 不会。部署前会自动备份，失败时自动回滚到备份版本。

### Q: 如何在 staging 环境测试？

A: 手动触发工作流时选择 "staging" 环境，需预先配置 staging 服务器和 Runner。

## 参考资源

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Self-hosted Runners](https://docs.github.com/en/actions/hosting-your-own-runners)
- [PM2 文档](https://pm2.keymetrics.io/docs/home/)
- [Drizzle Kit 迁移指南](./MIGRATION_GUIDE.md)

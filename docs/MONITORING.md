# 监控告警体系配置指南

本文档说明 LearnGrow CRM 的监控、日志和告警配置。

## 架构概览

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Sentry    │────▶│  Alerting    │
│   (React)    │     │   Backend   │     │  (Email/WeChat)│
└──────────────┘     └─────────────┘     └──────────────┘
                           │
                    ┌──────▼──────┐
                    │  Metrics API │
                    │  (/api/metrics)│
                    └─────────────┘
                           │
                    ┌──────▼──────┐
                    │   Grafana   │ (可选)
                    │  Dashboard  │
                    └─────────────┘

┌──────────────┐
│  Log Files   │
│  - PM2 logs  │────▶ log-rotate.sh ──▶ 压缩/清理
│  - Nginx logs│
│  - App logs  │
└──────────────┘
```

## 1. Sentry 错误监控

### 1.1 注册 Sentry 账号

1. 访问 https://sentry.io/
2. 注册免费账号
3. 创建新项目：
   - 项目名称: `learngrow-crm`
   - 技术栈: Node.js + React

### 1.2 获取 DSN

在项目设置中找到 **Client Keys (DSN)**，格式如下：

```
https://<public_key>@o<org_id>.ingest.sentry.io/<project_id>
```

### 1.3 配置环境变量

**后端** (`/opt/learngrow-crm/.env.production`):

```bash
SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/789012
NODE_ENV=production
```

**前端** (`.env.production`):

```bash
VITE_SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/789012
VITE_APP_VERSION=2.9.0
```

### 1.4 验证集成

**后端测试**:

```bash
# SSH 登录服务器
cd /opt/learngrow-crm/current

# 手动触发测试错误
node -e "
const { captureException } = require('./api/sentry.js');
captureException(new Error('Test error from backend'));
console.log('Test error sent to Sentry');
"
```

**前端测试**:

在浏览器控制台执行：

```javascript
import { captureException } from './sentry';
captureException(new Error('Test error from frontend'));
```

### 1.5 配置告警规则

在 Sentry 项目设置中配置 **Alerts**:

1. **错误率告警**:
   - 条件: `error_rate > 5%` 持续 10 分钟
   - 动作: 发送邮件到管理员邮箱

2. **服务不可用**:
   - 条件: `transaction.duration > 30s` 或 HTTP 500
   - 动作: 发送企业微信通知

3. **回归错误**:
   - 条件: 已解决的问题再次出现
   - 动作: 立即发送通知

### 1.6 忽略噪音

在 `api/sentry.ts` 中配置 `ignoreErrors`:

```typescript
ignoreErrors: [
  /Unauthorized/i,      // 401 不算错误
  /Forbidden/i,         // 403 不算错误
  /Not Found/i,         // 404 不算错误
]
```

## 2. 关键指标监控

### 2.1 指标端点

**健康检查** (公开):

```bash
curl http://localhost:3456/api/health
```

响应示例:

```json
{
  "status": "ok",
  "timestamp": "2026-08-30T10:30:00.000Z",
  "uptime": 86400
}
```

**指标摘要** (需认证):

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3456/api/metrics
```

响应示例:

```json
{
  "success": true,
  "data": {
    "uptime": {
      "seconds": 86400,
      "hours": 24,
      "days": 1
    },
    "requests": {
      "total": 15234,
      "perSecond": 0.18,
      "perMinute": 10.58
    },
    "errors": {
      "total": 23,
      "rate": 0.15,
      "byEndpoint": {
        "POST /api/checkin/upload": 15,
        "GET /api/wx-users": 8
      }
    },
    "responseTime": {
      "p50": 45,
      "p95": 230,
      "p99": 450,
      "average": 89,
      "samples": 1000
    },
    "topEndpoints": {
      "GET /api/dashboard": 3456,
      "GET /api/wx-users": 2345,
      "POST /api/checkin/upload": 1234
    }
  }
}
```

### 2.2 关键指标阈值

| 指标 | 警告阈值 | 严重阈值 | 说明 |
|------|---------|---------|------|
| 错误率 | >1% | >5% | 5xx 状态码占比 |
| P95 响应时间 | >500ms | >2000ms | 95% 请求的响应时间 |
| P99 响应时间 | >1000ms | >5000ms | 99% 请求的响应时间 |
| 服务可用性 | <99% | <95% | uptime / total_time |
| 磁盘使用率 | >80% | >90% | 日志和数据目录 |

### 2.3 配置 Uptime 监控（推荐）

使用免费服务监控服务可用性：

- **UptimeRobot**: https://uptimerobot.com/
- **Pingdom**: https://www.pingdom.com/
- **Healthchecks**: https://healthchecks.io/

配置监控 `/api/health` 端点，每 5 分钟检查一次。

## 3. 日志管理

### 3.1 日志位置

| 日志类型 | 位置 | 说明 |
|---------|------|------|
| PM2 应用日志 | `~/.pm2/logs/` | Fastify 应用输出 |
| Nginx 访问日志 | `/var/log/nginx/access.log` | HTTP 请求记录 |
| Nginx 错误日志 | `/var/log/nginx/error.log` | Nginx 错误 |
| 应用自定义日志 | `/var/log/learngrow-crm/` | 业务日志（如有） |

### 3.2 日志轮转配置

**自动轮转** (推荐配置 cron):

```bash
# 编辑 crontab
crontab -e

# 添加每日凌晨 0 点执行
0 0 * * * /opt/learngrow-crm/current/scripts/log-rotate.sh >> /var/log/log-rotate.log 2>&1
```

**手动执行**:

```bash
# 完整轮转
./scripts/log-rotate.sh

# 仅清理旧日志
./scripts/log-rotate.sh --cleanup-only

# 预演模式（不实际操作）
./scripts/log-rotate.sh --dry-run
```

**轮转策略**:

- 昨天的日志会被压缩为 `.gz` 格式
- 保留最近 30 天的日志
- 超过 30 天的日志自动删除
- PM2 日志通过 `pm2 reloadLogs` 轮转

### 3.3 查看日志

**PM2 实时日志**:

```bash
pm2 logs learngrow-crm --lines 100
```

**PM2 错误日志**:

```bash
tail -f ~/.pm2/logs/learngrow-crm-error.log
```

**Nginx 访问日志** (最近 100 条):

```bash
tail -n 100 /var/log/nginx/access.log
```

**搜索特定错误**:

```bash
grep "ERROR" ~/.pm2/logs/learngrow-crm-error.log | tail -20
```

### 3.4 日志分析

**统计每小时请求数**:

```bash
awk '{print $4}' /var/log/nginx/access.log | cut -d: -f1-2 | sort | uniq -c
```

**统计 Top 10 IP**:

```bash
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10
```

**统计 5xx 错误**:

```bash
awk '$9 >= 500' /var/log/nginx/access.log | wc -l
```

## 4. 告警配置

### 4.1 企业微信机器人

**创建群机器人**:

1. 在企业微信群聊中，点击右上角 `...`
2. 选择 **添加群机器人**
3. 输入名称（如 "CRM 监控"）
4. 复制 Webhook URL

**配置环境变量**:

```bash
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx
```

**测试通知**:

```bash
curl -X POST "$WECHAT_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"msgtype":"text","text":{"content":"测试告警"}}'
```

### 4.2 邮件告警（Sentry）

在 Sentry 项目设置中配置 **Notifications**:

1. 进入 **Project Settings → Notifications**
2. 添加团队成员邮箱
3. 配置告警规则触发邮件

### 4.3 短信告警（可选）

对于严重告警（服务不可用），可接入短信服务：

- **阿里云短信**: https://dysms.console.aliyun.com/
- **腾讯云短信**: https://console.cloud.tencent.com/sms

编写告警脚本 `scripts/alert-sms.sh`:

```bash
#!/bin/bash
PHONE=$1
MESSAGE=$2

# 调用阿里云短信 API
curl -X POST "https://dysmsapi.aliyuncs.com/" \
  -d "PhoneNumbers=$PHONE" \
  -d "SignName=LearnGrow" \
  -d "TemplateCode=SMS_123456" \
  -d "TemplateParam={\"message\":\"$MESSAGE\"}"
```

## 5. Grafana 可视化（可选）

### 5.1 安装 Grafana

```bash
# Ubuntu
sudo apt-get install -y grafana

# 启动服务
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

### 5.2 配置数据源

使用 **Simple JSON** 插件对接 `/api/metrics` 端点：

1. 安装插件: `grafana-cli plugins install simpod-json-datasource`
2. 添加数据源: Configuration → Data Sources → Simple JSON
3. URL: `http://localhost:3456/api/metrics`

### 5.3 导入 Dashboard

参考 `docs/grafana-dashboard.json`（待创建）导入预设面板。

## 6. 故障排查

### 6.1 Sentry 未上报错误

```bash
# 检查 DSN 配置
echo $SENTRY_DSN

# 检查网络连接
curl -I https://o123456.ingest.sentry.io/

# 查看 Sentry SDK 日志
NODE_ENV=production node -e "
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN, debug: true });
Sentry.captureException(new Error('test'));
"
```

### 6.2 指标端点返回空数据

```bash
# 检查中间件是否注册
grep "metricsMiddleware" api/app.ts

# 手动触发请求后再次查询
curl http://localhost:3456/api/health
curl http://localhost:3456/api/metrics
```

### 6.3 日志文件占满磁盘

```bash
# 紧急清理
./scripts/log-rotate.sh --cleanup-only

# 检查大文件
du -sh ~/.pm2/logs/* | sort -rh | head -5

# 手动清空
truncate -s 0 ~/.pm2/logs/learngrow-crm-error.log
```

### 6.4 告警频繁触发

调整 Sentry 告警规则的采样率或阈值：

```typescript
// api/sentry.ts
tracesSampleRate: 0.05,  // 降低到 5%
profilesSampleRate: 0.05,
```

## 7. 最佳实践

### Do's

- ✅ 定期检查 Sentry 后台的错误趋势
- ✅ 每周审查日志文件大小和磁盘使用
- ✅ 每月审查告警规则，减少噪音
- ✅ 保留至少 30 天的日志用于问题回溯
- ✅ 为关键指标设置基线，及时发现异常

### Don'ts

- ❌ 不要在日志中打印敏感信息（密码、Token）
- ❌ 不要禁用日志轮转导致磁盘写满
- ❌ 不要忽略持续出现的警告
- ❌ 不要在 Sentry 中暴露用户 PII 数据

## 8. 参考资源

- [Sentry Node.js 文档](https://docs.sentry.io/platforms/javascript/)
- [Sentry React 文档](https://docs.sentry.io/platforms/javascript/guides/react/)
- [PM2 日志管理](https://pm2.keymetrics.io/docs/usage/log-management/)
- [Nginx 日志轮转](https://nginx.org/en/docs/http/ngx_http_log_module.html)
- [Grafana 入门教程](https://grafana.com/docs/grafana/latest/getting-started/)

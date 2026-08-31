# 企业微信告警配置指南

## 1. 创建企业微信群机器人

1. 打开企业微信，进入需要接收告警的群聊
2. 点击右上角「...」→「添加群机器人」
3. 点击「新建机器人」
4. 设置机器人名称（如：LearnGrow CRM 监控）
5. 复制 webhook 地址（格式：`https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxx`）

## 2. 配置 Webhook URL

### 方式一：通过 PM2 环境变量（推荐）

```bash
# SSH 登录服务器
ssh ubuntu@124.220.103.120

# 设置 webhook URL（替换 YOUR_KEY 为实际 key）
pm2 set learngrow-crm WECHAT_WEBHOOK_URL 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY'

# 重启服务使配置生效
pm2 restart learngrow-crm
```

### 方式二：通过 .env.production 文件

在服务器上编辑 `~/learngrow-crm/current/.env.production`，添加：

```bash
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY
```

然后重启 PM2：

```bash
pm2 reload ecosystem.config.cjs --env production
```

## 3. 测试告警

```bash
# SSH 登录服务器
ssh ubuntu@124.220.103.120

# 测试发送告警
cd ~/learngrow-crm/current
./scripts/wechat-alert.sh "这是一条测试消息" "info"

# 运行完整监控检查
./scripts/monitor.sh
```

如果配置成功，你会在企业微信群收到消息。

## 4. 定时监控任务

已配置以下定时任务：

### 每日备份（凌晨 3:30）
```bash
30 3 * * * cd /home/ubuntu/learngrow-crm/current && /bin/bash /home/ubuntu/learngrow-crm/current/scripts/auto-backup.sh >> ~/learngrow-crm/logs/backup.log 2>&1
```

### 每小时健康检查（整点）
```bash
0 * * * * cd /home/ubuntu/learngrow-crm/current && /bin/bash /home/ubuntu/learngrow-crm/current/scripts/monitor.sh --quiet >> ~/learngrow-crm/logs/monitor.log 2>&1
```

添加每小时监控任务：

```bash
ssh ubuntu@124.220.103.120 "(crontab -l; echo '0 * * * * cd /home/ubuntu/learngrow-crm/current && /bin/bash /home/ubuntu/learngrow-crm/current/scripts/monitor.sh --quiet >> ~/learngrow-crm/logs/monitor.log 2>&1') | crontab -"
```

## 5. 告警类型

| 类型 | 图标 | 颜色 | 使用场景 |
|------|------|------|---------|
| danger | 🚨 | 红色 | 服务宕机、数据丢失、数据库损坏 |
| warning | ⚠️ | 橙色 | 备份超时、磁盘空间不足、数据异常 |
| info | ℹ️ | 蓝色 | 部署成功、备份完成、系统通知 |
| success | ✅ | 绿色 | 恢复成功、检查通过 |

## 6. 监控指标

当前监控脚本会检查：

1. **服务状态**：HTTP 健康检查
2. **数据库文件**：是否存在
3. **数据完整性**：微信用户数、孩子档案数
4. **备份状态**：最新备份时间
5. **磁盘空间**：使用率超过 80% 警告，90% 告警
6. **PM2 进程**：进程是否在线

## 7. 常见问题

### Q: 收不到告警消息？
A: 检查以下几点：
1. Webhook URL 是否正确
2. 企业微信机器人是否被禁用
3. 网络连接是否正常（`curl $WECHAT_WEBHOOK_URL`）
4. 查看日志：`tail ~/learngrow-crm/logs/monitor.log`

### Q: 如何临时关闭告警？
A: 取消 cron job 或注释掉对应的行：
```bash
crontab -e
# 在对应行前加 # 注释掉
```

### Q: 如何更改告警阈值？
A: 编辑 `scripts/monitor.sh`，修改对应的数值：
```bash
# 微信用户数阈值
if [ "$WX_USERS" -lt 50 ]; then  # 改为其他数值

# 磁盘使用率阈值
if [ "$DISK_USAGE" -gt 90 ]; then  # 改为其他百分比
```

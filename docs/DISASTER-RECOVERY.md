# LearnGrow CRM 灾难恢复手册

## 快速响应清单

### 1. 数据丢失应急流程

**症状**：发现生产环境数据异常或丢失

**立即行动**：
```bash
# 1. 停止服务，防止进一步写入
ssh ubuntu@124.220.103.120 "cd ~/learngrow-crm/current && pm2 stop learngrow-crm"

# 2. 检查当前数据库状态
ssh ubuntu@124.220.103.120 "cd ~/learngrow-crm/current && node -e \"
const Database = require('better-sqlite3');
const db = new Database('/home/ubuntu/learngrow-crm/data/learngrow.db');
console.log('微信用户:', db.prepare('SELECT COUNT(*) as c FROM wx_users').get().c);
console.log('孩子档案:', db.prepare('SELECT COUNT(*) as c FROM children').get().c);
\""

# 3. 查找最近的备份
ssh ubuntu@124.220.103.120 "ls -lt ~/learngrow-crm/backups/"

# 4. 恢复备份（替换 DATABASE_PATH 为实际备份路径）
ssh ubuntu@124.220.103.120 "
cd ~/learngrow-crm
cp data/learngrow.db data/learngrow.db.corrupted-\$(date +%Y%m%d%H%M%S)
cp backups/db_learngrow_YYYYMMDD_HHMMSS.db data/learngrow.db
pm2 start ecosystem.config.cjs --env production
"

# 5. 验证恢复结果
ssh ubuntu@124.220.103.120 "curl http://localhost:3456/api/health"
```

### 2. 服务不可用应急流程

**症状**：服务无响应、健康检查失败

**立即行动**：
```bash
# 1. 检查 PM2 状态
ssh ubuntu@124.220.103.120 "pm2 status"

# 2. 查看错误日志
ssh ubuntu@124.220.103.120 "pm2 logs learngrow-crm --lines 100"

# 3. 重启服务
ssh ubuntu@124.220.103.120 "cd ~/learngrow-crm/current && pm2 restart learngrow-crm"

# 4. 如果重启失败，回滚到上一个版本
ssh ubuntu@124.220.103.120 "
cd ~/learngrow-crm
ln -sfn releases/v3.3.15 current  # 替换为实际版本号
pm2 restart learngrow-crm
"
```

## 备份策略

### 自动备份机制

**本地备份**（服务器）：
- 位置：`~/learngrow-crm/backups/`
- 频率：每日凌晨 3:30 自动执行
- 保留策略：
  - 最近 7 天：每日备份
  - 最近 30 天：每周日备份
  - 最近 90 天：每月 1 号备份

**异地备份**（腾讯云 COS）：
- Bucket: `learngrow-crm-backups`
- 频率：每周日上传
- 加密：AES-256

### 手动触发备份

```bash
# 本地备份
./scripts/auto-backup.sh

# 本地 + 上传 COS
./scripts/auto-backup.sh --upload-cos
```

### 验证备份有效性

```bash
# 定期检查备份文件完整性
./scripts/verify-backup.sh backups/db_learngrow_YYYYMMDD_HHMMSS.db
```

## 恢复时间目标 (RTO) 和恢复点目标 (RPO)

| 故障类型 | RTO (恢复时间) | RPO (数据损失) |
|---------|--------------|--------------|
| 服务宕机 | < 5 分钟 | 0 (无数据损失) |
| 数据库损坏 | < 15 分钟 | < 24 小时 (最近一次备份) |
| 服务器完全故障 | < 2 小时 | < 7 天 (最近一次异地备份) |

## 紧急联系人

- **技术负责人**: [你的名字]
- **备用联系人**: [备用人员]
- **云服务器支持**: 腾讯云工单系统

## 常用诊断命令

```bash
# 检查服务状态
pm2 status
pm2 logs learngrow-crm --lines 50

# 检查数据库状态
node -e "const Database = require('better-sqlite3'); const db = new Database('/home/ubuntu/learngrow-crm/data/learngrow.db'); console.log(db.prepare('SELECT COUNT(*) as c FROM wx_users').get());"

# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 检查网络连接
curl -I http://localhost:3456/api/health
```

## 预防措施

1. **部署前必须**：
   - 运行 `./scripts/deploy.sh --dry-run` 预检
   - 确认备份已完成且有效
   - 在测试环境验证新版本

2. **日常维护**：
   - 每日检查备份日志
   - 每周验证一次备份可恢复性
   - 每月进行一次完整的灾难恢复演练

3. **监控告警**：
   - 企业微信机器人监控服务状态
   - 数据库大小异常增长告警
   - 关键数据量波动告警

## 附录：常见故障场景

### 场景 1：部署后数据丢失
**原因**：数据库路径配置错误，指向了空数据库
**解决**：从备份恢复，修复配置文件中的 DATABASE_URL

### 场景 2：数据库文件损坏
**原因**：磁盘故障、异常关机
**解决**：从最近的有效备份恢复

### 场景 3：误删除重要数据
**原因**：人为操作失误
**解决**：从备份恢复，或者使用 SQLite 恢复工具尝试恢复

### 场景 4：服务器被攻击
**原因**：安全漏洞
**解决**：
1. 立即断开网络
2. 从干净的备份恢复到新服务器
3. 修补安全漏洞
4. 修改所有密码和密钥

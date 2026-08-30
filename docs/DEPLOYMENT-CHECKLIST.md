# v2.7.0 部署前检查清单

**版本:** v2.7.0 - 安全合规加固  
**分支:** feature/v2.7.0-security-hardening  
**部署日期:** 待填写  
**部署人:** @caijuren

---

## ✅ 已完成项

### 1. 代码质量
- [x] 所有测试通过 (17/17 tests passed)
- [x] TypeScript编译无错误
- [x] ESLint无严重警告
- [x] 版本号显示已修复（动态获取）

### 2. 功能验证
- [x] 密钥轮换脚本测试通过
- [x] 用户删除接口测试通过（5个用例）
- [x] 备份加密测试通过
- [x] 隐私政策页面更新完成

### 3. 数据库迁移
- [x] deleted_at字段添加脚本就绪
- [x] 9个表已添加deleted_at字段和索引
- [x] 审计日志表创建逻辑就绪

### 4. 文档完善
- [x] CHANGELOG.md 已更新
- [x] 隐私政策文档完成
- [x] 备份加密指南完成
- [x] 密钥轮换指南完成

---

## ⏳ 待执行项（生产环境）

### 1. 服务器准备
```bash
# SSH登录
ssh ubuntu@124.220.103.120

# 进入项目目录
cd /home/ubuntu/LearnGrow-CRM

# 拉取最新代码
git pull origin feature/v2.7.0-security-hardening

# 切换到main分支（如果直接合并）
git checkout main
git merge feature/v2.7.0-security-hardening
```

### 2. 环境变量配置
```bash
# 编辑 .env.production
vim .env.production

# 确认以下密钥已更新：
JWT_SECRET=ceae8b586cb39c030d28088590f079ca58462d51f775d3296f62c60c5a89096e4b28d6c0e0fc49148766231e574a245e
INITIAL_ADMIN_PASSWORD=N^F%GivNb8XfXWmNTtdU
BACKUP_ENCRYPTION_KEY=2b261974a16da0a632113b1268c0622f98b29056a40287ecc953a4de9a4bb994
```

### 3. 数据库迁移
```bash
# 先备份当前数据库
npm run backup

# 运行迁移脚本
npx tsx scripts/add-deleted-at-columns.ts

# 验证迁移结果
# 应该看到9个表都添加了deleted_at字段
```

### 4. 安装依赖并构建
```bash
# 清理安装依赖
npm ci

# TypeScript类型检查
npm run check

# 构建前端
npm run build
```

### 5. 重启服务
```bash
# 停止服务
pm2 stop learngrow-crm

# 重新启动
pm2 startOrReload ecosystem.config.cjs --only learngrow-crm

# 查看状态
pm2 status
pm2 logs learngrow-crm --lines 50
```

### 6. 功能验证
```bash
# 健康检查
curl http://localhost:3456/api/health

# 测试管理员登录
curl -X POST http://localhost:3456/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"N^F%GivNb8XfXWmNTtdU"}'

# 验证HTTPS访问
curl https://tangma.quxueban.cn/api/health
```

### 7. 小程序验证
- [ ] 打开小程序，检查登录是否正常
- [ ] 查看隐私政策页面是否可访问
- [ ] 测试打卡功能是否正常
- [ ] 检查排行榜等核心功能

### 8. 管理端验证
- [ ] 登录管理端，检查左上角版本号是否显示v2.6.0
- [ ] 测试微信用户列表加载
- [ ] 测试订单管理
- [ ] 测试打卡审核

### 9. 备份验证
```bash
# 手动创建一次备份
npm run backup

# 检查备份文件是否生成
ls -lh backups/

# 验证备份是否加密（应看到.enc后缀）
```

### 10. 监控设置
- [ ] 观察PM2日志30分钟
- [ ] 检查CPU/内存使用率
- [ ] 验证磁盘空间充足
- [ ] 确认备份定时任务正常运行

---

## 🚨 回滚预案

如遇到严重问题，执行以下回滚步骤：

```bash
# 1. 停止服务
pm2 stop learngrow-crm

# 2. 恢复上一个稳定版本
git checkout HEAD~1  # 或指定具体tag

# 3. 恢复数据库备份
npm run backup:restore -- backups/backup_YYYYMMDDHHmmss.zip

# 4. 重新启动
pm2 start learngrow-crm

# 5. 验证功能
curl http://localhost:3456/api/health
```

---

## 📞 联系方式

- **部署负责人:** @caijuren
- **技术支持:** support@example.com
- **紧急联系:** 企业微信群

---

**预计部署时间:** 30-45分钟  
**最佳部署窗口:** 凌晨3:00-4:00（低峰期）

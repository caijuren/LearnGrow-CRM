# 密钥轮换指南 - v2.7.0

**最后更新:** 2026-09-01  
**版本:** v2.7.0

---

## 概述

定期轮换密钥是保障系统安全的重要措施。本指南说明如何安全地轮换LearnGrow CRM中的各类密钥。

---

## 需要轮换的密钥

| 密钥 | 环境变量 | 建议周期 | 影响范围 |
|------|---------|---------|---------|
| JWT签名密钥 | `JWT_SECRET` | 3个月 | 所有登录会话 |
| 备份加密密钥 | `BACKUP_ENCRYPTION_KEY` | 6个月 | 备份文件加解密 |
| 微信AppSecret | `WX_SECRET` | 按微信要求 | 小程序API调用 |
| 管理员密码 | `INITIAL_ADMIN_PASSWORD` | 3个月 | 后台管理登录 |

---

## JWT_SECRET 轮换流程

### 频率: 每3个月

### 步骤1: 生成新密钥

```bash
npx tsx scripts/rotate-keys.ts
```

或手动生成：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 步骤2: 选择低峰期执行

建议在**凌晨3:00-4:00**执行，此时用户活跃度最低。

### 步骤3: 更新生产环境配置

```bash
# SSH登录服务器
ssh ubuntu@124.220.103.120

# 编辑配置文件
vim /path/to/.env.production

# 替换JWT_SECRET为新值
JWT_SECRET=your_new_96_char_hex_string_here
```

### 步骤4: 重启服务

```bash
# 进入项目目录
cd /path/to/LearnGrow-CRM

# 重启服务
pm2 restart learngrow-crm

# 验证服务状态
pm2 status
```

### 步骤5: 验证功能

测试以下功能是否正常：
- ✅ 管理员登录
- ✅ 小程序用户登录
- ✅ API接口调用
- ✅ 打卡提交

### 步骤6: 通知团队

通过安全渠道（如1Password）分享新密钥给团队成员。

### 步骤7: 保留旧密钥24小时

在安全位置保存旧密钥，以便紧急回滚。

---

## BACKUP_ENCRYPTION_KEY 轮换流程

### 频率: 每6个月

### 注意事项

轮换备份加密密钥前，需要：
1. **解密所有旧备份**（使用旧密钥）
2. **重新加密**（使用新密钥）

### 步骤1: 生成新密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 步骤2: 解密现有备份

```bash
# 遍历所有加密备份
for backup in backups/*.enc; do
  npx tsx scripts/decrypt-backup.ts "$backup"
done
```

### 步骤3: 更新配置并重新加密

```bash
# 更新 .env.production
BACKUP_ENCRYPTION_KEY=new_key_here

# 重新加密备份
for zip in backups/backup_*.zip; do
  npx tsx scripts/encrypt-existing-backup.ts "$zip"
done
```

### 步骤4: 删除明文备份

```bash
# 确认加密成功后删除明文zip
rm backups/backup_*.zip
```

---

## WX_SECRET 轮换流程

### 频率: 按微信平台要求或泄露时

### 步骤1: 微信公众平台重置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发」→「开发管理」→「开发设置」
3. 点击「重置」AppSecret
4. 复制新的AppSecret

### 步骤2: 更新配置

```bash
# 更新 .env.production
WX_SECRET=new_wx_secret_here

# 重启服务
pm2 restart learngrow-crm
```

### 步骤3: 验证小程序功能

- ✅ 小程序登录
- ✅ 订阅消息发送
- ✅ 用户信息获取

---

## 管理员密码轮换流程

### 频率: 每3个月

### 步骤1: 生成强密码

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

或使用密码管理器生成。

### 步骤2: 重置管理员密码

```bash
npm run admin:reset
```

按提示输入新密码。

### 步骤3: 验证登录

- ✅ 使用新密码登录管理端
- ✅ 验证权限正常

### 步骤4: 通知其他管理员

通过安全渠道分享新密码。

---

## 紧急情况处理

### 场景1: 密钥泄露

**立即行动:**
1. 立即轮换泄露的密钥
2. 检查审计日志，确认泄露范围
3. 如有数据泄露，通知受影响的用户
4. 向安全团队报告

### 场景2: 忘记密钥

**恢复方法:**
1. 从密码管理器中查找
2. 询问其他管理员
3. 如无法恢复，可能需要：
   - JWT_SECRET: 所有用户需重新登录
   - BACKUP_ENCRYPTION_KEY: 旧备份无法解密

### 场景3: 轮换后服务异常

**回滚步骤:**
```bash
# 恢复旧密钥
vim .env.production
# 粘贴旧JWT_SECRET

# 重启服务
pm2 restart learngrow-crm

# 验证功能
curl https://your-domain.com/api/health
```

---

## 自动化密钥轮换

### 设置定时提醒

使用日历或任务管理工具设置提醒：
- JWT_SECRET: 每3个月
- BACKUP_ENCRYPTION_KEY: 每6个月
- 管理员密码: 每3个月

### GitHub Actions自动轮换 (高级)

可以配置自动化脚本定期轮换密钥：

```yaml
# .github/workflows/key-rotation.yml
name: Key Rotation Reminder
on:
  schedule:
    - cron: '0 0 1 */3 *'  # 每3个月1号
jobs:
  remind:
    runs-on: ubuntu-latest
    steps:
      - name: Send reminder
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.create({
              owner: 'caijuren',
              repo: 'LearnGrow-CRM',
              title: '🔑 JWT_SECRET 密钥轮换提醒',
              body: '根据安全策略，现在应该轮换JWT_SECRET密钥。请参考 docs/KEY_ROTATION.md'
            })
```

---

## 最佳实践

### ✅ 推荐做法

1. **使用密码管理器**
   - 1Password、Bitwarden等
   - 启用双因素认证

2. **定期审计**
   - 每季度检查密钥使用情况
   - 审查审计日志

3. **最小化知晓范围**
   - 仅管理员知晓密钥
   - 开发环境使用独立密钥

4. **文档化**
   - 记录每次轮换的时间和原因
   - 保留历史密钥清单（加密存储）

### ❌ 避免做法

1. **不要明文存储**
   - 不要写在代码注释中
   - 不要保存在桌面文本文件

2. **不要通过不安全渠道传递**
   - 避免微信/QQ明文发送
   - 避免邮件附件

3. **不要长期不轮换**
   - 超过6个月未轮换会增加风险
   - 员工离职时应考虑轮换

4. **不要在公开场合讨论**
   - 不要在GitHub Issues中贴密钥
   - 不要在Stack Overflow提问时包含密钥

---

## 相关文档

- [备份加密指南](./BACKUP_ENCRYPTION.md)
- [隐私政策](./PRIVACY_POLICY.md)
- [安全注意事项](../README.md#安全注意事项)

---

**维护者:** LearnGrow CRM Security Team  
**下次审查日期:** 2026-12-01

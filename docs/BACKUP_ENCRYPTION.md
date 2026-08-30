# 备份加密指南 - v2.7.0

**最后更新:** 2026-09-01  
**版本:** v2.7.0

---

## 概述

从v2.7.0开始，LearnGrow CRM支持使用AES256-CBC算法加密备份文件，防止敏感数据泄露。

---

## 配置加密密钥

### 1. 生成加密密钥

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

输出示例：
```
2b261974a16da0a632113b1268c0622f98b29056a40287ecc953a4de9a4bb994
```

### 2. 配置环境变量

编辑 `.env.production` 文件：

```bash
BACKUP_ENCRYPTION_KEY=your_64_char_hex_string_here
```

**重要提示:**
- 密钥长度必须至少32字符（推荐64字符十六进制串）
- 不要将密钥提交到git
- 通过安全渠道传递密钥（如1Password、Bitwarden）

---

## 使用加密备份

### 方法1: 自动加密备份（推荐）

当配置了`BACKUP_ENCRYPTION_KEY`后，普通备份命令会自动加密：

```bash
npm run backup
```

生成的文件：
- `backup_20260901120000.zip.enc` - 加密后的备份文件

明文zip会被自动删除，只保留加密版本。

### 方法2: 手动加密现有备份

如果已有明文备份，可以手动加密：

```bash
npx tsx scripts/encrypt-existing-backup.ts backups/backup_20260901120000.zip
```

---

## 解密备份文件

### 方法1: 使用解密脚本

```bash
npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc
```

输出：
- `backups/backup_20260901120000.zip` - 解密后的明文zip

### 方法2: 指定输出路径

```bash
npx tsx scripts/decrypt-backup.ts backups/backup_20260901120000.zip.enc /tmp/decrypted.zip
```

### 方法3: 恢复时自动解密

恢复脚本会自动检测并处理加密备份：

```bash
npm run backup:restore -- backups/backup_20260901120000.zip.enc
```

---

## 验证加密功能

### 测试加密解密流程

```bash
BACKUP_ENCRYPTION_KEY="your_key_here" npx tsx scripts/test-encryption.ts
```

预期输出：
```
✅ 加密完成
✅ 解密完成
✅ 所有测试通过！
```

---

## 安全注意事项

### ⚠️ 密钥管理

1. **不要明文存储**
   - 使用密码管理器（1Password、Bitwarden等）
   - 不要通过微信/QQ发送

2. **定期轮换**
   - 建议每3个月更换一次密钥
   - 轮换前确保所有旧备份已解密或迁移

3. **访问控制**
   - 仅管理员知晓密钥
   - 生产环境密钥与开发环境分离

### ⚠️ 备份文件安全

1. **存储位置**
   - 加密后的备份可安全存储在云端
   - 但仍建议限制访问权限

2. **传输安全**
   - 即使已加密，仍建议使用HTTPS/SFTP传输
   - 避免通过邮件附件发送

3. **销毁旧备份**
   - 删除备份时使用安全删除工具
   - macOS: `srm` 命令
   - Linux: `shred` 命令

---

## 故障排查

### 问题1: 解密失败 "bad decrypt"

**原因:** 密钥不正确

**解决:**
```bash
# 检查密钥是否正确
echo $BACKUP_ENCRYPTION_KEY | wc -c

# 确认与加密时使用的密钥一致
cat .env.production | grep BACKUP_ENCRYPTION_KEY
```

### 问题2: 加密后备份体积变大

**说明:** 这是正常现象
- AES256-CBC会添加IV(16字节)和填充
- 体积增加通常<1%

### 问题3: 未配置密钥时备份失败

**解决:** 
- 未配置密钥时会降级为明文备份
- 控制台会显示警告信息
- 建议尽快配置密钥

---

## 技术细节

### 加密算法

- **算法:** AES-256-CBC
- **密钥长度:** 256位 (32字节)
- **IV:** 随机生成，16字节，存储在加密文件头部
- **填充:** PKCS#7

### 文件格式

```
[IV: 16 bytes] [Encrypted Data: variable length]
```

### 性能影响

- 加密速度: ~100MB/s (现代CPU)
- 对1GB备份的影响: <10秒
- 内存占用: 最小（流式处理）

---

## 相关文档

- [密钥轮换指南](./KEY_ROTATION.md)
- [备份恢复指南](../scripts/restore-backup.ts)
- [隐私政策](./PRIVACY_POLICY.md)

---

**维护者:** LearnGrow CRM Team  
**下次审查日期:** 2026-12-01

# SSL 证书自动化续期配置完成

## 配置时间
2026-08-31 17:49 (UTC+8)

## 📋 配置概览

### 已申请证书
- **主域名**: www.quxueban.cn
- **子域名**: edu.quxueban.cn
- **证书类型**: Let's Encrypt (免费，90天有效期)
- **当前到期日**: 2026-11-29
- **剩余天数**: 89 天

### ⚠️ 未包含域名
以下域名因 DNS 解析问题未能申请到 Let's Encrypt 证书：
- `quxueban.cn` - 缺少 A 记录（只有 www 有）
- `dy.quxueban.cn` - DNS 验证超时
- `tangma.quxueban.cn` - DNS 验证超时

**建议**: 联系域名注册商确认 DNS 配置正确，或继续使用现有商业证书。

## 🔧 自动化配置

### 1. Certbot 自动续期
- **工具**: Certbot 1.21.0 + Nginx 插件
- **自动续期**: 系统已配置 `certbot.timer`
- **检查频率**: 每天两次（systemd timer）
- **续期阈值**: 到期前 30 天自动续期

### 2. 自定义续期脚本
- **位置**: `/usr/local/bin/certbot-renew.sh`
- **功能**: 
  - 自动检测并续期证书
  - 更新 Nginx 配置指向新证书
  - 备份旧配置
  - 记录操作日志

### 3. 监控脚本
- **位置**: `/usr/local/bin/check-cert-expiry.sh`
- **功能**: 检查证书到期时间，提前 30 天告警
- **使用**: 手动运行或加入 cron

## 📁 文件位置

### 证书文件
```
/etc/letsencrypt/live/www.quxueban.cn/
├── fullchain.pem -> ../../archive/www.quxueban.cn/fullchain1.pem
├── privkey.pem -> ../../archive/www.quxueban.cn/privkey1.pem
├── cert.pem -> ../../archive/www.quxueban.cn/cert1.pem
└── chain.pem -> ../../archive/www.quxueban.cn/chain1.pem
```

### 配置文件
```
/usr/local/bin/
├── certbot-renew.sh          # 自动续期脚本
└── check-cert-expiry.sh      # 证书监控脚本

/etc/systemd/system/
├── certbot-renewal.service   # 自定义续期服务
└── certbot-renewal.timer     # 自定义续期定时器（每周）

/var/log/letsencrypt/
├── renew.log                 # 续期操作日志
└── letsencrypt.log           # Certbot 详细日志
```

### Nginx 配置更新
已自动更新的站点配置：
- `/etc/nginx/sites-enabled/quxueban` (www.quxueban.cn)
- `/etc/nginx/sites-enabled/edu.quxueban.cn`

证书路径已更新为：
```nginx
ssl_certificate /etc/letsencrypt/live/www.quxueban.cn/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/www.quxueban.cn/privkey.pem;
```

## 🔄 自动化流程

### Certbot 内置自动续期
```bash
# 系统自动运行，无需手动干预
sudo systemctl status certbot.timer
```

### 自定义续期定时器（备用）
```bash
# 每周一凌晨 3:00 执行（随机延迟最多 12 小时）
sudo systemctl status certbot-renewal.timer
```

## 📊 监控与告警

### 手动检查证书状态
```bash
# 查看证书详细信息
sudo openssl x509 -in /etc/letsencrypt/live/www.quxueban.cn/fullchain.pem -noout -dates -subject

# 运行监控脚本
/usr/local/bin/check-cert-expiry.sh
```

### 日志查看
```bash
# 查看续期操作日志
sudo tail -f /var/log/letsencrypt/renew.log

# 查看详细日志
sudo tail -f /var/log/letsencrypt/letsencrypt.log
```

## 🚨 故障处理

### 证书续期失败
```bash
# 1. 检查日志
sudo tail -100 /var/log/letsencrypt/letsencrypt.log

# 2. 手动续期测试
sudo certbot renew --dry-run

# 3. 强制续期
sudo certbot renew --force-renewal
```

### Nginx 配置错误
```bash
# 恢复备份配置
sudo cp /etc/nginx/sites-enabled/quxueban.bak.* /etc/nginx/sites-enabled/quxueban
sudo nginx -t && sudo systemctl reload nginx
```

### DNS 问题
如果域名解析有问题：
1. 检查 DNS 记录：`dig +short domain.com`
2. 确认域名指向服务器 IP：124.220.103.120
3. 联系域名注册商解决 DNSSEC 问题

## 📝 维护建议

### 每周检查
- 运行 `/usr/local/bin/check-cert-expiry.sh`
- 查看续期日志是否有错误

### 每月检查
- 验证所有域名 HTTPS 访问正常
- 检查 Nginx 配置是否正确

### 每季度
- 审查证书覆盖范围是否需要调整
- 考虑为缺失域名重新申请证书

## 🔐 安全注意事项

1. **私钥保护**: `/etc/letsencrypt/live/*/privkey.pem` 权限为 600
2. **定期备份**: 证书文件已包含在系统备份中
3. **监控告警**: 建议配置邮件通知（需额外设置）

## 📞 支持

- Let's Encrypt 官方文档: https://letsencrypt.org/docs/
- Certbot 用户指南: https://certbot.eff.org/docs/
- 问题排查: `/var/log/letsencrypt/letsencrypt.log`

---
配置完成时间: 2026-08-31  
下次证书到期: 2026-11-29  
自动续期状态: ✅ 已激活

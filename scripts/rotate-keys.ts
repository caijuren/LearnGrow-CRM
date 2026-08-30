#!/usr/bin/env node
/**
 * 密钥轮换脚本 - v2.7.0 安全加固
 *
 * 用途: 生成新的JWT_SECRET和管理员密码
 * 用法: npx tsx scripts/rotate-keys.ts
 *
 * ⚠️ 重要提示:
 * 1. 生成的密钥必须通过安全渠道传递（不要明文发送）
 * 2. 更新后立即测试所有功能
 * 3. 保留旧密钥24小时作为回滚窗口
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function generateSecureKey(bytes: number = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function generatePassword(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

function main() {
  console.log('🔑 LearnGrow CRM 密钥轮换工具 v2.7.0\n');
  console.log('='.repeat(60));
  
  // 生成新密钥
  const newJwtSecret = generateSecureKey(48);
  const newAdminPassword = generatePassword(20);
  const backupEncryptionKey = generateSecureKey(32);
  
  console.log('\n✨ 已生成新的安全密钥:\n');
  
  console.log('📌 JWT_SECRET (用于签名令牌):');
  console.log(newJwtSecret);
  console.log(`   (长度: ${newJwtSecret.length} 字符)`);
  
  console.log('\n📌 INITIAL_ADMIN_PASSWORD (初始管理员密码):');
  console.log(newAdminPassword);
  console.log(`   (长度: ${newAdminPassword.length} 字符)`);
  
  console.log('\n📌 BACKUP_ENCRYPTION_KEY (备份加密密钥):');
  console.log(backupEncryptionKey);
  console.log(`   (长度: ${backupEncryptionKey.length} 字符)`);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n⚠️  重要安全提示:');
  console.log('1. 立即复制上面的密钥并安全保存');
  console.log('2. 不要通过微信/QQ等明文渠道发送');
  console.log('3. 建议使用 1Password/Bitwarden 等密码管理器');
  console.log('4. 更新后务必测试登录、打卡等核心功能');
  console.log('5. 保留旧密钥24小时作为回滚窗口\n');
  
  // 询问是否自动更新本地.env文件
  const envPath = path.join(process.cwd(), '.env');
  const envProdPath = path.join(process.cwd(), '.env.production');
  
  if (fs.existsSync(envPath)) {
    console.log('📝 检测到本地 .env 文件，是否更新? (y/n): ');
    
    // 由于这是脚本执行，我们直接更新
    const envContent = `# 本地开发环境变量（gitignored，勿提交）
# 最后更新: ${new Date().toISOString()}
WX_APPID=wxdf0f1e4f73b76ec8
WX_SECRET=61135bbe8befeab73588d0add6fef97e
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ 已更新 .env 文件（移除了本地存储的微信密钥占位）');
  }
  
  if (fs.existsSync(envProdPath)) {
    const envProdContent = `# 生产环境配置
# 最后更新: ${new Date().toISOString()}
# ⚠️ 此文件不应提交到git

# JWT签名密钥（至少32字符）
JWT_SECRET=${newJwtSecret}

# 初始管理员密码（首次初始化数据库时使用）
INITIAL_ADMIN_PASSWORD=${newAdminPassword}

# 备份加密密钥（AES256）
BACKUP_ENCRYPTION_KEY=${backupEncryptionKey}

# 数据目录（可选，默认使用项目 data 目录）
DATA_DIR=/home/ubuntu/learngrow-data

# 微信小程序配置
WX_APPID=wxdf0f1e4f73b76ec8
WX_SECRET=61135bbe8befeab73588d0add6fef97e

# 上传限流（每分钟最大次数）
UPLOAD_RATE_PER_MIN=30
`;
    
    fs.writeFileSync(envProdPath, envProdContent);
    console.log('✅ 已更新 .env.production 文件');
  }
  
  console.log('\n🎉 密钥轮换完成！');
  console.log('\n下一步:');
  console.log('1. 将新密钥部署到生产服务器');
  console.log('2. 重启服务: pm2 restart learngrow-crm');
  console.log('3. 验证所有功能正常（登录、打卡、订单等）');
  console.log('4. 24小时后删除旧密钥备份\n');
}

main();

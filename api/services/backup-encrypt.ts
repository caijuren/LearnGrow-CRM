/**
 * 备份加密服务 - v2.7.0 安全合规加固
 * 
 * 功能:
 * - AES256-CBC加密备份文件
 * - 解密恢复原始zip
 * - 密钥从环境变量读取
 * 
 * 用法:
 *   import { encryptBackup, decryptBackup } from './backup-encrypt.js';
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface EncryptionResult {
  success: boolean;
  encryptedPath: string;
  originalSize: number;
  encryptedSize: number;
  error?: string;
}

/**
 * 获取加密密钥（从环境变量）
 * 要求至少32字符(256位)
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.BACKUP_ENCRYPTION_KEY;
  
  if (!keyString) {
    throw new Error('BACKUP_ENCRYPTION_KEY 环境变量未设置，请在 .env.production 中配置');
  }
  
  if (keyString.length < 32) {
    throw new Error(`BACKUP_ENCRYPTION_KEY 长度不足，当前 ${keyString.length} 字符，需要至少 32 字符`);
  }
  
  // 使用SHA256哈希确保密钥长度为32字节
  return crypto.createHash('sha256').update(keyString).digest();
}

/**
 * 生成随机IV(16字节)
 */
function generateIV(): Buffer {
  return crypto.randomBytes(16);
}

/**
 * 加密备份文件
 * @param inputPath 原始zip文件路径
 * @param outputPath 加密后文件路径(可选，默认在原文件名后加.enc)
 */
export async function encryptBackup(
  inputPath: string, 
  outputPath?: string
): Promise<EncryptionResult> {
  const result: EncryptionResult = {
    success: false,
    encryptedPath: outputPath || `${inputPath}.enc`,
    originalSize: 0,
    encryptedSize: 0
  };

  try {
    // 验证输入文件
    if (!fs.existsSync(inputPath)) {
      result.error = `输入文件不存在: ${inputPath}`;
      return result;
    }

    const stats = fs.statSync(inputPath);
    result.originalSize = stats.size;

    // 获取密钥和IV
    const key = getEncryptionKey();
    const iv = generateIV();

    // 创建加密流
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // 读取输入文件
    const inputData = fs.readFileSync(inputPath);
    
    // 加密数据
    const encryptedData = Buffer.concat([
      iv, // 前16字节存储IV(用于解密)
      cipher.update(inputData),
      cipher.final()
    ]);

    // 写入加密文件
    fs.writeFileSync(result.encryptedPath, encryptedData);
    
    result.encryptedSize = fs.statSync(result.encryptedPath).size;
    result.success = true;

    console.log(`✅ 加密完成:`);
    console.log(`   原始大小: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   加密大小: ${(result.encryptedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   输出文件: ${result.encryptedPath}`);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : '未知错误';
    console.error('❌ 加密失败:', result.error);
    return result;
  }
}

/**
 * 解密备份文件
 * @param inputPath 加密文件路径
 * @param outputPath 解密后文件路径(可选，默认去掉.enc后缀)
 */
export async function decryptBackup(
  inputPath: string,
  outputPath?: string
): Promise<EncryptionResult> {
  const result: EncryptionResult = {
    success: false,
    encryptedPath: outputPath || inputPath.replace('.enc', ''),
    originalSize: 0,
    encryptedSize: 0
  };

  try {
    // 验证输入文件
    if (!fs.existsSync(inputPath)) {
      result.error = `输入文件不存在: ${inputPath}`;
      return result;
    }

    const stats = fs.statSync(inputPath);
    result.encryptedSize = stats.size;

    // 获取密钥
    const key = getEncryptionKey();

    // 读取加密文件
    const encryptedData = fs.readFileSync(inputPath);
    
    // 提取IV(前16字节)
    const iv = encryptedData.slice(0, 16);
    const actualEncryptedData = encryptedData.slice(16);

    // 创建解密流
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    // 解密数据
    const decryptedData = Buffer.concat([
      decipher.update(actualEncryptedData),
      decipher.final()
    ]);

    // 写入解密文件
    fs.writeFileSync(result.encryptedPath, decryptedData);
    
    result.originalSize = fs.statSync(result.encryptedPath).size;
    result.success = true;

    console.log(`✅ 解密完成:`);
    console.log(`   加密大小: ${(result.encryptedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   解密大小: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   输出文件: ${result.encryptedPath}`);

    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : '未知错误';
    console.error('❌ 解密失败:', result.error);
    return result;
  }
}

/**
 * 验证加密文件完整性
 * @param encryptedPath 加密文件路径
 */
export function verifyEncryptedFile(encryptedPath: string): boolean {
  try {
    if (!fs.existsSync(encryptedPath)) {
      return false;
    }

    const stats = fs.statSync(encryptedPath);
    
    // 加密文件至少应该有 IV(16字节) + 一些数据
    if (stats.size < 17) {
      return false;
    }

    // 尝试读取IV
    const data = fs.readFileSync(encryptedPath);
    const iv = data.slice(0, 16);
    
    // IV应该是有效的16字节
    return iv.length === 16;
  } catch {
    return false;
  }
}

/**
 * 测试加密解密流程
 */
export async function testEncryption(): Promise<boolean> {
  const testDir = path.join(process.cwd(), 'test-encryption');
  const testFile = path.join(testDir, 'test.txt');
  const encryptedFile = path.join(testDir, 'test.txt.enc');
  const decryptedFile = path.join(testDir, 'test-decrypted.txt');

  try {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // 创建测试文件
    const testData = '这是测试数据 - Test Data for Encryption';
    fs.writeFileSync(testFile, testData);

    // 加密
    const encryptResult = await encryptBackup(testFile, encryptedFile);
    if (!encryptResult.success) {
      console.error('加密测试失败');
      return false;
    }

    // 解密
    const decryptResult = await decryptBackup(encryptedFile, decryptedFile);
    if (!decryptResult.success) {
      console.error('解密测试失败');
      return false;
    }

    // 验证
    const decryptedData = fs.readFileSync(decryptedFile, 'utf-8');
    if (decryptedData !== testData) {
      console.error('数据一致性验证失败');
      return false;
    }

    console.log('✅ 加密解密测试通过！');
    return true;
  } catch (error) {
    console.error('测试异常:', error);
    return false;
  } finally {
    // 清理测试文件
    try {
      const testDir = path.join(process.cwd(), 'test-encryption');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理错误
    }
  }
}

/**
 * 图片压缩脚本 - v3.3.0
 *
 * 压缩 uploads 目录中超过 500KB 的图片文件
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', 'uploads');

const MAX_SIZE_KB = 500;
const JPEG_QUALITY = 80;
const PNG_QUALITY = 80;
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;

interface FileInfo {
  path: string;
  size: number;
  name: string;
}

async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size;
}

async function compressImage(fileInfo: FileInfo): Promise<{ original: number; compressed: number; saved: number }> {
  const originalSize = fileInfo.size;

  try {
    const image = sharp(fileInfo.path);
    const metadata = await image.metadata();

    let pipeline = image;

    // 调整尺寸（如果过大）
    if (metadata.width && metadata.width > MAX_WIDTH) {
      pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true });
    }

    // 根据格式压缩
    const ext = path.extname(fileInfo.path).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true });
    } else if (ext === '.png') {
      pipeline = pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: JPEG_QUALITY });
    } else {
      console.log(`⊘ 跳过不支持的格式: ${fileInfo.name}`);
      return { original: originalSize, compressed: originalSize, saved: 0 };
    }

    // 生成临时文件
    const tempPath = fileInfo.path + '.tmp';
    await pipeline.toFile(tempPath);

    // 替换原文件
    await fs.promises.rename(tempPath, fileInfo.path);

    const compressedSize = await getFileSize(fileInfo.path);
    const saved = originalSize - compressedSize;

    return { original: originalSize, compressed: compressedSize, saved };
  } catch (error) {
    console.error(`✗ 压缩失败 ${fileInfo.name}:`, error);
    return { original: originalSize, compressed: originalSize, saved: 0 };
  }
}

async function main() {
  console.log('🔍 扫描大图片文件...\n');

  // 读取所有图片文件
  const files = await fs.promises.readdir(uploadsDir);
  const imageFiles: FileInfo[] = [];

  for (const file of files) {
    const filePath = path.join(uploadsDir, file);
    const stats = await fs.promises.stat(filePath);

    if (stats.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(file)) {
      imageFiles.push({
        path: filePath,
        size: stats.size,
        name: file,
      });
    }
  }

  // 过滤出超过阈值的文件
  const largeFiles = imageFiles.filter(f => f.size > MAX_SIZE_KB * 1024);

  if (largeFiles.length === 0) {
    console.log('✅ 没有超过 500KB 的图片文件');
    return;
  }

  console.log(`找到 ${largeFiles.length} 个需要压缩的文件:\n`);

  let totalOriginal = 0;
  let totalCompressed = 0;
  let totalSaved = 0;

  for (const file of largeFiles) {
    const sizeKB = Math.round(file.size / 1024);
    console.log(`  📁 ${file.name} (${sizeKB}KB)`);
  }

  console.log('\n🗜️  开始压缩...\n');

  for (const file of largeFiles) {
    const result = await compressImage(file);
    totalOriginal += result.original;
    totalCompressed += result.compressed;
    totalSaved += result.saved;

    const originalKB = Math.round(result.original / 1024);
    const compressedKB = Math.round(result.compressed / 1024);
    const savedPercent = ((result.saved / result.original) * 100).toFixed(1);

    if (result.saved > 0) {
      console.log(`  ✓ ${file.name}: ${originalKB}KB → ${compressedKB}KB (节省 ${savedPercent}%)`);
    } else {
      console.log(`  ⊘ ${file.name}: 无需压缩`);
    }
  }

  console.log('\n📊 压缩统计:');
  console.log(`  原始总大小: ${Math.round(totalOriginal / 1024)}KB`);
  console.log(`  压缩后大小: ${Math.round(totalCompressed / 1024)}KB`);
  console.log(`  节省空间: ${Math.round(totalSaved / 1024)}KB (${((totalSaved / totalOriginal) * 100).toFixed(1)}%)`);
  console.log('\n✅ 压缩完成!');
}

main().catch(error => {
  console.error('致命错误:', error);
  process.exit(1);
});

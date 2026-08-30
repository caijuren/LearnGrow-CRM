/**
 * Material Routes - 素材管理路由层
 * 
 * 职责：处理素材上传、查询、更新、删除等HTTP请求
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, type AuthUser } from '../middleware/auth.middleware.js';
import { 
  listMaterials, 
  getMaterialById, 
  uploadMaterial, 
  updateMaterial, 
  incrementDownloadCount, 
  deleteMaterial,
  generateUniqueFilename
} from '../services/material.service.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

export async function registerMaterialRoutes(app: FastifyInstance) {
  app.register(async function (router) {
    router.addHook('preHandler', authMiddleware);
    
    // 素材列表
    router.get('/', async (request: any) => {
      const { category, search, product_id } = request.query as any;
      const materials = listMaterials({ category, search, product_id });
      return { success: true, data: materials };
    });
    
    // 获取单个素材详情
    router.get('/:id', async (request: any, reply: any) => {
      const id = parseInt(request.params.id);
      const material = getMaterialById(id);
      
      if (!material) {
        return reply.code(404).send({ success: false, error: '资料不存在' });
      }
      
      return { success: true, data: material };
    });
    
    // 上传素材
    router.post('/upload', async (request: any, reply: any) => {
      try {
        const data = await request.file();
        if (!data) {
          return reply.code(400).send({ success: false, error: '未收到文件' });
        }

        const { category = 'other', description, tags: tagsStr, product_id } = data.fields as any;
        const cat = (category?.value || 'other') as any;

        const ext = path.extname(data.filename).toLowerCase();
        const uniqueName = generateUniqueFilename(data.filename);
        const filePath = path.join(uploadsDir, uniqueName);

        // 保存文件
        const writeStream = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
          data.file.pipe(writeStream);
          data.file.on('end', resolve);
          data.file.on('error', reject);
          writeStream.on('error', reject);
        });

        const stats = fs.statSync(filePath);
        const tags = tagsStr?.value ? JSON.parse(tagsStr.value) : [];
        const pid = product_id?.value ? parseInt(product_id.value) : null;
        const userId = (request.user as AuthUser).id;

        const material = uploadMaterial({
          filename: uniqueName,
          original_name: data.filename,
          file_path: filePath,
          file_size: stats.size,
          mime_type: data.mimetype,
          category: cat,
          tags,
          description: description?.value || undefined,
          product_id: pid || undefined,
          uploaded_by: userId
        });

        return { success: true, data: material };
      } catch (error: any) {
        return reply.code(400).send({ success: false, error: error.message });
      }
    });
    
    // 更新素材信息
    router.patch('/:id', async (request: any, reply: any) => {
      try {
        const id = parseInt(request.params.id);
        const result = updateMaterial(id, request.body);
        
        if (!result) {
          return { success: true, data: null };
        }
        
        return { success: true, data: result };
      } catch (error: any) {
        if (error.message === '资料不存在') {
          return reply.code(404).send({ success: false, error: error.message });
        }
        throw error;
      }
    });
    
    // 记录下载
    router.post('/:id/download', async (request: any, reply: any) => {
      try {
        const id = parseInt(request.params.id);
        const result = incrementDownloadCount(id);
        return { success: true, data: result };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
    
    // 删除素材
    router.delete('/:id', async (request: any, reply: any) => {
      try {
        const id = parseInt(request.params.id);
        deleteMaterial(id, uploadsDir);
        return { success: true, data: null };
      } catch (error: any) {
        return reply.code(404).send({ success: false, error: error.message });
      }
    });
  }, { prefix: '/api/materials' });
}

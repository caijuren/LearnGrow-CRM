/**
 * Product Service 单元测试
 * 测试产品管理的业务逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import db from '../../api/db.js';
import { listProducts, getProductById, createProduct, updateProduct } from '../../api/services/product.service.js';

describe('Product Service', () => {
  let testProductId: number;

  beforeEach(() => {
    // 创建测试产品
    const result = db.prepare(
      "INSERT INTO products (name, tier, category, price) VALUES (?, ?, ?, ?)"
    ).run('测试产品', 'main', '语文', 99.9);
    testProductId = result.lastInsertRowid as number;
  });

  afterEach(() => {
    // 清理测试数据
    db.prepare('DELETE FROM orders WHERE product_id = ?').run(testProductId);
    db.prepare('DELETE FROM products WHERE id = ?').run(testProductId);
  });

  describe('listProducts', () => {
    it('应该返回所有产品列表', () => {
      const result = listProducts();

      // listProducts 返回 { products, total } 对象
      expect(result).toHaveProperty('products');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.products)).toBe(true);
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.products.length);
    });

    it('应该能按 tier 过滤', () => {
      const result = listProducts({ tier: 'main' });

      if (Array.isArray(result.products)) {
        expect(result.products.every((p: any) => p.tier === 'main')).toBe(true);
      }
    });

    it('应该能按分类过滤', () => {
      const result = listProducts({ category: '语文' });

      if (Array.isArray(result.products)) {
        expect(result.products.every((p: any) => p.category === '语文')).toBe(true);
      }
    });

    it('应该能只返回在售产品', () => {
      const result = listProducts({ is_on_sale: true });

      if (Array.isArray(result.products)) {
        expect(result.products.every((p: any) => p.is_on_sale === 1)).toBe(true);
      }
    });
  });

  describe('getProductById', () => {
    it('应该能根据 ID 获取产品信息', () => {
      const product = getProductById(testProductId);

      expect(product).not.toBeNull();
      expect(product?.name).toBe('测试产品');
      expect(product?.price).toBe(99.9);
    });

    it('不存在的 ID 应该返回 null', () => {
      const product = getProductById(99999);
      expect(product).toBeNull();
    });
  });

  describe('createProduct', () => {
    it('应该能创建新产品', () => {
      const newProduct = createProduct({
        name: '新产品',
        tier: 'traffic',
        category: '数学',
        price: 49.9,
        commission_percent: 15,
      });

      expect(newProduct).toBeDefined();
      expect(newProduct.name).toBe('新产品');

      // 验证数据库中已存在
      const saved = getProductById(newProduct.id);
      expect(saved).not.toBeNull();
      expect(saved?.tier).toBe('traffic');
    });

    it('价格为负数时应该能创建（验证在数据库层）', () => {
      // Service 层不做验证，直接传入
      const result = createProduct({
        name: '负价产品',
        tier: 'main',
        price: -10,
      });

      expect(result).toBeDefined();
      expect(result.price).toBe(-10);
    });
  });

  describe('updateProduct', () => {
    it('应该能更新产品信息', () => {
      const updated = updateProduct(testProductId, {
        name: '更新后的产品',
        price: 129.9,
        is_on_sale: false,
      });

      expect(updated).toBeDefined();
      expect(updated.name).toBe('更新后的产品');

      // 验证数据库中的更改
      const saved = getProductById(testProductId);
      expect(saved?.is_on_sale).toBe(0);
    });

    it('更新不存在的记录应该抛出错误', () => {
      expect(() => {
        updateProduct(99999, { name: 'test' });
      }).toThrow();
    });
  });
});

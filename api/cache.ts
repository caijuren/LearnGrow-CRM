/**
 * 内存缓存工具类 - v3.3.0
 *
 * 提供基于 TTL 的内存缓存，用于提升高频查询接口的响应速度
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheOptions {
  ttlMs: number;           // 缓存存活时间（毫秒）
  refreshThreshold?: number; // 刷新阈值（毫秒），在过期前 N 毫秒内访问时触发后台刷新
  key?: string;            // 缓存键名
}

class MemoryCache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DEFAULT_CLEANUP_INTERVAL = 60 * 1000; // 1分钟清理一次

  constructor() {
    // 启动定期清理过期条目
    this.startCleanup();
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, options: CacheOptions): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + options.ttlMs,
      createdAt: Date.now(),
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 获取或设置缓存（带后台刷新）
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      // 检查是否需要后台刷新
      const entry = this.store.get(key);
      if (entry && options.refreshThreshold) {
        const remainingTime = entry.expiresAt - Date.now();
        if (remainingTime < options.refreshThreshold) {
          // 后台刷新（不阻塞返回）
          this.refreshInBackground(key, fetcher, options);
        }
      }
      return cached;
    }

    // 缓存未命中，重新获取
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * 后台刷新缓存
   */
  private async refreshInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, options);
    } catch (error) {
      console.warn(`[Cache] Background refresh failed for key "${key}":`, error);
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.store.entries()) {
        if (now > entry.expiresAt) {
          this.store.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
      }
    }, this.DEFAULT_CLEANUP_INTERVAL);
  }

  /**
   * 停止清理定时器（用于优雅关闭）
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取缓存统计信息
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
    };
  }
}

// 导出单例实例
export const cache = new MemoryCache();

// ============================================================================
// 预定义缓存配置
// ============================================================================

/**
 * Dashboard 数据缓存（5分钟 TTL）
 */
export const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5分钟
export const DASHBOARD_CACHE_KEY = 'dashboard:data';

/**
 * 微信用户列表缓存（2分钟 TTL）
 */
export const WX_USERS_CACHE_TTL = 2 * 60 * 1000; // 2分钟
export function getWxUsersCacheKey(page: number, limit: number): string {
  return `wx_users:list:${page}:${limit}`;
}

/**
 * 产品列表缓存（10分钟 TTL，产品变化少）
 */
export const PRODUCTS_CACHE_TTL = 10 * 60 * 1000; // 10分钟
export const PRODUCTS_CACHE_KEY = 'products:list';

/**
 * 打卡活动列表缓存（3分钟 TTL）
 */
export const CHECKIN_EVENTS_CACHE_TTL = 3 * 60 * 1000; // 3分钟
export const CHECKIN_EVENTS_CACHE_KEY = 'checkin_events:list';

/**
 * 学习路径缓存（10分钟 TTL）
 */
export const LEARNING_PATHS_CACHE_TTL = 10 * 60 * 1000; // 10分钟
export const LEARNING_PATHS_CACHE_KEY = 'learning_paths:list';

/**
 * 教材版本缓存（10分钟 TTL）
 */
export const TEXTBOOKS_CACHE_TTL = 10 * 60 * 1000; // 10分钟
export const TEXTBOOKS_CACHE_KEY = 'textbooks:list';

/**
 * 微信群列表缓存（5分钟 TTL）
 */
export const WECHAT_GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5分钟
export const WECHAT_GROUPS_CACHE_KEY = 'wechat_groups:list';

/**
 * 设置项缓存（10分钟 TTL）
 */
export const SETTINGS_CACHE_TTL = 10 * 60 * 1000; // 10分钟
export function getSettingsCacheKey(key: string): string {
  return `settings:${key}`;
}

/**
 * 清除相关缓存（当数据更新时调用）
 */
export function invalidateCache(pattern: string): void {
  const keys = Array.from(cache.stats().keys);
  for (const key of keys) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * 清除所有列表缓存（批量更新后调用）
 */
export function invalidateAllListCaches(): void {
  cache.clear();
}

// 导出默认配置
export default cache;

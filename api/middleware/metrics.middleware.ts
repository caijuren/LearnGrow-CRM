/**
 * 关键指标监控中间件 - v3.2.0
 *
 * 收集和暴露 API 性能指标：响应时间、错误率、请求数等
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

// 内存存储指标数据（生产环境建议接入 Prometheus）
interface MetricsData {
  totalRequests: number;
  totalErrors: number;
  responseTimes: number[];
  requestsByEndpoint: Record<string, number>;
  errorsByEndpoint: Record<string, number>;
  startTime: number;
}

let metrics: MetricsData = {
  totalRequests: 0,
  totalErrors: 0,
  responseTimes: [],
  requestsByEndpoint: {},
  errorsByEndpoint: {},
  startTime: Date.now(),
};

// 保留最近 1000 个响应时间用于百分位计算
const MAX_RESPONSE_TIMES = 1000;

/**
 * 请求指标收集中间件
 */
export function metricsMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void
) {
  const startTime = Date.now();

  // 监听响应完成事件
  reply.raw.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const endpoint = `${request.method} ${request.routeOptions.url || request.url}`;

    metrics.totalRequests += 1;
    metrics.responseTimes.push(responseTime);

    // 限制数组大小
    if (metrics.responseTimes.length > MAX_RESPONSE_TIMES) {
      metrics.responseTimes.shift();
    }

    // 按端点统计
    metrics.requestsByEndpoint[endpoint] = (metrics.requestsByEndpoint[endpoint] || 0) + 1;

    // 统计错误（5xx 状态码）
    if (reply.statusCode >= 500) {
      metrics.totalErrors += 1;
      metrics.errorsByEndpoint[endpoint] = (metrics.errorsByEndpoint[endpoint] || 0) + 1;
    }
  });

  done();
}

/**
 * 计算百分位数
 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * 计算平均值
 */
function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * 获取指标摘要
 */
export function getMetricsSummary() {
  const uptimeSeconds = (Date.now() - metrics.startTime) / 1000;
  const errorRate = metrics.totalRequests > 0
    ? (metrics.totalErrors / metrics.totalRequests) * 100
    : 0;

  return {
    uptime: {
      seconds: Math.floor(uptimeSeconds),
      hours: Math.floor(uptimeSeconds / 3600),
      days: Math.floor(uptimeSeconds / 86400),
    },
    requests: {
      total: metrics.totalRequests,
      perSecond: uptimeSeconds > 0 ? metrics.totalRequests / uptimeSeconds : 0,
      perMinute: uptimeSeconds > 0 ? (metrics.totalRequests / uptimeSeconds) * 60 : 0,
    },
    errors: {
      total: metrics.totalErrors,
      rate: parseFloat(errorRate.toFixed(2)),
      byEndpoint: metrics.errorsByEndpoint,
    },
    responseTime: {
      p50: percentile(metrics.responseTimes, 50),
      p95: percentile(metrics.responseTimes, 95),
      p99: percentile(metrics.responseTimes, 99),
      average: Math.round(average(metrics.responseTimes)),
      samples: metrics.responseTimes.length,
    },
    topEndpoints: Object.entries(metrics.requestsByEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .reduce((acc, [endpoint, count]) => {
        acc[endpoint] = count;
        return acc;
      }, {} as Record<string, number>),
  };
}

/**
 * 重置指标（用于测试）
 */
export function resetMetrics() {
  metrics = {
    totalRequests: 0,
    totalErrors: 0,
    responseTimes: [],
    requestsByEndpoint: {},
    errorsByEndpoint: {},
    startTime: Date.now(),
  };
}

/**
 * 注册指标路由到 Fastify 实例
 */
export function registerMetricsRoutes(app: FastifyInstance) {
  // 公开的健康检查端点
  app.get('/api/health', async (request, reply) => {
    reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    });
  });

  // 需要认证的指标端点
  app.get('/api/metrics', async (request, reply) => {
    const summary = getMetricsSummary();
    reply.send({
      success: true,
      data: summary,
    });
  });

  // 详细的指标数据（仅管理员）
  app.get('/api/metrics/detailed', async (request, reply) => {
    reply.send({
      success: true,
      data: metrics,
    });
  });
}

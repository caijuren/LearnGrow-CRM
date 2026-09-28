import { initSentry } from './sentry.js';
import app from './app.js';

// 初始化 Sentry 错误监控
initSentry();

const PORT = Number(process.env.PORT) || 3456;

try {
  await app.listen({ port: PORT, host: '127.0.0.1' });
  app.log.info(`🚀 Server running at http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

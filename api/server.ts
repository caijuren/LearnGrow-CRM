import app from './app.js';

const PORT = Number(process.env.PORT) || 3001;

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`🚀 Server running at http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

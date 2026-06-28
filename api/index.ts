/**
 * Vercel deploy entry handler, for serverless deployment
 */
import app from './app.js';

export default async function handler(req: any, res: any) {
  await app.ready();
  app.server.emit('request', req, res);
}

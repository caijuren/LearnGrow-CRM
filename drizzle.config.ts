import { defineConfig } from 'drizzle-kit';
import path from 'path';

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const databaseUrl = process.env.DATABASE_URL || path.join(dataDir, 'learngrow.db');

export default defineConfig({
  schema: './api/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});

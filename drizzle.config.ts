import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './api/schema.ts',
  out: './migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/learngrow.db',
  },
  verbose: true,
  strict: true,
});

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 从package.json读取版本号
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const appVersion = packageJson.version || '0.0.0';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
    }),
    tsconfigPaths(),
  ],
  define: {
    // 将版本号注入到环境变量，前端可通过 import.meta.env.VITE_APP_VERSION 访问
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      // 头像与打卡图存的是 /uploads/<file>，dev 下同样需要转发到后端
      '/uploads': {
        target: 'http://localhost:3456',
        changeOrigin: true,
        secure: false,
      },
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'api/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
})

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
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        // 手动分割 chunk
        manualChunks: (id) => {
          // React 相关库单独打包
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          // React Router 单独打包
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }
          // UI 库单独打包（如果有）
          if (id.includes('node_modules/@mui') || id.includes('node_modules/antd')) {
            return 'vendor-ui';
          }
          // Sentry 单独打包（体积较大）
          if (id.includes('node_modules/@sentry')) {
            return 'vendor-sentry';
          }
        },
        // 资源文件名格式
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'entries/[name]-[hash].js',
      },
    },
    // 压缩配置
    minify: 'esbuild',
    // sourcemap 在生产环境关闭
    sourcemap: false,
    // 目标浏览器
    target: 'es2015',
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
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

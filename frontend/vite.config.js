import { defineConfig } from 'vite';

// 代理目标：Docker 环境下通过 BACKEND_URL 注入服务名（http://backend:8000），
// 本地开发默认指向 http://localhost:8000。
const backendTarget = process.env.BACKEND_URL || 'http://localhost:8000';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true
      },
      '/docs': {
        target: backendTarget,
        changeOrigin: true
      },
      '/health': {
        target: backendTarget,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});

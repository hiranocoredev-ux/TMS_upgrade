import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3003',
        changeOrigin: true
      }
    }
  }
});


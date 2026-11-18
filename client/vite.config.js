import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// 127.0.0.1 rather than "localhost": on Windows "localhost" can resolve to ::1
// first, which the API server does not listen on.
const API_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:3003';

// "API not reachable" codes: the API server is starting or restarting (nodemon).
const API_DOWN_CODES = new Set(['ECONNREFUSED', 'EACCES', 'ECONNRESET', 'EADDRNOTAVAIL', 'ETIMEDOUT']);
const isApiDown = (err) =>
  API_DOWN_CODES.has(err?.code) ||
  (Array.isArray(err?.errors) && err.errors.length > 0 && err.errors.every((e) => API_DOWN_CODES.has(e?.code)));

/**
 * While the API is down, answer 503 quietly instead of Vite printing a stack
 * trace for every request; the page retries on its own. Other proxy errors
 * still go to Vite's normal logging.
 */
const quietWhileApiDown = (proxy) => {
  const on = proxy.on.bind(proxy);
  proxy.on = (event, listener) => {
    if (event !== 'error') return on(event, listener);
    return on('error', (err, req, res) => {
      if (isApiDown(err) && res && typeof res.writeHead === 'function') {
        if (!res.headersSent && !res.writableEnded) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'API server is starting. Please try again in a moment.' }));
        }
        return;
      }
      listener(err, req, res);
    });
  };
};

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: quietWhileApiDown,
      },
      '/uploads': {
        target: API_TARGET,
        changeOrigin: true,
        configure: quietWhileApiDown,
      },
    },
  },
});

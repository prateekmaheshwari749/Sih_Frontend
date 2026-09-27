import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = (
    env.VITE_API_BASE_URL ||
    env.VITE_BACKEND_URL ||
    env.BACKEND_URL ||
    'http://127.0.0.1:8000'
  ).replace(/\/+$/, '')

  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        'leaflet',
        'react-leaflet',
        'lucide-react',
        'date-fns',
        'recharts',
        'framer-motion',
        'three',
      ],
    },
    server: {
      host: true, // Listen on all network addresses (0.0.0.0) for LAN/WiFi access
      cors: true,
      watch: {
        usePolling: true,
        interval: 300,
      },
      hmr: {
        overlay: false, // Disable HMR error overlay (false positives on Google Drive paths)
      },
      proxy: {
        /**
         * Proxy all backend API calls through Vite dev server.
         * Eliminates browser CORS issues and resolves 127.0.0.1 vs localhost mismatches.
         */
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/checkup': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/models': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/model': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/config': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/reports': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/metrics': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/predict': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          bypass: (req) => {
            // Bypass proxy for frontend SPA route /predictions
            if (req.url && req.url.startsWith('/predictions')) {
              return '/index.html';
            }
          },
        },
        '/explain': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/cyclone': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          bypass: (req) => {
            // Bypass proxy for static image files so Vite serves them from public/
            if (req.url && /\.(webp|png|jpg|jpeg|svg|ico)$/i.test(req.url)) {
              return req.url;
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
              return '/index.html';
            }
            if (req.url && (req.url === '/cyclone' || req.url.startsWith('/cyclone?'))) {
              return '/index.html';
            }
          },
        },
      },
    },
  }
})

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const context = (env.BACKEND_CONTEXT || '/backend').replace(/\/$/, '')
  const proxy = {
    '/api': {
      target: env.BACKEND_ORIGIN || 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => `${context}${path}`,
      // Tomcat's /backend session cookie must also work for frontend /api requests.
      cookiePathRewrite: '/',
      cookieDomainRewrite: '',
    },
  }
  return { plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy } }
})

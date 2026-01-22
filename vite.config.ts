import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const CONTENT_SECURITY_POLICY =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://images.pexels.com https://images.unsplash.com https://*.supabase.co https://api.qrserver.com; connect-src 'self' https://*.supabase.co https://*.functions.supabase.co https://*.supabase.in https://*.functions.supabase.in wss://*.supabase.co wss://*.functions.supabase.co wss://*.supabase.in wss://*.functions.supabase.in https://api.segment.io https://cdn.segment.com https://*.ingest.sentry.io https://*.supabase.dev https://*.supabase.net https://*.supabase.com https://*.supabase.io https://*.supabase.org https://*.supabase.xyz https://*.supabase.info https://*.supabase.app https://*.supabase.site https://*.supabase.store http://localhost:5173 ws://localhost:5173 wss://localhost:5173 https://localhost:* http://localhost:*; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"

const securityHeaders = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
}

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_PLATFORM === 'capacitor' ? './' : '/', // use './' for Capacitor webview assets
  server: {
    headers: securityHeaders,
  },
  preview: {
    headers: securityHeaders,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})

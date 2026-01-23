import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(), 
    basicSsl(),
  ],
  server: {
    // allow access from LAN and ensure proxy works when opening via IP
    host: true,
    // enable HTTPS for local dev (basicSsl provides certificates)
    https: true,
    // proxy API endpoints to the backend service to avoid CORS/mixed-content
    proxy: {
      '/config': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/whisper': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/print': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/icon-suggest': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

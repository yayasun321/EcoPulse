import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy eBay OAuth token requests to avoid CORS
      '/ebay-token': {
        target: 'https://api.ebay.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ebay-token/, '/identity/v1/oauth2/token'),
      },
      // Proxy eBay Browse API search requests to avoid CORS
      '/ebay-search': {
        target: 'https://api.ebay.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/ebay-search/, '/buy/browse/v1/item_summary/search'),
      },
    },
  },
})

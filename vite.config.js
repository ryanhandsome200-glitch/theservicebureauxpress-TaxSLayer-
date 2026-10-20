import { copyFileSync, rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function copyBundleToRoot() {
  return {
    name: 'copy-bundle-to-root',
    apply: 'build',
    writeBundle() {
      copyFileSync('dist/app.js', 'app.js')
      if (!process.env.VERCEL) rmSync('dist', { recursive: true, force: true })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), copyBundleToRoot()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsDir: '',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        assetFileNames(assetInfo) {
          const name = assetInfo.names?.[0] || assetInfo.name || ''
          return name.endsWith('.css') ? 'app.css' : '[name][extname]'
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests.*.test.js', 'tests.*.test.jsx'],
    setupFiles: ['./tests.setup.js'],
    clearMocks: true,
  },
})

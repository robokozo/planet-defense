import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const repoName = process.env.npm_package_name ?? 'planet-defense'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? `/${repoName}/`,
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

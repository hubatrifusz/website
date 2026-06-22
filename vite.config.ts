import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// This file provides path alias resolution for Vitest unit/e2e test projects
// that run in the 'node' environment (outside the Nuxt runtime). The ~~
// alias mirrors what Nuxt injects at runtime: it maps to the project root.
export default defineConfig({
  resolve: {
    alias: {
      '~~': resolve(__dirname),
      '@@': resolve(__dirname),
    },
  },
})

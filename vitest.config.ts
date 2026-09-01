import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // See __tests__/stubs/server-only.ts - without this, any suite that
      // imports a server-only module fails to load rather than failing a test,
      // which is easy to miss in a green-looking run.
      'server-only': path.resolve(__dirname, '__tests__/stubs/server-only.ts'),
    },
  },
})

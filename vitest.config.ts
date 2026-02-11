import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/adapters/cli/**',
        'src/adapters/api/start.ts',
        'src/**/index.ts',
        'src/domain/repositories/**',
        'src/infrastructure/drizzle/schema.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@use-cases': path.resolve(__dirname, './src/use-cases'),
      '@infrastructure': path.resolve(__dirname, './src/infrastructure'),
      '@adapters': path.resolve(__dirname, './src/adapters'),
    },
  },
});

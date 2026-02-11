import eslint from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      boundaries,
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**/*', mode: 'full' },
        { type: 'use-cases', pattern: 'src/use-cases/**/*', mode: 'full' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**/*', mode: 'full' },
        { type: 'adapters', pattern: 'src/adapters/**/*', mode: 'full' },
      ],
      'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts', 'tests/**/*'],
    },
    rules: {
      // Import sorting
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'], // Side effect imports
            ['^node:'], // Node.js built-ins
            ['^@?\\w'], // External packages
            ['^@/'], // Internal packages
            ['^\\.\\.'], // Parent imports
            ['^\\.'], // Same folder imports
          ],
        },
      ],
      'simple-import-sort/exports': 'error',

      // Clean Architecture boundary enforcement
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message:
            'Clean Architecture violation: "${file.type}" cannot import from "${dependency.type}"',
          rules: [
            { from: 'domain', allow: ['domain'] },
            { from: 'use-cases', allow: ['use-cases', 'domain'] },
            { from: 'infrastructure', allow: ['infrastructure', 'domain'] },
            { from: 'adapters', allow: ['adapters', 'use-cases', 'infrastructure'] },
          ],
        },
      ],

      // TypeScript rules (ALL ERRORS)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Code quality (ALL ERRORS)
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-lines': ['error', 750],
      'max-lines-per-function': ['error', 100],
      'max-params': ['error', 4],

      // General
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
    },
  },
  // CLI adapter overrides — entry points that need console output
  {
    files: ['src/adapters/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Test file overrides
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      complexity: 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'web/**', '*.js', '*.cjs', '*.mjs'],
  }
);

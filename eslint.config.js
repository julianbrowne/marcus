import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import {defineConfig, globalIgnores} from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'public/tests', 'src/corpus', 'node_modules']),
  {
    files: ['**/*.{js,jsx,mjs}'],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {ecmaFeatures: {jsx: true}},
    },
  },
  {
    // build scripts and config run in Node
    files: ['scripts/**', '*.config.js'],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['test/**'],
    languageOptions: {globals: {...globals.node, ...globals.vitest}},
  },
]);

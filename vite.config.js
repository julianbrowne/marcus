import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{js,jsx}'],
    setupFiles: ['test/setup.js'],
    testTimeout: 30_000, // CI machines are ~2x slower than a laptop; tests still finish as soon as they pass
    // one self-contained HTML report in public/, so the build publishes it: the app links to ./tests/index.html
    reporters: ['default', ['html', {outputDir: './public/tests', singleFile: true}]],
  },
});

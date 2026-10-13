/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const renameOutput = (): Plugin => ({
  name: 'rename-output',
  apply: 'build',
  closeBundle() {
    const src = resolve(__dirname, 'dist/index.html');
    if (existsSync(src)) copyFileSync(src, resolve(__dirname, 'dist/빈칸지도.html'));
  },
});

export default defineConfig({
  plugins: [react(), viteSingleFile(), renameOutput()],
  build: { outDir: 'dist', rollupOptions: { input: 'index.html' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.ts'] },
});

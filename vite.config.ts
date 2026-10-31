import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Адрес dev-сервера для запуска на телефоне задаёт `tauri android dev`.
const devHost = process.env['TAURI_DEV_HOST'];

export default defineConfig({
  plugins: [react()],
  // Tauri показывает свои ошибки сборки Rust, Vite не должен очищать консоль.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: devHost ?? false,
    hmr: devHost ? { protocol: 'ws', host: devHost, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // WebView2 (Windows) и Android System WebView поддерживают современный JS.
    target: 'es2022',
    sourcemap: Boolean(process.env['TAURI_ENV_DEBUG']),
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});

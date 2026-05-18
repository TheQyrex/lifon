import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// В деве проксируем API через единый префикс /api. Без префикса пути коллидят
// с React-роутами (например, /profile → React-страница vs API).
const API_TARGET = 'https://cupsize-api.lifonmusic.workers.dev';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        strictPort: false,
        proxy: {
            '/api': {
                target: API_TARGET,
                changeOrigin: true,
                secure: true,
                rewrite: (p) => p.replace(/^\/api/, ''),
            },
        },
    },
});

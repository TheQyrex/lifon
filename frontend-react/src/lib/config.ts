// В деве — префикс `/api` идёт через Vite-proxy (см. vite.config.ts). Это нужно чтобы
// React-роуты (/profile, /album/...) не конфликтовали с одноимёнными путями API.
// В проде — прямой URL воркера (или переопределённый через VITE_API_BASE).
export const API_BASE = import.meta.env.DEV
    ? '/api'
    : ((import.meta.env.VITE_API_BASE as string | undefined) ?? '/api');

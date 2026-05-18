/** Unix-секунды → "YYYY-MM-DD HH:MM". Используется в админских таблицах. */
export function formatTs(unixSec: number | null | undefined): string {
    if (!unixSec) return '—';
    const d = new Date(unixSec * 1000);
    return d.toISOString().replace('T', ' ').slice(0, 16);
}

/** Секунды → "M:SS". Используется в плеере и модалке лирики. */
export function formatTime(sec: number): string {
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

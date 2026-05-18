/**
 * Поделиться ссылкой. Использует Web Share API на мобильных, на десктопе копирует в буфер.
 * Возвращает 'shared' | 'copied' | 'cancelled' для UI-фидбэка.
 */
export async function shareLink(title: string, url: string): Promise<'shared' | 'copied' | 'cancelled'> {
    const data: ShareData = { title, url };
    if (typeof navigator.share === 'function' && navigator.canShare?.(data) !== false) {
        try {
            await navigator.share(data);
            return 'shared';
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return 'cancelled';
            // Fallthrough на копирование
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        return 'copied';
    } catch {
        return 'cancelled';
    }
}

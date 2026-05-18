/**
 * Бэк возвращает относительные пути для бандленых ассетов («preview/album_1.jpg»,
 * «audio/fuck_1.opus»). Браузер резолвит их относительно текущей страницы —
 * на роутах вроде /album/123 или /admin/* они ломаются. Делаем абсолютными.
 */
export function toAbsoluteAsset(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^(https?:|data:|blob:|\/)/i.test(url)) return url;
    return '/' + url;
}

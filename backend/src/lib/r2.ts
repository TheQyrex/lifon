import type { Env } from '../env';

const ALLOWED_KINDS = {
    avatar: { prefix: 'avatars', mime: /^image\/(png|jpeg|webp|gif)$/, maxBytes: 2 * 1024 * 1024 },
    cover:  { prefix: 'covers',  mime: /^image\/(png|jpeg|webp)$/,     maxBytes: 5 * 1024 * 1024 },
    image:  { prefix: 'images',  mime: /^image\/(png|jpeg|webp|gif)$/, maxBytes: Number.MAX_SAFE_INTEGER },
    audio:  { prefix: 'audio',   mime: /^audio\/(mpeg|opus|ogg|mp4|aac|wav)$/, maxBytes: 50 * 1024 * 1024 },
    video:  { prefix: 'videos',  mime: /^video\/(mp4|webm|quicktime)$/,        maxBytes: Number.MAX_SAFE_INTEGER },
    lrc:    { prefix: 'lyrics',  mime: /^(text\/plain|application\/octet-stream)$/, maxBytes: 200 * 1024 },
} as const;

export type UploadKind = keyof typeof ALLOWED_KINDS;

export function isUploadKind(value: string): value is UploadKind {
    return value in ALLOWED_KINDS;
}

export interface UploadResult {
    key: string;
    url: string;
}

export async function uploadToR2(
    env: Env,
    kind: UploadKind,
    file: File,
): Promise<UploadResult> {
    const spec = ALLOWED_KINDS[kind];

    if (!spec.mime.test(file.type)) {
        throw new UploadError(415, `Недопустимый MIME-тип для ${kind}: ${file.type}`);
    }
    if (file.size <= 0 || file.size > spec.maxBytes) {
        throw new UploadError(413, `Файл слишком большой (${file.size} > ${spec.maxBytes})`);
    }

    // Сверяем magic bytes — Content-Type легко подделывается на клиенте
    const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const realMime = detectMime(head);
    if (kind === 'lrc') {
        // LRC — это текст; magic byte нет, ограничиваемся MIME и размером
    } else if (!realMime || !spec.mime.test(realMime)) {
        throw new UploadError(415, `Содержимое файла не соответствует типу ${kind} (обнаружено: ${realMime || 'неизвестно'})`);
    }

    const ext = extensionFor(file.type, file.name);
    const key = `${spec.prefix}/${randomId()}${ext}`;

    await env.MEDIA.put(key, file.stream(), {
        httpMetadata: { contentType: realMime || file.type },
    });

    return { key, url: publicUrl(env, key) || '' };
}

/**
 * Определяет MIME по первым байтам файла. Возвращает null если сигнатура неизвестна.
 * Покрывает все типы из ALLOWED_KINDS (картинки + аудио).
 */
function detectMime(head: Uint8Array): string | null {
    const b = head;
    if (b.length < 4) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';

    // JPEG: FF D8 FF
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';

    // GIF: 47 49 46 38 (GIF8)
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';

    // RIFF-контейнер: WEBP или WAV
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
        if (b.length >= 12) {
            const fourcc = String.fromCharCode(b[8], b[9], b[10], b[11]);
            if (fourcc === 'WEBP') return 'image/webp';
            if (fourcc === 'WAVE') return 'audio/wav';
        }
        return null;
    }

    // OGG (включая Opus в Ogg-контейнере): 4F 67 67 53
    if (b[0] === 0x4F && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
        // Opus internally: следующая страница начинается с "OpusHead". Простая эвристика — оба тащат audio/ogg.
        // Для нашего allowlist regex обе сигнатуры подойдут под audio/(opus|ogg).
        return 'audio/ogg';
    }

    // MP3: ID3 (49 44 33) или MPEG frame (FF Fx)
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
    if (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0) {
        // MPEG-1/2/2.5 frame header — мог быть mp3 или aac/adts
        // AAC ADTS: FF F1 / FF F9
        if (b[1] === 0xF1 || b[1] === 0xF9) return 'audio/aac';
        return 'audio/mpeg';
    }

    // MP4/M4A/MOV: смещение 4..8 = "ftyp"
    if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
        const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
        // MOV — Apple QuickTime; mp4 brands начинаются на iso/mp4/M4V
        if (brand.startsWith('qt')) return 'video/quicktime';
        if (brand.startsWith('M4V') || brand.startsWith('mp4') || brand.startsWith('iso')) return 'video/mp4';
        return 'audio/mp4';
    }

    // WebM: 1A 45 DF A3 (EBML header)
    if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'video/webm';

    return null;
}

export function publicUrl(env: Env, key: string | null | undefined): string | null {
    if (!key) return null;
    if (/^https?:\/\//i.test(key)) return key;
    if (isBundledFrontendAsset(key)) {
        // Бандленые ассеты (preview/, audio/album*) физически лежат во фронте.
        // Если задан ASSETS_BASE (в проде), отдаём абсолютный URL — нужен Android-клиенту
        // и любому внешнему потребителю API. Без него — оставляем относительный путь.
        const assetsBase = env.ASSETS_BASE?.replace(/\/+$/, '');
        return assetsBase ? `${assetsBase}/${key}` : key;
    }
    const base = env.MEDIA_PUBLIC_BASE.replace(/\/+$/, '');
    return `${base}/${key}`;
}

export async function deleteFromR2(env: Env, key: string | null | undefined): Promise<void> {
    if (!key) return;
    await env.MEDIA.delete(key);
}

export class UploadError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = 'UploadError';
    }
}

function extensionFor(mime: string, name: string): string {
    const map: Record<string, string> = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
        'image/gif': '.gif',
        'audio/mpeg': '.mp3',
        'audio/opus': '.opus',
        'audio/ogg': '.ogg',
        'audio/mp4': '.m4a',
        'audio/aac': '.aac',
        'audio/wav': '.wav',
        'text/plain': '.lrc',
    };
    if (map[mime]) return map[mime];
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
}

function randomId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function isBundledFrontendAsset(key: string): boolean {
    return (
        key.startsWith('preview/') ||
        /^audio\/(fuck_\d+|album\d+_track\d+)\.opus$/i.test(key)
    );
}

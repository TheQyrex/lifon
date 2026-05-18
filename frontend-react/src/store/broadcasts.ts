import { create } from 'zustand';
import { api } from '@/lib/api';

export interface BroadcastItem {
    id: number;
    kind: 'notification' | 'banner';
    title: string;
    body: string | null;
    image_url: string | null;
    meta: string | null;
    created_at: number;
}

export interface BroadcastButton {
    label: string;
    url: string;
    color: string;
    text_color?: string;
}

/**
 * Все настройки кастомизации хранятся в meta (TEXT-поле в БД). Поддерживаем
 * старый формат с плоским buttons[] и новый с buttonRows[][].
 */
export interface BroadcastMeta {
    bg?: string;            // фон
    color?: string;         // цвет основного текста
    title_size?: number;    // размер заголовка в px
    body_size?: number;     // размер тела в px
    video_url?: string;     // URL видео в R2

    // Кнопки. Каждый ряд — отдельный массив. 1 кнопка занимает 100%, 2 → 50/50, 3 → 33/33/33.
    buttonRows?: BroadcastButton[][];
    buttons?: BroadcastButton[]; // legacy — конвертируется в один ряд
}

interface BroadcastsState {
    notification: BroadcastItem | null;
    banner: BroadcastItem | null;
    dismissed: Set<string>;
    load: () => Promise<void>;
    dismiss: (key: string) => void;
}

const DISMISSED_KEY = 'lifon_dismissed_broadcasts';

function loadDismissed(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
    catch { return new Set(); }
}

function saveDismissed(set: Set<string>) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}

export const useBroadcasts = create<BroadcastsState>((set, get) => ({
    notification: null,
    banner: null,
    dismissed: loadDismissed(),

    async load() {
        try {
            const res = await api.get<{ ok: true; items: BroadcastItem[] }>('/notification');
            const items = Array.isArray(res.items) ? res.items : [];
            set({
                notification: items.find((i) => i.kind === 'notification') ?? null,
                banner:       items.find((i) => i.kind === 'banner')       ?? null,
            });
        } catch {
            // тихий фейл
        }
    },

    dismiss(key) {
        const dismissed = new Set(get().dismissed);
        dismissed.add(key);
        saveDismissed(dismissed);
        set({ dismissed });
    },
}));

export function parseMeta(meta: string | null): BroadcastMeta {
    if (!meta) return {};
    try {
        const obj = JSON.parse(meta);
        const out: BroadcastMeta = {};
        if (typeof obj?.bg === 'string')          out.bg = obj.bg;
        if (typeof obj?.color === 'string')       out.color = obj.color;
        if (typeof obj?.title_size === 'number')  out.title_size = obj.title_size;
        if (typeof obj?.body_size === 'number')   out.body_size = obj.body_size;
        if (typeof obj?.video_url === 'string')   out.video_url = obj.video_url;
        if (Array.isArray(obj?.buttonRows)) {
            out.buttonRows = obj.buttonRows
                .filter((row: unknown) => Array.isArray(row))
                .map((row: BroadcastButton[]) => row.map(normalizeBtn).filter((b) => b.label));
        } else if (Array.isArray(obj?.buttons)) {
            const flat = obj.buttons.map(normalizeBtn).filter((b: BroadcastButton) => b.label);
            if (flat.length) out.buttonRows = [flat];
        }
        return out;
    } catch {
        return {};
    }
}

function normalizeBtn(b: Partial<BroadcastButton>): BroadcastButton {
    return {
        label: (b.label || '').trim(),
        url:   (b.url   || '#').trim(),
        color: b.color || '#8b5cf6',
        text_color: b.text_color,
    };
}

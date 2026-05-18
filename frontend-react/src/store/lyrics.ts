import { create } from 'zustand';
import { api, ApiException } from '@/lib/api';
import { parseLrc, type LrcLine } from '@/lib/lrc';

interface LyricsState {
    visible: boolean;       // открыта ли модалка
    contentHidden: boolean; // скрыт ли текст (режим «только обложка»)
    visualizerOff: boolean; // выключена ли пульсация фона
    trackId: number | null; // для какого трека загружены строки
    lines: LrcLine[] | null;
    loading: boolean;

    open: () => void;
    close: () => void;
    toggle: () => void;
    toggleContent: () => void;
    toggleVisualizer: () => void;
    loadFor: (trackId: number) => Promise<void>;
}

export const useLyrics = create<LyricsState>((set, get) => ({
    visible: false,
    contentHidden: false,
    visualizerOff: localStorage.getItem('visualizer_off') === 'true',
    trackId: null,
    lines: null,
    loading: false,

    open:   () => set({ visible: true }),
    close:  () => set({ visible: false }),
    toggle: () => set((s) => ({ visible: !s.visible })),
    toggleContent: () => set((s) => ({ contentHidden: !s.contentHidden })),
    toggleVisualizer: () => set((s) => {
        const next = !s.visualizerOff;
        localStorage.setItem('visualizer_off', String(next));
        return { visualizerOff: next };
    }),

    async loadFor(trackId) {
        if (get().trackId === trackId && get().lines) return;
        set({ trackId, lines: null, loading: true });

        let text: string | null = null;
        try {
            const res = await api.get<{ ok: true; lrc: string | null }>(`/albums/tracks/${trackId}/lyrics`);
            text = res.lrc;
        } catch (err) {
            if (!(err instanceof ApiException)) {
                // сеть упала — пробуем бандленый
            }
        }

        if (!text) {
            try {
                // Бандленые `.lrc` лежат в /public/lyrics/<id>.lrc — это статика, не API.
                const r = await fetch(`/lyrics/${trackId}.lrc?v=${Date.now()}`);
                if (r.ok) text = await r.text();
            } catch {
                // тихо игнорируем
            }
        }

        // защита от гонки: пока ждали, юзер мог переключить трек
        if (get().trackId !== trackId) return;
        set({ lines: text ? parseLrc(text) : [], loading: false });
    },
}));

import { create } from 'zustand';
import { api } from '@/lib/api';

interface LikesState {
    liked: Set<number>;
    loaded: boolean;
    load: () => Promise<void>;
    toggle: (trackId: number) => Promise<void>;
    isLiked: (trackId: number) => boolean;
    reset: () => void;
}

export const useLikes = create<LikesState>((set, get) => ({
    liked: new Set<number>(),
    loaded: false,

    async load() {
        try {
            const res = await api.get<{ ok: true; liked: number[] }>('/likes');
            set({ liked: new Set(res.liked), loaded: true });
        } catch {
            set({ loaded: true });
        }
    },

    async toggle(trackId) {
        const liked = new Set(get().liked);
        const wasLiked = liked.has(trackId);

        // Оптимистическое обновление — UI меняется сразу, при ошибке откатываем
        if (wasLiked) liked.delete(trackId); else liked.add(trackId);
        set({ liked });

        try {
            if (wasLiked) await api.delete('/likes', { track_id: trackId });
            else          await api.post('/likes',   { track_id: trackId });
        } catch {
            const rollback = new Set(get().liked);
            if (wasLiked) rollback.add(trackId); else rollback.delete(trackId);
            set({ liked: rollback });
        }
    },

    isLiked(trackId) {
        return get().liked.has(trackId);
    },

    reset() {
        set({ liked: new Set(), loaded: false });
    },
}));

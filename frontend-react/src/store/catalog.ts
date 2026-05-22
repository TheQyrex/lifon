import { create } from 'zustand';
import { api } from '@/lib/api';
import { toAbsoluteAsset } from '@/lib/assets';
import type { Album, MaintenanceState } from '@/types/api';

interface CatalogState {
    albums: Album[];
    loaded: boolean;
    maintenance: MaintenanceState | null;
    load: () => Promise<void>;
    findAlbum: (id: number) => Album | undefined;
}

export const useCatalog = create<CatalogState>((set, get) => ({
    albums: [],
    loaded: false,
    maintenance: null,

    async load() {
        try {
            const res = await api.get<{ ok: true; albums: Album[] }>('/albums');
            set({
                albums: res.albums.map(normalizeAlbum),
                loaded: true,
                maintenance: null,
            });
        } catch (err: unknown) {
            // 503 от бэка приходит, когда включён режим техработ
            if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 503) {
                const e = err as { error?: string; message?: string };
                set({
                    maintenance: {
                        enabled: true,
                        message: e.message || 'Сайт находится на технических работах',
                    },
                    loaded: true,
                });
            } else {
                set({ loaded: true });
            }
        }
    },

    findAlbum(id) {
        return get().albums.find((a) => a.id === id);
    },
}));

function normalizeAlbum(a: Album): Album {
    return {
        ...a,
        cover: toAbsoluteAsset(a.cover ?? a.cover_url ?? null),
        cover_url: toAbsoluteAsset(a.cover_url ?? a.cover ?? null),
        glow_color: a.glow_color ?? null,
        tracks: (a.tracks || []).map((t) => ({
            ...t,
            album_id: t.album_id ?? a.id,
            audio_url: toAbsoluteAsset(t.audio_url ?? null),
            cover_url: toAbsoluteAsset(t.cover_url ?? null),
        })),
    };
}

import { create } from 'zustand';
import { api } from '@/lib/api';

interface LiveState {
    total: number;                       // глобальный счётчик онлайн
    tracks: Record<number, number>;      // { trackId → кол-во слушателей }

    sendHeartbeat: (trackId: number) => Promise<void>;
    fetchAll: () => Promise<void>;
    countForTrack: (trackId: number) => number;
    countForTracks: (trackIds: number[]) => number;
}

export const useLive = create<LiveState>((set, get) => ({
    total: 0,
    tracks: {},

    async sendHeartbeat(trackId) {
        try {
            await api.post('/listens/heartbeat', { track_id: trackId });
        } catch {
            // молча — не критично
        }
    },

    async fetchAll() {
        try {
            const res = await api.get<{ ok: true; tracks: Record<number, number>; total: number }>('/listens/live/all');
            set({ tracks: res.tracks, total: res.total });
        } catch {
            // молча
        }
    },

    countForTrack(trackId) {
        return get().tracks[trackId] ?? 0;
    },

    countForTracks(trackIds) {
        const map = get().tracks;
        let sum = 0;
        for (const id of trackIds) sum += map[id] ?? 0;
        return sum;
    },
}));

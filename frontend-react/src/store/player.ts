import { create } from 'zustand';
import { audio } from '@/lib/audio';
import type { Track } from '@/types/api';

interface PlayerState {
    currentTrack: Track | null;
    playlist: Track[];
    playlistIndex: number;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;       // 0..1
    isMuted: boolean;
    isShuffled: boolean;
    isRepeating: boolean;
    cover: string | null; // обложка для отображения в плеере (берётся из альбома)

    // internal setters used by AudioRoot to react to audio events
    _setTime: (t: number) => void;
    _setDuration: (d: number) => void;
    _setIsPlaying: (p: boolean) => void;
    _onEnded: () => void;

    play: (track: Track, playlist: Track[], cover?: string | null) => void;
    togglePlay: () => void;
    next: () => void;
    prev: () => void;
    seek: (timeSec: number) => void;
    setVolume: (v: number) => void;
    toggleMute: () => void;
    toggleShuffle: () => void;
    toggleRepeat: () => void;
}

const VOLUME_KEY = 'player_volume';
const initialVolume = clamp01(parseFloat(localStorage.getItem(VOLUME_KEY) ?? '1'));

export const usePlayer = create<PlayerState>((set, get) => ({
    currentTrack: null,
    playlist: [],
    playlistIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: initialVolume,
    isMuted: false,
    isShuffled: false,
    isRepeating: false,
    cover: null,

    _setTime: (t) => set({ currentTime: t }),
    _setDuration: (d) => set({ duration: d }),
    _setIsPlaying: (p) => set({ isPlaying: p }),

    _onEnded: () => {
        const { isRepeating, next } = get();
        const a = audio();
        if (isRepeating && a) {
            a.currentTime = 0;
            a.play().catch(() => {});
            return;
        }
        next();
    },

    play(track, playlist, cover) {
        const idx = playlist.findIndex((t) => t.id === track.id);
        set({
            currentTrack: track,
            playlist,
            playlistIndex: idx >= 0 ? idx : 0,
            cover: cover ?? null,
            currentTime: 0,
        });
        const a = audio();
        if (!a) return;
        const src = track.audio_url || '';
        if (!src) return;
        a.src = src;
        a.volume = get().isMuted ? 0 : get().volume;
        a.play().then(() => set({ isPlaying: true })).catch(() => set({ isPlaying: false }));
    },

    togglePlay() {
        const a = audio();
        if (!a || !get().currentTrack) return;
        if (a.paused) {
            a.play().then(() => set({ isPlaying: true })).catch(() => {});
        } else {
            a.pause();
            set({ isPlaying: false });
        }
    },

    next() {
        const { playlist, playlistIndex, isShuffled, play, cover } = get();
        if (!playlist.length) return;
        let nextIdx: number;
        if (isShuffled) {
            nextIdx = Math.floor(Math.random() * playlist.length);
            if (playlist.length > 1 && nextIdx === playlistIndex) nextIdx = (nextIdx + 1) % playlist.length;
        } else {
            nextIdx = (playlistIndex + 1) % playlist.length;
        }
        play(playlist[nextIdx], playlist, cover);
    },

    prev() {
        const { playlist, playlistIndex, play, cover, currentTime } = get();
        if (!playlist.length) return;
        // Если уже отыграли > 3 секунд — перематываем к началу трека вместо перехода
        if (currentTime > 3) {
            const a = audio();
            if (a) { a.currentTime = 0; set({ currentTime: 0 }); return; }
        }
        const prevIdx = playlistIndex <= 0 ? playlist.length - 1 : playlistIndex - 1;
        play(playlist[prevIdx], playlist, cover);
    },

    seek(timeSec) {
        const a = audio();
        if (!a || !Number.isFinite(timeSec)) return;
        a.currentTime = Math.max(0, Math.min(timeSec, a.duration || 0));
        set({ currentTime: a.currentTime });
    },

    setVolume(v) {
        const value = clamp01(v);
        localStorage.setItem(VOLUME_KEY, String(value));
        const a = audio();
        if (a) a.volume = get().isMuted ? 0 : value;
        set({ volume: value });
    },

    toggleMute() {
        const next = !get().isMuted;
        const a = audio();
        if (a) a.volume = next ? 0 : get().volume;
        set({ isMuted: next });
    },

    toggleShuffle: () => set((s) => ({ isShuffled: !s.isShuffled })),
    toggleRepeat: () => set((s) => ({ isRepeating: !s.isRepeating })),
}));

function clamp01(v: number) {
    if (!Number.isFinite(v)) return 1;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

import { useEffect, useRef } from 'react';
import { bindAudio } from '@/lib/audio';
import { resumeAudioContext } from '@/lib/visualizer';
import { usePlayer } from '@/store/player';
import { api, getToken } from '@/lib/api';
import { API_BASE } from '@/lib/config';

/**
 * Скрытый <audio>, прибитый к глобальному store. Один на всё приложение.
 */
export function AudioRoot() {
    const ref = useRef<HTMLAudioElement>(null);
    const listenRef = useRef<{ trackId: number; startMs: number } | null>(null);
    const currentTrackId = usePlayer(s => s.currentTrack?.id ?? null);
    const currentTrack = usePlayer(s => s.currentTrack);
    const cover = usePlayer(s => s.cover);

    // Записываем прослушивание когда трек меняется
    useEffect(() => {
        const prev = listenRef.current;
        if (prev) {
            api.post('/listens', { track_id: prev.trackId, duration_ms: Date.now() - prev.startMs }).catch(() => {});
        }
        listenRef.current = currentTrackId !== null ? { trackId: currentTrackId, startMs: Date.now() } : null;
    }, [currentTrackId]);

    // Записываем последнее прослушивание при закрытии вкладки
    useEffect(() => {
        const handleUnload = () => {
            const prev = listenRef.current;
            if (!prev) return;
            const durationMs = Date.now() - prev.startMs;
            if (durationMs < 1000) return;
            const token = getToken();
            if (!token) return;
            fetch(`${API_BASE}/listens`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ track_id: prev.trackId, duration_ms: durationMs }),
                keepalive: true,
            }).catch(() => {});
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    // Media Session API — metadata + all action handlers together.
    // iOS reads this as a unit to decide which lock-screen controls to show:
    // all 4 handlers (play/pause/prev/next) signals a full music player → prev/next buttons.
    // Without play/pause, iOS falls back to its default podcast widget (10-second skip).
    useEffect(() => {
        if (!('mediaSession' in navigator) || !currentTrack) return;
        const ms = navigator.mediaSession;

        const artwork = cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' as const }] : [];
        ms.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist,
            artwork,
        });

        ms.setActionHandler('play',          () => { usePlayer.getState().togglePlay(); });
        ms.setActionHandler('pause',         () => { usePlayer.getState().togglePlay(); });
        ms.setActionHandler('previoustrack', () => { usePlayer.getState().prev(); });
        ms.setActionHandler('nexttrack',     () => { usePlayer.getState().next(); });
        ms.setActionHandler('seekto',        (d) => { if (d.seekTime !== undefined) usePlayer.getState().seek(d.seekTime); });

        return () => {
            ms.setActionHandler('play',          null);
            ms.setActionHandler('pause',         null);
            ms.setActionHandler('previoustrack', null);
            ms.setActionHandler('nexttrack',     null);
            ms.setActionHandler('seekto',        null);
        };
    }, [currentTrack, cover]);

    // Resume AudioContext (if set up) when app returns from background on iOS
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible') return;
            resumeAudioContext();
            const { isPlaying } = usePlayer.getState();
            const a = ref.current;
            if (a && isPlaying && a.paused) {
                a.play().catch(() => {
                    usePlayer.getState()._setIsPlaying(false);
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    useEffect(() => {
        const a = ref.current;
        if (!a) return;
        bindAudio(a);

        const onTime    = () => usePlayer.getState()._setTime(a.currentTime);
        const onMeta    = () => usePlayer.getState()._setDuration(a.duration);
        const onPlay    = () => {
            // resumeAudioContext only if already set up (lazy — initialised when lyrics modal opens)
            resumeAudioContext();
            usePlayer.getState()._setIsPlaying(true);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        };
        const onPause   = () => {
            usePlayer.getState()._setIsPlaying(false);
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        };
        const onEnded   = () => usePlayer.getState()._onEnded();

        a.addEventListener('timeupdate', onTime);
        a.addEventListener('loadedmetadata', onMeta);
        a.addEventListener('play', onPlay);
        a.addEventListener('pause', onPause);
        a.addEventListener('ended', onEnded);

        // Применяем начальную громкость
        a.volume = usePlayer.getState().volume;

        return () => {
            a.removeEventListener('timeupdate', onTime);
            a.removeEventListener('loadedmetadata', onMeta);
            a.removeEventListener('play', onPlay);
            a.removeEventListener('pause', onPause);
            a.removeEventListener('ended', onEnded);
        };
    }, []);

    return <audio id="audioPlayer" ref={ref} crossOrigin="anonymous" playsInline />;
}

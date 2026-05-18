import { useEffect, useRef } from 'react';
import { bindAudio } from '@/lib/audio';
import { ensureAnalyser, resumeAudioContext } from '@/lib/visualizer';
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

    useEffect(() => {
        const a = ref.current;
        if (!a) return;
        bindAudio(a);

        const onTime    = () => usePlayer.getState()._setTime(a.currentTime);
        const onMeta    = () => usePlayer.getState()._setDuration(a.duration);
        const onPlay    = () => {
            // WebAudio API требует gesture-инициированной активации.
            // play() — самый первый gesture, после которого можно создавать AudioContext.
            ensureAnalyser(a);
            resumeAudioContext();
            usePlayer.getState()._setIsPlaying(true);
        };
        const onPause   = () => usePlayer.getState()._setIsPlaying(false);
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

    return <audio id="audioPlayer" ref={ref} crossOrigin="anonymous" />;
}

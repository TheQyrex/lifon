import { useEffect, useRef } from 'react';
import { bindAudio } from '@/lib/audio';
import { ensureAnalyser, resumeAudioContext } from '@/lib/visualizer';
import { usePlayer } from '@/store/player';

/**
 * Скрытый <audio>, прибитый к глобальному store. Один на всё приложение.
 */
export function AudioRoot() {
    const ref = useRef<HTMLAudioElement>(null);

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

import { usePlayer } from '@/store/player';
import { useLikes } from '@/store/likes';
import { useLyrics } from '@/store/lyrics';
import { useLive } from '@/store/live';
import { formatTime } from '@/lib/format';

export function Player() {
    const {
        currentTrack, cover, isPlaying, currentTime, duration,
        volume, isMuted, isShuffled, isRepeating,
        togglePlay, next, prev, seek, setVolume, toggleMute, toggleShuffle, toggleRepeat,
    } = usePlayer();
    const liked = useLikes((s) => currentTrack ? s.liked.has(currentTrack.id) : false);
    const toggleLike = useLikes((s) => s.toggle);
    const toggleLyrics = useLyrics((s) => s.toggle);
    const trackListeners = useLive((s) => currentTrack ? (s.tracks[currentTrack.id] ?? 0) : 0);

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePct = isMuted ? 0 : volume * 100;

    return (
        <div id="player" className={`player${currentTrack ? '' : ' hidden'}`}>
            <div className="player-progress-background">
                <span className="player-timecode player-timecode-start">{formatTime(currentTime)}</span>
                <span className="player-timecode player-timecode-end">{formatTime(duration)}</span>
                <input
                    type="range"
                    id="progressBar"
                    min="0"
                    max="100"
                    step="0.01"
                    value={progressPct}
                    onChange={(e) => seek((Number(e.target.value) / 100) * duration)}
                />
                <div className="player-progress-track" />
                <div className="player-progress-filled" style={{ width: `${progressPct}%` }} />
                <div className="player-progress-thumb" style={{ left: `${progressPct}%` }} />
            </div>

            <div className="player-container">
                <div className="player-left">
                    {cover && <img id="playerCover" className="player-cover" src={cover} alt="" />}
                    <div className="player-info">
                        <div className="player-title">{currentTrack?.title}</div>
                        <div className="player-artist">
                            {currentTrack?.artist}
                            {trackListeners > 1 && (
                                <span className="player-live-badge" title="Слушают сейчас">
                                    <span className="player-live-dot" />
                                    {trackListeners}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="player-center">
                    <div className="player-buttons">
                        <button
                            className={`btn-shuffle${isShuffled ? ' active' : ''}`}
                            onClick={toggleShuffle}
                            type="button"
                            title="Перемешать"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="16 3 21 3 21 8" />
                                <line x1="4" y1="20" x2="21" y2="3" />
                                <polyline points="16 21 21 21 21 16" />
                                <line x1="15" y1="15" x2="21" y2="21" />
                                <line x1="4" y1="4" x2="9" y2="9" />
                            </svg>
                        </button>
                        <button className="btn-prev" onClick={prev} type="button" title="Назад">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9.195 18.44c1.25.714 2.805-.189 2.805-1.629v-2.34l6.945 3.968c1.25.715 2.805-.188 2.805-1.628V8.69c0-1.44-1.555-2.343-2.805-1.628L12 11.029v-2.34c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061Z" />
                            </svg>
                        </button>
                        <button className="btn-play-pause" onClick={togglePlay} type="button" title={isPlaying ? 'Пауза' : 'Играть'}>
                            {isPlaying ? (
                                <svg id="playPauseIcon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg id="playPauseIcon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                        <button className="btn-next" onClick={next} type="button" title="Вперёд">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M5.055 7.06C3.805 6.347 2.25 7.25 2.25 8.69v8.122c0 1.44 1.555 2.343 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.343 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256l-7.108-4.061C13.555 6.346 12 7.249 12 8.689v2.34L5.055 7.061Z" />
                            </svg>
                        </button>
                        <button
                            className={`btn-repeat${isRepeating ? ' active' : ''}`}
                            onClick={toggleRepeat}
                            type="button"
                            title="Повтор"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="17 1 21 5 17 9" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <polyline points="7 23 3 19 7 15" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="player-right">
                    <button
                        className={`btn-like${liked ? ' liked' : ''}`}
                        onClick={() => currentTrack && toggleLike(currentTrack.id)}
                        type="button"
                        title={liked ? 'Убрать из избранного' : 'В избранное'}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                        </svg>
                    </button>
                    <div className="volume-control">
                        <button className="btn-volume" onClick={toggleMute} type="button" title={isMuted ? 'Включить звук' : 'Выключить звук'}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                {isMuted ? (
                                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 0 0-1.06-1.06L19.5 10.94l-1.72-1.72Z" />
                                ) : (
                                    <>
                                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                                        <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z" />
                                    </>
                                )}
                            </svg>
                        </button>
                        <div className="volume-slider-container">
                            <div>
                                <input
                                    type="range"
                                    id="volumeSlider"
                                    min="0"
                                    max="100"
                                    value={volumePct}
                                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                                />
                            </div>
                        </div>
                    </div>
                    <button className="btn-lyrics" onClick={toggleLyrics} type="button" title="Текст">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 4v16" />
                            <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
                            <path d="M9 20h6" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}


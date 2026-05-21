import { useEffect, useMemo, useRef, useState } from 'react';
import { useLyrics } from '@/store/lyrics';
import { usePlayer } from '@/store/player';
import { findActiveLine } from '@/lib/lrc';
import { readFrequencyData, extractDominantColor, adjustHue, ensureAnalyser } from '@/lib/visualizer';
import { formatTime } from '@/lib/format';

function avg(data: Uint8Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) sum += data[i];
    return sum / (end - start);
}

export function LyricsModal() {
    const { visible, contentHidden, visualizerOff, lines, toggle, toggleContent, toggleVisualizer } = useLyrics();
    const currentTrack = usePlayer((s) => s.currentTrack);
    const cover = usePlayer((s) => s.cover);
    const isPlaying = usePlayer((s) => s.isPlaying);
    const currentTime = usePlayer((s) => s.currentTime);
    const duration = usePlayer((s) => s.duration);
    const togglePlay = usePlayer((s) => s.togglePlay);
    const prev = usePlayer((s) => s.prev);
    const next = usePlayer((s) => s.next);
    const seek = usePlayer((s) => s.seek);

    const modalRef = useRef<HTMLDivElement>(null);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [dominant, setDominant] = useState<{ r: number; g: number; b: number }>({ r: 138, g: 43, b: 226 });
    // Mobile: false = cover/player view, true = full lyrics view
    const [expanded, setExpanded] = useState(false);

    const activeIdx = useMemo(
        () => (lines ? findActiveLine(lines, currentTime) : -1),
        [lines, currentTime],
    );

    const firstLineTime = lines && lines.length > 0 ? lines[0].time : null;
    const timeUntilFirst = firstLineTime !== null ? firstLineTime - currentTime : null;
    const isBeforeLyrics = activeIdx === -1 && lines !== null && lines.length > 0;
    const showLoader = isBeforeLyrics && (timeUntilFirst === null || timeUntilFirst > 3);
    const showCountdown = isBeforeLyrics && timeUntilFirst !== null && timeUntilFirst > 0 && timeUntilFirst <= 3;
    const countdownNum = showCountdown ? Math.ceil(timeUntilFirst) : null;

    // Reset to cover view when modal closes
    useEffect(() => {
        if (!visible) setExpanded(false);
    }, [visible]);

    // Init visualizer lazily when modal opens (keeps background audio working until then)
    useEffect(() => {
        if (!visible) return;
        const audioEl = document.getElementById('audioPlayer') as HTMLAudioElement | null;
        if (audioEl) ensureAnalyser(audioEl);
    }, [visible]);

    // Dominant color from cover
    useEffect(() => {
        if (!cover) return;
        let cancelled = false;
        extractDominantColor(cover).then((c) => { if (!cancelled) setDominant(c); });
        return () => { cancelled = true; };
    }, [cover]);

    // Apply dominant color CSS var
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;
        modal.style.setProperty('--wave-color', `${dominant.r}, ${dominant.g}, ${dominant.b}`);
    }, [dominant]);

    // Beat-sync background pulse
    useEffect(() => {
        const modal = modalRef.current;
        if (!modal || !visible || !isPlaying || visualizerOff) return;

        let raf = 0;
        let rotation = 0, currentScale = 1, currentOpacity = 0.2;
        let kickPower = 0, lastBass = 0, currentHue = 0;

        function tick() {
            const data = readFrequencyData();
            if (!data) { raf = requestAnimationFrame(tick); return; }

            const subBass = avg(data, 0, 8);
            const kick    = avg(data, 8, 15);
            const high    = avg(data, 100, 150);
            const bass    = (subBass * 0.6 + kick * 0.4);
            const bassI   = bass / 255;
            const highI   = high / 255;

            const targetHue = highI * 50 + bassI * 30;
            currentHue += (targetHue - currentHue) * 0.2;
            const c = adjustHue(dominant, currentHue);

            const bassDelta = Math.abs(bassI - lastBass);
            if (bassDelta > 0.2 && bassI > 0.6) kickPower = 1;
            lastBass = bassI;

            let targetScale: number, targetOpacity: number;
            if (kickPower > 0) {
                targetScale = 2.5 + Math.random() * 0.5;
                targetOpacity = 0.6 + Math.random() * 0.3;
                kickPower -= 0.08;
            } else {
                targetScale = 1 + bassI * 1.5;
                targetOpacity = 0.15 + bassI * 0.3;
            }

            currentScale   += (targetScale - currentScale)     * 0.85;
            currentOpacity += (targetOpacity - currentOpacity) * 0.9;
            rotation       += 2 + bassI * 8 + kickPower * 15;

            if (modal) {
                modal.style.setProperty('--wave-scale',    String(currentScale));
                modal.style.setProperty('--wave-opacity',  String(currentOpacity));
                modal.style.setProperty('--wave-color',    `${c.r}, ${c.g}, ${c.b}`);
                modal.style.setProperty('--wave-rotation', `${rotation}deg`);
                const coverPulse = 1 + bassI * 0.04 + kickPower * 0.02;
                modal.style.setProperty('--cover-pulse', coverPulse.toFixed(3));
            }
            raf = requestAnimationFrame(tick);
        }
        tick();
        return () => {
            cancelAnimationFrame(raf);
            if (modal) {
                modal.style.setProperty('--cover-pulse', '1');
                modal.style.setProperty('--wave-scale', '1');
                modal.style.setProperty('--wave-opacity', '0.08');
            }
        };
    }, [visible, isPlaying, visualizerOff, dominant]);

    // Auto-scroll active lyrics line into view
    useEffect(() => {
        if (!visible || activeIdx < 0) return;
        const scroller = scrollerRef.current;
        if (!scroller) return;
        const node = scroller.querySelector<HTMLDivElement>(`.lyrics-line[data-index="${activeIdx}"]`);
        if (node) {
            const target = node.offsetTop - scroller.clientHeight * 0.42 + node.clientHeight / 2;
            scroller.scrollTo({ top: target, behavior: 'smooth' });
        }
    }, [activeIdx, visible]);

    if (!currentTrack) return null;

    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const activeLineText = activeIdx >= 0 && lines ? lines[activeIdx].text : null;
    const hasLyrics = lines !== null && lines.length > 0;

    return (
        <div
            id="lyricsModal"
            ref={modalRef}
            className={`lyrics-modal${visible ? '' : ' hidden'}${contentHidden ? ' lyrics-hidden' : ''}${visualizerOff ? ' visualizer-off' : ''}${expanded ? ' lyrics-expanded' : ''}`}
        >
            <div className="lyrics-content">

                {/* ── Mobile top bar ── */}
                <div className="lyrics-mobile-topbar">
                    {expanded ? (
                        // Back to cover view
                        <button className="btn-close-lyrics-mobile" onClick={() => setExpanded(false)} type="button" aria-label="Назад">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                            </svg>
                        </button>
                    ) : (
                        // Close modal
                        <button className="btn-close-lyrics-mobile" onClick={toggle} type="button" aria-label="Свернуть">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 10l5 5 5-5z" />
                            </svg>
                        </button>
                    )}
                    {expanded && (
                        <div className="lyrics-mobile-trackinfo">
                            <div className="lyrics-mobile-title">{currentTrack.title}</div>
                            <div className="lyrics-mobile-artist">{currentTrack.artist}</div>
                        </div>
                    )}
                </div>

                {/* ── Mobile "Now Playing" cover view (default) ── */}
                <div className="lyrics-mobile-nowplaying">
                    <div className="lyrics-cover-mobile-wrap">
                        {cover && <img className="lyrics-cover" src={cover} alt="" />}
                    </div>
                    <div className="lyrics-mobile-nowplaying-info">
                        <div className="lyrics-mobile-title-big">{currentTrack.title}</div>
                        <div className="lyrics-mobile-artist-sub">{currentTrack.artist}</div>
                    </div>
                    <div className="lyrics-mobile-controls">
                        <button onClick={prev} type="button" aria-label="Предыдущий">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                            </svg>
                        </button>
                        <button className="btn-play-mobile" onClick={togglePlay} type="button" aria-label="Играть/Пауза">
                            {isPlaying ? (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                        <button onClick={next} type="button" aria-label="Следующий">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                            </svg>
                        </button>
                    </div>
                    <div className="lyrics-mobile-seek">
                        <span className="lyrics-timecode">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            className="lyrics-progress-slider"
                            min="0"
                            max="100"
                            step="0.01"
                            value={progressPct}
                            onChange={(e) => seek((Number(e.target.value) / 100) * duration)}
                        />
                        <span className="lyrics-timecode">{formatTime(duration)}</span>
                    </div>
                    {hasLyrics && (
                        <button
                            className="lyrics-activeline-pill"
                            onClick={() => setExpanded(true)}
                            type="button"
                        >
                            <span className="lyrics-activeline-text">
                                {showLoader ? '...' : showCountdown ? countdownNum : (activeLineText ?? '...')}
                            </span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, opacity: 0.6 }}>
                                <path d="M7 14l5-5 5 5z" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* ── Desktop left: cover + controls ── */}
                <div className="lyrics-left">
                    <div className="lyrics-cover-container">
                        <button
                            className={`btn-hide-lyrics-top${contentHidden ? ' active' : ''}`}
                            onClick={toggleContent}
                            type="button"
                            title="Скрыть текст"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                            </svg>
                        </button>
                        <button
                            className={`btn-visualizer-top${visualizerOff ? '' : ' active'}`}
                            onClick={toggleVisualizer}
                            type="button"
                            title={visualizerOff ? 'Включить визуализацию' : 'Выключить визуализацию'}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                            </svg>
                        </button>
                        {cover && <img className="lyrics-cover" src={cover} alt="" />}
                        <div className="lyrics-cover-overlay">
                            <button onClick={prev} type="button" aria-label="Предыдущий">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                                </svg>
                            </button>
                            <button className="btn-play-big" onClick={togglePlay} type="button" aria-label="Играть/Пауза">
                                {isPlaying ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <rect x="6" y="4" width="4" height="16" rx="1" />
                                        <rect x="14" y="4" width="4" height="16" rx="1" />
                                    </svg>
                                ) : (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                )}
                            </button>
                            <button onClick={next} type="button" aria-label="Следующий">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className="lyrics-track-info">
                        <div className="lyrics-track-title">{currentTrack.title}</div>
                        <div className="lyrics-track-artist">{currentTrack.artist}</div>
                        <div className="lyrics-progress-container">
                            <span className="lyrics-timecode lyrics-timecode-start">{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                className="lyrics-progress-slider"
                                min="0"
                                max="100"
                                step="0.01"
                                value={progressPct}
                                onChange={(e) => seek((Number(e.target.value) / 100) * duration)}
                            />
                            <span className="lyrics-timecode lyrics-timecode-end">{formatTime(duration)}</span>
                        </div>
                    </div>
                </div>

                {/* ── Lyrics text (desktop right / mobile expanded) ── */}
                <div className="lyrics-right">
                    <button className="btn-close-lyrics" onClick={toggle} type="button" title="Свернуть">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7 10l5 5 5-5z" />
                        </svg>
                    </button>

                    {showLoader && (
                        <div className="lyrics-loader">
                            <div className="lyrics-loader-element" />
                            <div className="lyrics-loader-element" />
                            <div className="lyrics-loader-element" />
                            <div className="lyrics-loader-element" />
                        </div>
                    )}

                    {showCountdown && countdownNum !== null && (
                        <div key={countdownNum} className="lyrics-countdown">
                            {countdownNum}
                        </div>
                    )}

                    <div id="lyricsText" className="lyrics-scroller" ref={scrollerRef}>
                        {lines === null ? null : lines.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 40px' }}>
                                <img src="/zmp.png" style={{ width: 80, height: 80, opacity: 0.3, marginBottom: 16 }} alt="" />
                                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Текста песни нету</p>
                                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 8 }}>
                                    Помогите проекту и создайте синхронизированный текст, обращайтесь за инструкциями в ТГ{' '}
                                    <a href="https://t.me/videlsvet" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>
                                        @videlsvet
                                    </a>
                                </p>
                            </div>
                        ) : isBeforeLyrics ? null : (
                            lines.map((l, i) => (
                                <div
                                    key={i}
                                    className={`lyrics-line${i === activeIdx ? ' active' : ''}${i < activeIdx ? ' past' : ''}`}
                                    data-index={i}
                                    data-time={l.time}
                                    onClick={() => seek(l.time)}
                                >
                                    {l.text}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Mobile footer (seek + controls, shown only in expanded lyrics view) ── */}
                <div className="lyrics-mobile-footer">
                    <div className="lyrics-mobile-seek">
                        <span className="lyrics-timecode">{formatTime(currentTime)}</span>
                        <input
                            type="range"
                            className="lyrics-progress-slider"
                            min="0"
                            max="100"
                            step="0.01"
                            value={progressPct}
                            onChange={(e) => seek((Number(e.target.value) / 100) * duration)}
                        />
                        <span className="lyrics-timecode">{formatTime(duration)}</span>
                    </div>
                    <div className="lyrics-mobile-controls">
                        <button onClick={prev} type="button" aria-label="Предыдущий">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                            </svg>
                        </button>
                        <button className="btn-play-mobile" onClick={togglePlay} type="button" aria-label="Играть/Пауза">
                            {isPlaying ? (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                            )}
                        </button>
                        <button onClick={next} type="button" aria-label="Следующий">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                            </svg>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

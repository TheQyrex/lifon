import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCatalog } from '@/store/catalog';
import { usePlayer } from '@/store/player';
import { TrackRow } from '@/components/TrackRow';
import { shareLink } from '@/lib/share';
import { extractDominantColor } from '@/lib/color';

export function AlbumScreen() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { loaded, load, findAlbum } = useCatalog();
    const currentTrack = usePlayer((s) => s.currentTrack);
    const playFromStore = usePlayer((s) => s.play);

    useEffect(() => {
        if (!loaded) load();
    }, [loaded, load]);

    const album = findAlbum(Number(id));
    const [shareFlash, setShareFlash] = useState<string | null>(null);
    const [bgColor, setBgColor] = useState<[number, number, number] | null>(null);
    const [exiting, setExiting] = useState(false);

    function handleBack() {
        setExiting(true);
        setTimeout(() => navigate(-1), 280);
    }

    useEffect(() => {
        if (album?.cover) {
            extractDominantColor(album.cover).then(setBgColor);
        }
    }, [album?.cover]);

    // Swipe down to go back
    const touchStartY = useRef<number>(0);
    function onTouchStart(e: React.TouchEvent) {
        touchStartY.current = e.touches[0].clientY;
    }
    function onTouchEnd(e: React.TouchEvent) {
        const dy = e.changedTouches[0].clientY - touchStartY.current;
        if (dy > 80) handleBack();
    }

    async function shareAlbum() {
        if (!album) return;
        const url = `${location.origin}/album/${album.id}`;
        const result = await shareLink(`${album.title} — LifonMUSIC`, url);
        if (result === 'copied') {
            setShareFlash('Ссылка скопирована');
            setTimeout(() => setShareFlash(null), 1500);
        }
    }

    function playTrack(trackId: number) {
        if (!album) return;
        const track = album.tracks.find((t) => t.id === trackId);
        if (!track) return;
        playFromStore(track, album.tracks, track.cover_url ?? album.cover ?? null);
    }

    function playWholeAlbum() {
        if (!album || !album.tracks.length) return;
        playFromStore(album.tracks[0], album.tracks, album.cover ?? null);
    }

    if (!loaded) return <div className="screen active" />;

    if (!album) {
        return (
            <div className="screen active">
                <button className="btn-back" onClick={() => navigate(-1)} type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                    </svg>
                </button>
                <p style={{ padding: 40, color: 'rgba(255,255,255,0.5)' }}>Альбом не найден</p>
            </div>
        );
    }

    return (
        <div
            id="albumScreen"
            className={`screen active${exiting ? ' exiting' : ''}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            {bgColor && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: `radial-gradient(ellipse 110% 55% at 50% 0%, rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},0.55) 0%, rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},0.22) 42%, rgba(${bgColor[0]},${bgColor[1]},${bgColor[2]},0.06) 70%, transparent 90%)`,
                    pointerEvents: 'none',
                    zIndex: 0,
                    animation: 'fadeIn 0.6s ease both',
                }} />
            )}
            <div className="album-detail" style={{ position: 'relative', zIndex: 1 }}>
                <div className="album-header">
                    <div className="album-cover-row">
                        <button className="btn-back-inline" onClick={handleBack} type="button" aria-label="Назад">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                            </svg>
                        </button>
                        {album.cover && <img className="album-cover" src={album.cover} alt={album.title} />}
                    </div>
                    <div className="album-info">
                        <h1>{album.title}</h1>
                        <div className="album-meta">
                            <span className="album-meta-pill">{album.year}</span>
                            <span className="album-meta-pill">{album.tracks.length} {album.tracks.length === 1 ? 'трек' : 'треков'}</span>
                        </div>
                        <div className="album-actions">
                            <button className="btn-play-all" type="button" onClick={playWholeAlbum}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Слушать альбом
                            </button>
                            <button className="btn-share-album" type="button" onClick={shareAlbum} title="Поделиться" aria-label="Поделиться">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </button>
                            {shareFlash && <span className="album-share-flash">{shareFlash}</span>}
                        </div>
                    </div>
                </div>
                <div className="tracks-list">
                    {album.tracks.map((t, i) => (
                        <TrackRow
                            key={t.id}
                            track={t}
                            index={i}
                            isCurrent={currentTrack?.id === t.id}
                            onPlay={playTrack}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '@/store/player';
import { useLive } from '@/store/live';
import { shareLink } from '@/lib/share';
import type { Album } from '@/types/api';

export function AlbumCard({ album }: { album: Album }) {
    const navigate = useNavigate();
    const play = usePlayer((s) => s.play);
    const [flash, setFlash] = useState<string | null>(null);

    const trackIds = useMemo(() => album.tracks.map((t) => t.id), [album.tracks]);
    const liveCount = useLive((s) => {
        let sum = 0;
        for (const id of trackIds) sum += s.tracks[id] ?? 0;
        return sum;
    });

    function go() {
        navigate(`/album/${album.id}`);
    }

    function playWhole(e: React.MouseEvent) {
        e.stopPropagation();
        if (album.tracks.length === 0) return;
        play(album.tracks[0], album.tracks, album.cover ?? null);
    }

    async function share(e: React.MouseEvent) {
        e.stopPropagation();
        const url = `${location.origin}/album/${album.id}`;
        const result = await shareLink(`${album.title} — LifonMUSIC`, url);
        if (result === 'copied') {
            setFlash('Ссылка скопирована');
            setTimeout(() => setFlash(null), 1500);
        }
    }

    return (
        <div className="album-card" onClick={go}>
            {album.cover ? <img src={album.cover} alt={album.title} /> : <div className="admin-album-cover-placeholder">♪</div>}
            <h3>{album.title}</h3>
            <p>{album.year}</p>

            {liveCount > 1 && (
                <div className="album-card-live" title={`${liveCount} слушают сейчас`}>
                    <span className="album-card-live-dot" />
                    {liveCount}
                </div>
            )}

            <div className="album-card-actions">
                <button
                    className="album-card-btn album-card-btn-play"
                    onClick={playWhole}
                    type="button"
                    title="Слушать"
                    aria-label="Слушать альбом"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </button>
                <button
                    className="album-card-btn"
                    onClick={share}
                    type="button"
                    title="Поделиться"
                    aria-label="Поделиться альбомом"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                </button>
            </div>

            {flash && <div className="album-card-flash">{flash}</div>}
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';
import { usePlayer } from '@/store/player';
import { useLikes } from '@/store/likes';
import { api } from '@/lib/api';
import { AlbumCard } from '@/components/AlbumCard';
import type { Album, Track } from '@/types/api';

interface LibraryTrack extends Track {
    album_title: string;
    _cover: string | null;
}

export function LibraryScreen() {
    const { albums, loaded, load } = useCatalog();
    const isAdmin = useAuth((s) => !!s.user?.is_admin);
    const currentTrack = usePlayer((s) => s.currentTrack);
    const play = usePlayer((s) => s.play);
    const [search, setSearch] = useState('');
    const [view, setView] = useState<'albums' | 'tracks'>('albums');
    const [dragId, setDragId] = useState<number | null>(null);
    const [overIdx, setOverIdx] = useState<number | null>(null);
    const [localAlbums, setLocalAlbums] = useState<Album[] | null>(null);

    useEffect(() => {
        if (!loaded) load();
    }, [loaded, load]);

    // Reset local order when catalog reloads
    useEffect(() => { setLocalAlbums(null); }, [albums]);

    const base = localAlbums ?? albums;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return base;
        return base.filter((a) => a.title.toLowerCase().includes(q) || a.year.includes(q));
    }, [base, search]);

    const allTracks: LibraryTrack[] = useMemo(() => {
        const out: LibraryTrack[] = [];
        for (const album of base) {
            for (const track of album.tracks) {
                const cover = track.cover_url ?? album.cover ?? null;
                out.push({
                    ...track,
                    cover_url: cover,
                    album_title: album.title,
                    _cover: cover,
                });
            }
        }
        return out;
    }, [base]);

    const filteredTracks = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allTracks;
        return allTracks.filter((t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album_title.toLowerCase().includes(q)
        );
    }, [allTracks, search]);

    const canDrag = isAdmin && view === 'albums' && !search.trim();

    async function handleDrop(targetIdx: number) {
        if (dragId === null) return;
        const srcIdx = filtered.findIndex((a) => a.id === dragId);
        if (srcIdx < 0 || srcIdx === targetIdx) return;

        const reordered = [...filtered];
        const [moved] = reordered.splice(srcIdx, 1);
        reordered.splice(targetIdx, 0, moved);
        setLocalAlbums(reordered);

        try {
            await api.patch('/admin/content/albums/reorder', {
                items: reordered.map((a, i) => ({ id: a.id, sort_order: i })),
            });
        } catch {
            setLocalAlbums(null);
        }
    }

    function playTrack(trackId: number) {
        const track = filteredTracks.find((t) => t.id === trackId);
        if (!track) return;
        play(track, filteredTracks, track._cover);
    }

    function playAllTracks() {
        if (!filteredTracks.length) return;
        play(filteredTracks[0], filteredTracks, filteredTracks[0]._cover);
    }

    return (
        <div id="libraryScreen" className="screen active">
            <div className="screen-header">
                <h1>Дискография</h1>
                <div className="library-tabs" role="tablist" aria-label="Режим библиотеки">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'albums'}
                        className={view === 'albums' ? 'active' : ''}
                        onClick={() => setView('albums')}
                    >
                        Альбомы
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={view === 'tracks'}
                        className={view === 'tracks' ? 'active' : ''}
                        onClick={() => setView('tracks')}
                    >
                        Все треки
                    </button>
                </div>
                <input
                    type="text"
                    placeholder={view === 'albums' ? 'Поиск альбомов...' : 'Поиск треков...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {view === 'albums' ? (
                <div className="albums-grid">
                    {filtered.map((album, idx) => (
                        <div
                            key={album.id}
                            draggable={canDrag}
                            onDragStart={canDrag ? () => setDragId(album.id) : undefined}
                            onDragEnd={canDrag ? () => { setDragId(null); setOverIdx(null); } : undefined}
                            onDragOver={canDrag ? (e) => { e.preventDefault(); setOverIdx(idx); } : undefined}
                            onDrop={canDrag ? () => { void handleDrop(idx); setOverIdx(null); } : undefined}
                            style={canDrag ? {
                                opacity: dragId === album.id ? 0.3 : 1,
                                outline: overIdx === idx && dragId !== album.id ? '2px solid rgba(167,139,250,0.7)' : 'none',
                                borderRadius: 16,
                                transition: 'opacity 0.15s ease',
                                cursor: 'grab',
                            } : undefined}
                        >
                            <AlbumCard album={album} />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="library-tracks">
                    <div className="library-tracks-header">
                        <span>{filteredTracks.length} треков</span>
                        <button type="button" onClick={playAllTracks} disabled={!filteredTracks.length}>
                            Слушать все
                        </button>
                    </div>
                    <div className="tracks-list">
                        {filteredTracks.length === 0 ? (
                            <p className="library-empty">Треки не найдены</p>
                        ) : (
                            filteredTracks.map((track, index) => (
                                <LibraryTrackRow
                                    key={track.id}
                                    track={track}
                                    index={index}
                                    isCurrent={currentTrack?.id === track.id}
                                    onPlay={playTrack}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function LibraryTrackRow({
    track,
    index,
    isCurrent,
    onPlay,
}: {
    track: LibraryTrack;
    index: number;
    isCurrent?: boolean;
    onPlay: (id: number) => void;
}) {
    const liked = useLikes((s) => s.liked.has(track.id));
    const toggle = useLikes((s) => s.toggle);

    return (
        <button
            type="button"
            className={`track-item library-track-row${isCurrent ? ' playing' : ''}`}
            onClick={() => onPlay(track.id)}
        >
            <div className="track-number">{index + 1}</div>
            {track._cover ? (
                <img src={track._cover} alt="" className="library-track-cover" />
            ) : (
                <div className="library-track-cover library-track-cover-placeholder">♪</div>
            )}
            <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist} · {track.album_title}</div>
            </div>
            <div className="track-duration">{track.duration}</div>
            <button
                className={`btn-like${liked ? ' liked' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggle(track.id); }}
                type="button"
                aria-label="Лайк"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
            </button>
        </button>
    );
}

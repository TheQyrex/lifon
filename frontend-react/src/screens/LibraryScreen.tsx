import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@/store/catalog';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { AlbumCard } from '@/components/AlbumCard';
import type { Album } from '@/types/api';

export function LibraryScreen() {
    const { albums, loaded, load } = useCatalog();
    const isAdmin = useAuth((s) => !!s.user?.is_admin);
    const [search, setSearch] = useState('');
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

    const canDrag = isAdmin && !search.trim();

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

    return (
        <div id="libraryScreen" className="screen active">
            <div className="screen-header">
                <h1>Дискография</h1>
                <input
                    type="text"
                    placeholder="Поиск альбомов..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
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
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '@/store/catalog';
import { AlbumCard } from '@/components/AlbumCard';

export function LibraryScreen() {
    const { albums, loaded, load } = useCatalog();
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!loaded) load();
    }, [loaded, load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return albums;
        return albums.filter((a) => a.title.toLowerCase().includes(q) || a.year.includes(q));
    }, [albums, search]);

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
                {filtered.map((album) => <AlbumCard key={album.id} album={album} />)}
            </div>
        </div>
    );
}

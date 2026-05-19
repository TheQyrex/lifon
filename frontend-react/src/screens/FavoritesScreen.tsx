import { useEffect, useMemo } from 'react';
import { useCatalog } from '@/store/catalog';
import { useLikes } from '@/store/likes';
import { usePlayer } from '@/store/player';
import { FavoriteRow } from '@/components/FavoriteRow';
import type { Track } from '@/types/api';

interface FavTrack extends Track {
    _cover: string | null;
}

export function FavoritesScreen() {
    const { albums, loaded, load } = useCatalog();
    const liked = useLikes((s) => s.liked);
    const currentTrack = usePlayer((s) => s.currentTrack);
    const play = usePlayer((s) => s.play);

    useEffect(() => {
        if (!loaded) load();
    }, [loaded, load]);

    const favorites: FavTrack[] = useMemo(() => {
        const out: FavTrack[] = [];
        for (const a of albums) {
            for (const t of a.tracks) {
                if (liked.has(t.id)) out.push({ ...t, _cover: t.cover_url ?? a.cover });
            }
        }
        return out;
    }, [albums, liked]);

    function playFavorite(trackId: number) {
        const fav = favorites.find((t) => t.id === trackId);
        if (!fav) return;
        play(fav, favorites, fav._cover);
    }

    return (
        <div id="favoritesScreen" className="screen active">
            <div className="screen-header">
                <h1>Избранное</h1>
            </div>
            <div className="tracks-list">
                {favorites.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 40 }}>
                        Нет избранных треков
                    </p>
                ) : (
                    favorites.map((t) => (
                        <FavoriteRow
                            key={t.id}
                            track={t}
                            cover={t._cover}
                            isCurrent={currentTrack?.id === t.id}
                            onPlay={playFavorite}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

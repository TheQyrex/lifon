import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { usePlayer } from '@/store/player';
import { useCatalog } from '@/store/catalog';
import { api, ApiException } from '@/lib/api';
import { toAbsoluteAsset } from '@/lib/assets';

interface TopTrack {
    track_id: number;
    title: string | null;
    artist: string | null;
    album_title: string | null;
    cover_url: string | null;
    plays: number;
}

interface ProfileResponse {
    ok: true;
    user: {
        id: number;
        username: string;
        is_admin: boolean;
        avatar_url: string | null;
        created_at: number;
    };
    totals: { listens: number; listen_ms: number; likes: number };
    top_tracks: TopTrack[];
}

export function ProfileScreen() {
    const { user, logout } = useAuth();
    const snowOn = useUi((s) => s.snowOn);
    const toggleSnow = useUi((s) => s.toggleSnow);
    const fileRef = useRef<HTMLInputElement>(null);

    const albums = useCatalog((s) => s.albums);
    const play = usePlayer((s) => s.play);

    const [data, setData] = useState<ProfileResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { void refresh(); }, []);

    async function refresh() {
        try {
            setData(await api.get<ProfileResponse>('/profile'));
        } catch (err) {
            setError(err instanceof ApiException ? err.message : 'Не удалось загрузить профиль');
        }
    }

    async function uploadAvatar(file: File) {
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            await api.upload('/profile/avatar', fd);
            await refresh();
        } catch (err) {
            setError(err instanceof ApiException ? err.message : 'Не удалось загрузить аватар');
        }
    }

    function playTrack(trackId: number) {
        // Найдём весь альбом этого трека чтобы поставить очередь
        const album = albums.find((a) => a.tracks.some((t) => t.id === trackId));
        const track = album?.tracks.find((t) => t.id === trackId);
        if (!album || !track) return;
        play(track, album.tracks, album.cover ?? null);
    }

    const top = data?.top_tracks ?? [];
    const fav = top[0];
    const minutes = data ? Math.round(data.totals.listen_ms / 60_000) : 0;
    const avatarUrl = data?.user.avatar_url ? toAbsoluteAsset(data.user.avatar_url) : null;
    const statsLine = data
        ? `Любимых треков: ${data.totals.likes} • Прослушано: ${minutes} мин • Треков прослушано: ${data.totals.listens} раз`
        : '';

    return (
        <div id="profileScreen" className="screen active">
            <div className="profile-content">
                <div className="screen-header">
                    <h1>Профиль</h1>
                </div>

                <div className="profile-info">
                    <button
                        className={`profile-snow-toggle${snowOn ? ' active' : ''}`}
                        onClick={toggleSnow}
                        type="button"
                        title={snowOn ? 'Выключить снег' : 'Включить снег'}
                        aria-label="Переключить снег"
                    >
                        <SnowflakeIcon />
                    </button>

                    <div
                        className="profile-avatar"
                        onClick={() => fileRef.current?.click()}
                        style={{ cursor: 'pointer', overflow: 'hidden' }}
                        title="Кликни чтобы загрузить аватар"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        )}
                    </div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); e.target.value = ''; }}
                    />

                    <h2>{user?.username || 'Гость'}</h2>
                    {error && <p style={{ color: '#FF6B8A', fontSize: 13 }}>{error}</p>}
                    {data && <p>{statsLine}</p>}

                    {fav && (
                        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 className="profile-section-heading">ЛЮБИМЫЙ ТРЕК</h3>
                            <div className="profile-favorite-card" onClick={() => playTrack(fav.track_id)}>
                                {fav.cover_url && <img src={toAbsoluteAsset(fav.cover_url) || ''} alt="" className="profile-favorite-cover" />}
                                <div className="profile-favorite-info">
                                    <div className="profile-favorite-title">{fav.title ?? `Трек ${fav.track_id}`}</div>
                                    <div className="profile-favorite-artist">{fav.artist ?? 'CUPSIZE'}</div>
                                </div>
                                <div className="profile-favorite-count">
                                    <span className="profile-favorite-count-value">{fav.plays}</span>
                                    <span className="profile-favorite-count-label">раз</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {top.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                            <h3 className="profile-section-heading">ТОП ТРЕКОВ</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {top.map((t, i) => (
                                    <div key={t.track_id} className="profile-top-row" onClick={() => playTrack(t.track_id)}>
                                        <div className="profile-top-position" style={{ color: positionColor(i + 1) }}>{i + 1}</div>
                                        {t.cover_url && <img src={toAbsoluteAsset(t.cover_url) || ''} alt="" className="profile-top-cover" />}
                                        <div className="profile-top-info">
                                            <div className="profile-top-title">{t.title ?? `Трек ${t.track_id}`}</div>
                                            <div className="profile-top-artist">{t.artist ?? 'CUPSIZE'}</div>
                                        </div>
                                        <div className="profile-top-count">{t.plays} раз</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <button className="btn-logout" type="button" onClick={logout}>Выйти</button>
            </div>
        </div>
    );
}

function positionColor(pos: number): string {
    if (pos === 1) return '#FFD700';
    if (pos === 2) return '#B0BEC5';
    if (pos === 3) return '#CD7F32';
    return 'rgba(255,255,255,0.4)';
}

function SnowflakeIcon() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
            <polyline points="9 5 12 2 15 5" />
            <polyline points="9 19 12 22 15 19" />
            <polyline points="5 9 2 12 5 15" />
            <polyline points="19 9 22 12 19 15" />
        </svg>
    );
}

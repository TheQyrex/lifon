import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/auth';
import { useUi } from '@/store/ui';
import { usePlayer } from '@/store/player';
import { useCatalog } from '@/store/catalog';
import { api, ApiException } from '@/lib/api';
import { toAbsoluteAsset } from '@/lib/assets';
import type { Achievement } from '@/types/api';

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

const USERNAME_RE = /^[a-z0-9._#-]{5,24}$/;

export function ProfileScreen() {
    const { user, logout, updateUsername } = useAuth();
    const snowOn = useUi((s) => s.snowOn);
    const toggleSnow = useUi((s) => s.toggleSnow);
    const fileRef = useRef<HTMLInputElement>(null);

    const albums = useCatalog((s) => s.albums);
    const play = usePlayer((s) => s.play);

    const [data, setData] = useState<ProfileResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [myAchievements, setMyAchievements] = useState<Achievement[]>([]);

    // Редактирование ника
    const [editingUsername, setEditingUsername] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [savingUsername, setSavingUsername] = useState(false);

    useEffect(() => { void refresh(); }, []);

    useEffect(() => {
        api.get<{ ok: true; achievements: Achievement[] }>('/achievements/my')
            .then((r) => setMyAchievements(r.achievements))
            .catch(() => {});
    }, []);

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

    function startEditUsername() {
        setNewUsername(data?.user.username ?? user?.username ?? '');
        setUsernameError(null);
        setEditingUsername(true);
    }

    function cancelEditUsername() {
        setEditingUsername(false);
        setUsernameError(null);
    }

    async function saveUsername() {
        const trimmed = newUsername.trim().toLowerCase();
        if (trimmed.length < 5) {
            setUsernameError('Не менее 5 символов');
            return;
        }
        if (!USERNAME_RE.test(trimmed)) {
            setUsernameError('Только a-z, 0-9, точка, дефис, подчёркивание (5–24 символа)');
            return;
        }
        setUsernameError(null);
        setSavingUsername(true);
        try {
            const res = await api.patch<{ ok: true; username: string; token: string }>(
                '/profile/username',
                { username: trimmed },
            );
            updateUsername(res.username, res.token);
            setData((prev) => prev ? { ...prev, user: { ...prev.user, username: res.username } } : null);
            setEditingUsername(false);
        } catch (err) {
            setUsernameError(err instanceof ApiException ? err.message : 'Ошибка при сохранении');
        } finally {
            setSavingUsername(false);
        }
    }

    function playTrack(trackId: number) {
        const album = albums.find((a) => a.tracks.some((t) => t.id === trackId));
        const track = album?.tracks.find((t) => t.id === trackId);
        if (!album || !track) return;
        play(track, album.tracks, album.cover ?? null);
    }

    const top = data?.top_tracks ?? [];
    const fav = top[0];
    const minutes = data ? Math.round(data.totals.listen_ms / 60_000) : 0;
    const avatarUrl = data?.user.avatar_url ? toAbsoluteAsset(data.user.avatar_url) : null;
    const displayUsername = data?.user.username || user?.username || 'Гость';
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

                    {/* ── Ник с кнопкой-карандашом ── */}
                    {editingUsername ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', gap: 6,
                            width: '100%', maxWidth: 280,
                        }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', width: '100%' }}>
                                <input
                                    type="text"
                                    value={newUsername}
                                    onChange={(e) => { setNewUsername(e.target.value); setUsernameError(null); }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') void saveUsername();
                                        if (e.key === 'Escape') cancelEditUsername();
                                    }}
                                    autoFocus
                                    maxLength={24}
                                    style={{
                                        flex: 1,
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: 10,
                                        color: '#fff',
                                        fontSize: 17,
                                        fontWeight: 700,
                                        padding: '6px 12px',
                                        outline: 'none',
                                        textAlign: 'center',
                                        letterSpacing: '0.01em',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => void saveUsername()}
                                    disabled={savingUsername}
                                    title="Сохранить"
                                    style={{
                                        background: 'rgba(255,255,255,0.12)',
                                        border: 'none',
                                        borderRadius: 8,
                                        color: '#fff',
                                        cursor: 'pointer',
                                        padding: '6px 11px',
                                        fontSize: 15,
                                        lineHeight: 1,
                                    }}
                                >
                                    {savingUsername ? '…' : '✓'}
                                </button>
                                <button
                                    type="button"
                                    onClick={cancelEditUsername}
                                    title="Отмена"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.35)',
                                        cursor: 'pointer',
                                        padding: '6px 8px',
                                        fontSize: 15,
                                        lineHeight: 1,
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                            {usernameError && (
                                <p style={{ color: '#FF6B8A', fontSize: 12, margin: 0, textAlign: 'center' }}>
                                    {usernameError}
                                </p>
                            )}
                        </div>
                    ) : (
                        <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                            {displayUsername}
                            {user && (
                                <button
                                    type="button"
                                    onClick={startEditUsername}
                                    title="Изменить ник"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'rgba(255,255,255,0.3)',
                                        padding: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'color 0.18s',
                                        flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}
                                >
                                    <PencilIcon />
                                </button>
                            )}
                        </h2>
                    )}

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

                {myAchievements.length > 0 && (
                    <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 className="profile-section-heading">АЧИВКИ</h3>
                        <div className="profile-achievements-grid">
                            {myAchievements.map((a) => {
                                const iconUrl = a.icon_url ? toAbsoluteAsset(a.icon_url) : null;
                                return (
                                    <div key={a.id} className="profile-achievement-card" title={a.description || a.name}>
                                        <div className="profile-achievement-icon">
                                            {iconUrl ? (
                                                <img src={iconUrl} alt="" className="profile-achievement-img" />
                                            ) : (
                                                <span className="profile-achievement-emoji">🏆</span>
                                            )}
                                        </div>
                                        <div className="profile-achievement-name">{a.name}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
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

function PencilIcon() {
    return (
        <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="18" y1="2" x2="22" y2="6" />
            <path d="M7.5 20.5L19 9l-4-4L3.5 16.5 2 22z" />
        </svg>
    );
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

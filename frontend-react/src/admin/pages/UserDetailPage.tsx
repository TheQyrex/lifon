import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiException } from '@/lib/api';
import { formatTs } from '@/lib/format';
import { Card, Button, Flash, Table, Th, Td, StatBox } from '../ui';
import { useAuth } from '@/store/auth';
import type { Album } from '@/types/api';

interface LikeRow {
    track_id: number;
    title: string | null;
    artist: string | null;
    album_title: string | null;
    created_at: number;
}

interface UserDetail {
    ok: true;
    user: {
        id: number;
        username: string;
        is_admin: boolean;
        created_at: number;
        last_seen_at: number | null;
        telegram_id: number | null;
        require_telegram: boolean;
    };
    totals: {
        listens: number;
        unique_tracks: number;
        listen_ms: number;
        likes: number;
        listens_real: number;
        unique_tracks_real: number;
        listen_ms_real: number;
        listens_bonus: number;
        listen_ms_bonus: number;
        unique_tracks_bonus: number;
    };
    top_tracks: {
        track_id: number;
        title: string | null;
        artist: string | null;
        album_title: string | null;
        plays: number;
    }[];
    likes: LikeRow[];
}

export function UserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const me = useAuth((s) => s.user);
    const [data, setData] = useState<UserDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    // Password reset
    const [newPassword, setNewPassword] = useState('');
    const [pwBusy, setPwBusy] = useState(false);

    // Желаемые итоговые значения (пользователь вводит что хочет видеть, бонус = желаемое - реальное)
    const [desiredListens, setDesiredListens] = useState('');
    const [desiredMinutes, setDesiredMinutes] = useState('');
    const [desiredUnique, setDesiredUnique] = useState('');
    const [statBusy, setStatBusy] = useState(false);

    // Likes management
    const [albums, setAlbums] = useState<Album[]>([]);
    const [selectedTrackId, setSelectedTrackId] = useState('');
    const [likesBusy, setLikesBusy] = useState(false);

    useEffect(() => {
        void load();
        api.get<{ ok: true; albums: Album[] }>('/albums')
            .then(r => setAlbums(r.albums))
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function load() {
        try {
            const res = await api.get<UserDetail>(`/admin/users/${id}`);
            setData(res);
            // Показываем итоговое значение (реальное + бонус)
            setDesiredListens(String(res.totals.listens));
            setDesiredMinutes(String(Math.round(res.totals.listen_ms / 60_000)));
            setDesiredUnique(String(res.totals.unique_tracks));
            setError(null);
        } catch (err) {
            setError(err instanceof ApiException ? err.message : 'Ошибка');
        }
    }

    async function toggleAdmin() {
        if (!data) return;
        setBusy(true);
        try {
            await api.patch(`/admin/users/${data.user.id}`, { is_admin: !data.user.is_admin });
            setFlash({ kind: 'success', text: data.user.is_admin ? 'Права админа сняты' : 'Назначен админом' });
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    async function toggleRequireTg() {
        if (!data) return;
        setBusy(true);
        try {
            await api.patch(`/admin/users/${data.user.id}`, { require_telegram: !data.user.require_telegram });
            setFlash({ kind: 'success', text: data.user.require_telegram ? 'TG больше не требуется' : 'TG теперь обязателен' });
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    async function unlinkTg() {
        if (!data) return;
        if (!confirm('Отвязать Telegram от этого аккаунта?')) return;
        setBusy(true);
        try {
            await api.patch(`/admin/users/${data.user.id}`, { telegram_id: null });
            setFlash({ kind: 'success', text: 'Telegram отвязан' });
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    async function resetPassword(e: React.FormEvent) {
        e.preventDefault();
        if (!data || newPassword.trim().length < 8) {
            setFlash({ kind: 'error', text: 'Пароль должен быть не менее 8 символов' });
            return;
        }
        setPwBusy(true);
        try {
            await api.patch(`/admin/users/${data.user.id}`, { password: newPassword });
            setFlash({ kind: 'success', text: 'Пароль успешно изменён' });
            setNewPassword('');
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setPwBusy(false);
        }
    }

    async function saveStatBonuses(e: React.FormEvent) {
        e.preventDefault();
        if (!data) return;
        setStatBusy(true);
        try {
            // Бонус = желаемое - реальное (не может быть отрицательным)
            await api.patch(`/admin/users/${data.user.id}`, {
                listens_bonus: Math.max(0, (parseInt(desiredListens, 10) || 0) - t.listens_real),
                listen_ms_bonus: Math.max(0, ((parseInt(desiredMinutes, 10) || 0) * 60_000) - t.listen_ms_real),
                unique_tracks_bonus: Math.max(0, (parseInt(desiredUnique, 10) || 0) - t.unique_tracks_real),
            });
            setFlash({ kind: 'success', text: 'Статистика обновлена' });
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setStatBusy(false);
        }
    }

    async function addLike(e: React.FormEvent) {
        e.preventDefault();
        if (!data) return;
        const tid = parseInt(selectedTrackId, 10);
        if (!tid) { setFlash({ kind: 'error', text: 'Выбери трек' }); return; }
        setLikesBusy(true);
        try {
            await api.post(`/admin/users/${data.user.id}/likes`, { track_id: tid });
            setSelectedTrackId('');
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setLikesBusy(false);
        }
    }

    async function removeLike(trackId: number) {
        if (!data) return;
        setLikesBusy(true);
        try {
            await api.delete(`/admin/users/${data.user.id}/likes/${trackId}`);
            await load();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setLikesBusy(false);
        }
    }

    async function remove() {
        if (!data) return;
        if (!confirm(`Удалить пользователя «${data.user.username}»? Все его прослушивания и лайки удалятся.`)) return;
        setBusy(true);
        try {
            await api.delete(`/admin/users/${data.user.id}`);
            navigate('/admin/users');
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
            setBusy(false);
        }
    }

    if (error) return <Flash kind="error">{error}</Flash>;
    if (!data) return <Card><p className="text-white/40">Загружаем…</p></Card>;

    const u = data.user;
    const t = data.totals;
    const isSelf = me?.id === u.id;
    const minutes = Math.round(t.listen_ms / 60_000);

    return (
        <div className="space-y-6">
            <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                К списку
            </Link>

            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{u.username}</h1>
                    <p className="text-white/40 mt-1 text-sm">
                        Создан {formatTs(u.created_at)} · Заходил {u.last_seen_at ? formatTs(u.last_seen_at) : '—'}
                        {u.is_admin && <span className="ml-3 px-2 py-0.5 rounded bg-accent/15 text-accent text-xs">admin</span>}
                    </p>
                    <p className="text-white/40 mt-1 text-sm">
                        Telegram:{' '}
                        {u.telegram_id
                            ? <span className="text-white/70 font-mono">{u.telegram_id}</span>
                            : <span className="text-white/30">не привязан</span>}
                        {' · '}
                        TG обязателен:{' '}
                        {u.require_telegram
                            ? <span className="text-yellow-400">да</span>
                            : <span className="text-white/30">нет</span>}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                    <Button variant="secondary" size="sm" onClick={toggleAdmin} disabled={busy || isSelf}
                        title={isSelf ? 'Нельзя менять свои права' : undefined}>
                        {u.is_admin ? 'Снять права админа' : 'Сделать админом'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={toggleRequireTg} disabled={busy || isSelf}>
                        {u.require_telegram ? 'Снять требование TG' : 'Потребовать TG'}
                    </Button>
                    {u.telegram_id && (
                        <Button variant="secondary" size="sm" onClick={unlinkTg} disabled={busy || isSelf}>
                            Отвязать TG
                        </Button>
                    )}
                    <Button variant="danger" size="sm" onClick={remove} disabled={busy || isSelf}
                        title={isSelf ? 'Нельзя удалить себя' : undefined}>
                        Удалить юзера
                    </Button>
                </div>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            {/* Статистика (отображение) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Прослушиваний" value={t.listens} />
                <StatBox label="Уникальных треков" value={t.unique_tracks} />
                <StatBox label="Минут" value={minutes} />
                <StatBox label="Лайков" value={t.likes} />
            </div>

            {/* Редактирование бонусов статистики */}
            <Card title="Редактировать статистику" description="Бонус прибавляется к реальным данным">
                <form onSubmit={saveStatBonuses} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-white/40 mb-1">
                                Прослушиваний (реальных: {t.listens_real})
                            </label>
                            <input type="number" min="0" value={desiredListens}
                                onChange={(e) => setDesiredListens(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">
                                Уник. треков (реальных: {t.unique_tracks_real})
                            </label>
                            <input type="number" min="0" value={desiredUnique}
                                onChange={(e) => setDesiredUnique(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
                        </div>
                        <div>
                            <label className="block text-xs text-white/40 mb-1">
                                Минут прослушано (реальных: {Math.round(t.listen_ms_real / 60_000)})
                            </label>
                            <input type="number" min="0" value={desiredMinutes}
                                onChange={(e) => setDesiredMinutes(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
                        </div>
                    </div>
                    <Button type="submit" variant="secondary" size="sm" disabled={statBusy}>
                        {statBusy ? 'Сохраняем…' : 'Сохранить статистику'}
                    </Button>
                </form>
            </Card>

            {/* Лайки — управление */}
            <Card title={`Лайки (${data.likes.length})`} description="Список всех лайкнутых треков">
                <div className="space-y-4">
                    {/* Форма добавить лайк */}
                    <form onSubmit={addLike} className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="block text-xs text-white/40 mb-1">Добавить лайк</label>
                            <select
                                value={selectedTrackId}
                                onChange={(e) => setSelectedTrackId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
                                style={{ backgroundColor: '#1a1a1f' }}
                            >
                                <option value="">— Выбери трек —</option>
                                {albums.map(album => (
                                    <optgroup key={album.id} label={`${album.title} (${album.year})`}>
                                        {album.tracks.map(track => (
                                            <option key={track.id} value={track.id}>
                                                {track.title}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </div>
                        <Button type="submit" variant="secondary" size="sm" disabled={likesBusy || !selectedTrackId}>
                            + Добавить
                        </Button>
                    </form>

                    {data.likes.length === 0 ? (
                        <p className="text-white/40 text-sm">Лайков нет.</p>
                    ) : (
                        <Table>
                            <thead>
                                <tr>
                                    <Th>ID</Th>
                                    <Th>Трек</Th>
                                    <Th>Альбом</Th>
                                    <Th>Когда</Th>
                                    <Th> </Th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.likes.map((r) => (
                                    <tr key={r.track_id} className="hover:bg-white/[0.02]">
                                        <Td className="text-white/30 font-mono text-xs">{r.track_id}</Td>
                                        <Td className="text-white">{r.title ?? `#${r.track_id}`}</Td>
                                        <Td className="text-white/50">{r.album_title ?? '—'}</Td>
                                        <Td className="text-white/50 text-xs">{formatTs(r.created_at)}</Td>
                                        <Td>
                                            <button
                                                onClick={() => removeLike(r.track_id)}
                                                disabled={likesBusy}
                                                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                                            >
                                                Удалить
                                            </button>
                                        </Td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </div>
            </Card>

            {/* Сброс пароля */}
            <Card title="Сброс пароля">
                <form onSubmit={resetPassword} className="flex gap-2 items-end">
                    <div className="flex-1">
                        <label className="block text-xs text-white/40 mb-1">Новый пароль (мин. 8 символов)</label>
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Введите новый пароль"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30" />
                    </div>
                    <Button type="submit" variant="secondary" size="sm" disabled={pwBusy || newPassword.length < 8}>
                        {pwBusy ? 'Сохраняем…' : 'Сменить пароль'}
                    </Button>
                </form>
            </Card>

            {/* Топ треков */}
            <Card title="Топ треков пользователя" description="10 самых часто прослушиваемых">
                {data.top_tracks.length === 0 ? (
                    <p className="text-white/40 text-sm">Пользователь ничего не слушал.</p>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Трек</Th>
                                <Th>Альбом</Th>
                                <Th>Прослушиваний</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.top_tracks.map((r) => (
                                <tr key={r.track_id} className="hover:bg-white/[0.02]">
                                    <Td className="text-white">{r.title ?? `#${r.track_id}`}</Td>
                                    <Td className="text-white/50">{r.album_title ?? '—'}</Td>
                                    <Td className="text-accent font-medium">{r.plays}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </div>
    );
}

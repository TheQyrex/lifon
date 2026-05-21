import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiException } from '@/lib/api';
import { formatTs } from '@/lib/format';
import { Card, Button, Flash, Table, Th, Td, StatBox } from '../ui';
import { useAuth } from '@/store/auth';

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
    };
    top_tracks: {
        track_id: number;
        title: string | null;
        artist: string | null;
        album_title: string | null;
        plays: number;
    }[];
    recent_likes: {
        track_id: number;
        title: string | null;
        artist: string | null;
        album_title: string | null;
        created_at: number;
    }[];
}

export function UserDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const me = useAuth((s) => s.user);
    const [data, setData] = useState<UserDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function load() {
        try {
            const res = await api.get<UserDetail>(`/admin/users/${id}`);
            setData(res);
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
    const hours = Math.round(t.listen_ms / 3_600_000);

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
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleAdmin}
                        disabled={busy || isSelf}
                        title={isSelf ? 'Нельзя менять свои права' : undefined}
                    >
                        {u.is_admin ? 'Снять права админа' : 'Сделать админом'}
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleRequireTg}
                        disabled={busy || isSelf}
                    >
                        {u.require_telegram ? 'Снять требование TG' : 'Потребовать TG'}
                    </Button>
                    {u.telegram_id && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={unlinkTg}
                            disabled={busy || isSelf}
                        >
                            Отвязать TG
                        </Button>
                    )}
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={remove}
                        disabled={busy || isSelf}
                        title={isSelf ? 'Нельзя удалить себя' : undefined}
                    >
                        Удалить юзера
                    </Button>
                </div>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Прослушиваний" value={t.listens} />
                <StatBox label="Уникальных треков" value={t.unique_tracks} />
                <StatBox label="Часов" value={hours} />
                <StatBox label="Лайков" value={t.likes} />
            </div>

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

            <Card title="Последние лайки" description="20 самых свежих">
                {data.recent_likes.length === 0 ? (
                    <p className="text-white/40 text-sm">Лайков нет.</p>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Трек</Th>
                                <Th>Альбом</Th>
                                <Th>Когда</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.recent_likes.map((r) => (
                                <tr key={r.track_id} className="hover:bg-white/[0.02]">
                                    <Td className="text-white">{r.title ?? `#${r.track_id}`}</Td>
                                    <Td className="text-white/50">{r.album_title ?? '—'}</Td>
                                    <Td className="text-white/50 text-xs">{formatTs(r.created_at)}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </div>
    );
}


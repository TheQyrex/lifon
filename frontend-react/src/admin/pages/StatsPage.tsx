import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { formatTs } from '@/lib/format';
import { Card, StatBox, Flash, Table, Th, Td } from '../ui';

interface TopTrackRow {
    track_id: number;
    title: string | null;
    artist: string | null;
    album_title: string | null;
    plays?: number;
    likes?: number;
    listeners?: number;
}

interface RecentUser {
    id: number;
    username: string;
    created_at: number;
    last_seen_at: number | null;
    is_admin: boolean;
}

interface StatsResponse {
    ok: true;
    totals: {
        users: number;
        users_active_30d: number;
        listens: number;
        listens_recent_30d: number;
        listen_ms: number;
        likes: number;
    };
    top_tracks: TopTrackRow[];
    top_liked: TopTrackRow[];
    recent_users: RecentUser[];
}

export function StatsPage() {
    const [data, setData] = useState<StatsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<StatsResponse>('/admin/stats')
            .then(setData)
            .catch((err) => setError(err instanceof ApiException ? err.message : 'Ошибка'));
    }, []);

    if (error) return <Flash kind="error">{error}</Flash>;
    if (!data) return <Card><p className="text-white/40">Загружаем статистику…</p></Card>;

    const t = data.totals;
    const cells = [
        ['Пользователи',     t.users],
        ['Активны (30 дн)',  t.users_active_30d],
        ['Прослушиваний',    t.listens],
        ['За 30 дней',       t.listens_recent_30d],
        ['Лайков',           t.likes],
        ['Часов прослушано', Math.round(t.listen_ms / 3_600_000)],
    ] as const;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Статистика</h1>
                <p className="text-white/40 mt-1">Сводка по пользователям, прослушиваниям и лайкам.</p>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {cells.map(([label, value]) => (
                    <StatBox key={label} label={label} value={value} />
                ))}
            </div>

            <Card title="Топ по прослушиваниям" description="20 самых играемых треков">
                <TopTable rows={data.top_tracks} valueLabel="Прослушиваний" valueKey="plays" extraLabel="Слушателей" extraKey="listeners" />
            </Card>

            <Card title="Топ по лайкам" description="20 самых лайкнутых треков">
                <TopTable rows={data.top_liked} valueLabel="Лайков" valueKey="likes" />
            </Card>

            <Card title="Недавние регистрации">
                <Table>
                    <thead>
                        <tr>
                            <Th>Юзер</Th>
                            <Th>Создан</Th>
                            <Th>Заходил</Th>
                            <Th>Админ</Th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.recent_users.map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02]">
                                <Td className="text-white">{u.username}</Td>
                                <Td className="text-white/60">{formatTs(u.created_at)}</Td>
                                <Td className="text-white/60">{u.last_seen_at ? formatTs(u.last_seen_at) : '—'}</Td>
                                <Td>{u.is_admin && <span className="text-accent">✓</span>}</Td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </Card>
        </div>
    );
}

interface TopTableProps {
    rows: TopTrackRow[];
    valueKey: 'plays' | 'likes';
    valueLabel: string;
    extraKey?: 'listeners';
    extraLabel?: string;
}

function TopTable({ rows, valueLabel, valueKey, extraKey, extraLabel }: TopTableProps) {
    return (
        <Table>
            <thead>
                <tr>
                    <Th>Трек</Th>
                    <Th>Альбом</Th>
                    <Th>{valueLabel}</Th>
                    {extraKey && <Th>{extraLabel}</Th>}
                </tr>
            </thead>
            <tbody>
                {rows.map((r) => (
                    <tr key={r.track_id} className="hover:bg-white/[0.02]">
                        <Td className="text-white">{r.title ?? `#${r.track_id}`}</Td>
                        <Td className="text-white/50">{r.album_title ?? '—'}</Td>
                        <Td className="text-accent font-medium">{r[valueKey] ?? 0}</Td>
                        {extraKey && <Td className="text-white/60">{r[extraKey] ?? 0}</Td>}
                    </tr>
                ))}
            </tbody>
        </Table>
    );
}


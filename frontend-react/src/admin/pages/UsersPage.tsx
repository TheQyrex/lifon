import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiException } from '@/lib/api';
import { formatTs } from '@/lib/format';
import { Card, Button, Input, Flash, Table, Th, Td } from '../ui';

interface UserListItem {
    id: number;
    username: string;
    is_admin: boolean;
    created_at: number;
    last_seen_at: number | null;
    listens: number;
    likes: number;
}

interface UsersResponse {
    ok: true;
    users: UserListItem[];
    total: number;
    limit: number;
    offset: number;
}

const PAGE_SIZE = 50;

export function UsersPage() {
    const [data, setData] = useState<UsersResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (q.trim()) params.set('q', q.trim());

        api.get<UsersResponse>(`/admin/users?${params}`)
            .then((res) => { if (!cancelled) { setData(res); setError(null); } })
            .catch((err) => { if (!cancelled) setError(err instanceof ApiException ? err.message : 'Ошибка'); });

        return () => { cancelled = true; };
    }, [q, offset]);

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
                <p className="text-white/40 mt-1">Список юзеров. Клик по строке откроет карточку со статистикой.</p>
            </header>

            <Card
                title={data ? `Всего: ${data.total}` : 'Загружаем…'}
                actions={
                    <Input
                        type="search"
                        placeholder="Поиск по имени…"
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                        className="w-64"
                    />
                }
            >
                {error && <Flash kind="error">{error}</Flash>}
                {data && (
                    <>
                        <Table>
                            <thead>
                                <tr>
                                    <Th>Юзер</Th>
                                    <Th>Прослушиваний</Th>
                                    <Th>Лайков</Th>
                                    <Th>Создан</Th>
                                    <Th>Заходил</Th>
                                    <Th>Админ</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.users.map((u) => (
                                    <tr key={u.id} className="hover:bg-white/[0.03] cursor-pointer">
                                        <Td>
                                            <Link to={`/admin/users/${u.id}`} className="text-white hover:text-accent">
                                                {u.username}
                                            </Link>
                                        </Td>
                                        <Td className="text-white/70">{u.listens}</Td>
                                        <Td className="text-white/70">{u.likes}</Td>
                                        <Td className="text-white/40 text-xs">{formatTs(u.created_at)}</Td>
                                        <Td className="text-white/40 text-xs">{u.last_seen_at ? formatTs(u.last_seen_at) : '—'}</Td>
                                        <Td>{u.is_admin && <span className="text-accent">✓</span>}</Td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        {data.total > PAGE_SIZE && (
                            <div className="flex items-center justify-between mt-4 text-sm text-white/40">
                                <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} из {data.total}</span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                                        ← Назад
                                    </Button>
                                    <Button variant="ghost" size="sm" disabled={offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                                        Дальше →
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
}


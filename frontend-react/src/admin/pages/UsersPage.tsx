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
    telegram_id: number | null;
    require_telegram: boolean;
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
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (q.trim()) params.set('q', q.trim());

        api.get<UsersResponse>(`/admin/users?${params}`)
            .then((res) => { if (!cancelled) { setData(res); setError(null); } })
            .catch((err) => { if (!cancelled) setError(err instanceof ApiException ? err.message : 'Ошибка'); });

        return () => { cancelled = true; };
    }, [q, offset]);

    function reload() {
        setQ((v) => v); // trigger re-fetch via dependency change trick
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
        if (q.trim()) params.set('q', q.trim());
        api.get<UsersResponse>(`/admin/users?${params}`)
            .then((res) => { setData(res); setError(null); })
            .catch((err) => { setError(err instanceof ApiException ? err.message : 'Ошибка'); });
    }

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Пользователи</h1>
                    <p className="text-white/40 mt-1">Список юзеров. Клик по строке откроет карточку со статистикой.</p>
                </div>
                <div className="flex gap-2">
                    <ResetAllPasswordsButton />
                    <Button variant="primary" size="sm" onClick={() => setShowCreate((v) => !v)}>
                        {showCreate ? 'Отмена' : '+ Добавить'}
                    </Button>
                </div>
            </header>

            {showCreate && (
                <CreateUserForm onCreated={() => { setShowCreate(false); reload(); }} />
            )}

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
                                    <Th>Telegram</Th>
                                    <Th>Требуется TG</Th>
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
                                        <Td className="text-white/70 font-mono text-xs">
                                            {u.telegram_id ? String(u.telegram_id) : <span className="text-white/30">—</span>}
                                        </Td>
                                        <Td>
                                            {u.require_telegram
                                                ? <span className="text-yellow-400 text-xs">обяз.</span>
                                                : <span className="text-white/30 text-xs">нет</span>}
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

function ResetAllPasswordsButton() {
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    async function reset() {
        if (!confirm('Сбросить пароли ВСЕМ пользователям? При следующем входе каждый придумает новый пароль.')) return;
        setBusy(true);
        try {
            await api.post('/admin/users/reset-all-passwords');
            setDone(true);
            setTimeout(() => setDone(false), 3000);
        } catch (err) {
            alert(err instanceof ApiException ? err.message : 'Ошибка');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Button variant="danger" size="sm" onClick={reset} disabled={busy}>
            {done ? '✓ Готово' : busy ? 'Сбрасываем…' : 'Сбросить все пароли'}
        </Button>
    );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [requireTg, setRequireTg] = useState(false);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    async function submit() {
        if (!username || !password) { setFlash({ kind: 'error', text: 'Заполни все поля' }); return; }
        setBusy(true);
        try {
            await api.post('/admin/users', { username, password, require_telegram: requireTg });
            setFlash({ kind: 'success', text: `Пользователь «${username}» создан` });
            setUsername(''); setPassword(''); setRequireTg(false);
            setTimeout(onCreated, 800);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <Card title="Новый пользователь">
            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}
            <div className="flex flex-col gap-3 max-w-sm">
                <Input
                    placeholder="Имя пользователя"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                />
                <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={requireTg}
                        onChange={(e) => setRequireTg(e.target.checked)}
                        className="accent-accent w-4 h-4"
                    />
                    Требовать привязку Telegram
                </label>
                <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
                    {busy ? 'Создаём…' : 'Создать'}
                </Button>
            </div>
        </Card>
    );
}

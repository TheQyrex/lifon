import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { toAbsoluteAsset } from '@/lib/assets';
import { Card, Button, Field, Input, Flash, Table, Th, Td } from '../ui';

const CONDITION_TYPES = [
    { value: 'listens_total',  label: 'Прослушиваний всего' },
    { value: 'unique_tracks',  label: 'Уникальных треков' },
    { value: 'likes_total',    label: 'Лайков всего' },
    { value: 'manual',         label: 'Ручная выдача' },
] as const;

interface Achievement {
    id: number;
    name: string;
    description: string;
    icon_key: string | null;
    icon_url: string | null;
    condition_type: string;
    condition_value: number;
    created_at: number;
}

export function AchievementsPage() {
    const [items, setItems] = useState<Achievement[] | null>(null);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);

    useEffect(() => { void refresh(); }, []);

    async function refresh() {
        try {
            const res = await api.get<{ ok: true; achievements: Achievement[] }>('/admin/achievements');
            setItems(res.achievements);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка загрузки' });
        }
    }

    async function remove(id: number, name: string) {
        if (!confirm(`Удалить ачивку «${name}»?`)) return;
        try {
            await api.delete(`/admin/achievements/${id}`);
            setFlash({ kind: 'success', text: 'Удалено' });
            await refresh();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Ачивки</h1>
                <p className="text-white/40 mt-1">Достижения пользователей — выдаются автоматически или вручную.</p>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            <Card
                title="Все ачивки"
                actions={
                    <Button size="sm" onClick={() => setEditingId('new')} disabled={editingId === 'new'}>
                        + Новая
                    </Button>
                }
            >
                {editingId === 'new' && (
                    <div className="mb-4">
                        <AchievementForm
                            achievement={null}
                            onSaved={async () => { setEditingId(null); await refresh(); setFlash({ kind: 'success', text: 'Ачивка создана' }); }}
                            onClose={() => setEditingId(null)}
                            setFlash={setFlash}
                        />
                    </div>
                )}

                {items === null ? (
                    <p className="text-white/40">Загружаем…</p>
                ) : items.length === 0 ? (
                    <p className="text-white/40 text-sm">Ачивок нет.</p>
                ) : (
                    <Table>
                        <thead>
                            <tr>
                                <Th>Ачивка</Th>
                                <Th>Условие</Th>
                                <Th>Значение</Th>
                                <Th> </Th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((a) => (
                                <>
                                    <tr key={a.id} className="hover:bg-white/[0.02]">
                                        <Td>
                                            <div className="flex items-center gap-3">
                                                {a.icon_url ? (
                                                    <img src={toAbsoluteAsset(a.icon_url) || ''} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/30 shrink-0">🏆</div>
                                                )}
                                                <div>
                                                    <div className="text-white text-sm font-medium">{a.name}</div>
                                                    {a.description && <div className="text-white/40 text-xs">{a.description}</div>}
                                                </div>
                                            </div>
                                        </Td>
                                        <Td className="text-white/60 text-sm">
                                            {CONDITION_TYPES.find(t => t.value === a.condition_type)?.label ?? a.condition_type}
                                        </Td>
                                        <Td className="text-accent font-medium">
                                            {a.condition_type === 'manual' ? '—' : a.condition_value}
                                        </Td>
                                        <Td>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => setEditingId(editingId === a.id ? null : a.id)}>
                                                    {editingId === a.id ? 'Закрыть' : 'Изменить'}
                                                </Button>
                                                <AwardButton achievementId={a.id} setFlash={setFlash} />
                                                <Button variant="danger" size="sm" onClick={() => remove(a.id, a.name)}>×</Button>
                                            </div>
                                        </Td>
                                    </tr>
                                    {editingId === a.id && (
                                        <tr key={`edit-${a.id}`}>
                                            <td colSpan={4} className="px-0 pb-3">
                                                <AchievementForm
                                                    achievement={a}
                                                    onSaved={async () => { setEditingId(null); await refresh(); setFlash({ kind: 'success', text: 'Сохранено' }); }}
                                                    onClose={() => setEditingId(null)}
                                                    setFlash={setFlash}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Card>
        </div>
    );
}

interface FormProps {
    achievement: Achievement | null;
    onSaved: () => Promise<void>;
    onClose: () => void;
    setFlash: (f: { kind: 'success' | 'error'; text: string }) => void;
}

function AchievementForm({ achievement, onSaved, onClose, setFlash }: FormProps) {
    const [name, setName] = useState(achievement?.name ?? '');
    const [description, setDescription] = useState(achievement?.description ?? '');
    const [conditionType, setConditionType] = useState(achievement?.condition_type ?? 'listens_total');
    const [conditionValue, setConditionValue] = useState(String(achievement?.condition_value ?? 0));
    const [iconKey, setIconKey] = useState<string | null>(achievement?.icon_key ?? null);
    const [iconUrl, setIconUrl] = useState<string | null>(achievement?.icon_url ?? null);
    const [busy, setBusy] = useState(false);

    async function uploadIcon(file: File) {
        try {
            const fd = new FormData();
            fd.append('kind', 'cover');
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setIconKey(res.key);
            setIconUrl(toAbsoluteAsset(res.url));
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка загрузки' });
        }
    }

    async function save() {
        if (!name.trim()) { setFlash({ kind: 'error', text: 'Название обязательно' }); return; }
        setBusy(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim(),
                icon_key: iconKey,
                condition_type: conditionType,
                condition_value: conditionType === 'manual' ? 0 : Math.max(0, parseInt(conditionValue) || 0),
            };
            if (achievement) await api.put(`/admin/achievements/${achievement.id}`, payload);
            else             await api.post('/admin/achievements', payload);
            await onSaved();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4 space-y-3">
            <div className="flex gap-4 items-start">
                <label className="cursor-pointer shrink-0">
                    {iconUrl ? (
                        <img src={iconUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/10" />
                    ) : (
                        <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-2xl">🏆</div>
                    )}
                    <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadIcon(f); e.target.value = ''; }}
                    />
                    <div className="text-xs text-white/30 mt-1 text-center">иконка</div>
                </label>
                <div className="flex-1 space-y-3">
                    <Field label="Название"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
                    <Field label="Описание"><Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Условие">
                            <select
                                value={conditionType}
                                onChange={(e) => setConditionType(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-accent/50"
                                style={{ colorScheme: 'dark' }}
                            >
                                {CONDITION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </Field>
                        {conditionType !== 'manual' && (
                            <Field label="Значение">
                                <Input
                                    type="number"
                                    min="1"
                                    value={conditionValue}
                                    onChange={(e) => setConditionValue(e.target.value)}
                                />
                            </Field>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
                <Button size="sm" onClick={save} disabled={busy}>
                    {busy ? 'Сохраняем…' : (achievement ? 'Сохранить' : 'Создать')}
                </Button>
            </div>
        </div>
    );
}

interface AwardButtonProps {
    achievementId: number;
    setFlash: (f: { kind: 'success' | 'error'; text: string }) => void;
}

function AwardButton({ achievementId, setFlash }: AwardButtonProps) {
    async function award() {
        const username = prompt('Ник пользователя:')?.trim();
        if (!username) return;
        try {
            // Find user by username (exact match)
            const search = await api.get<{ ok: true; users: { id: number; username: string }[] }>(
                `/admin/users?q=${encodeURIComponent(username)}&limit=20`,
            );
            const found = search.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
            if (!found) {
                setFlash({ kind: 'error', text: `Пользователь «${username}» не найден` });
                return;
            }
            const res = await api.post<{ ok: true; awarded: boolean }>(`/admin/achievements/${achievementId}/award`, { user_id: found.id });
            setFlash({ kind: 'success', text: res.awarded ? `Ачивка выдана ${found.username}` : `У ${found.username} уже есть эта ачивка` });
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }
    return <Button variant="secondary" size="sm" onClick={award}>Выдать</Button>;
}

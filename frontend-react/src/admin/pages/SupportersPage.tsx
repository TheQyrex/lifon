import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { Card, Button, Field, Input, Flash } from '../ui';
import type { Supporter } from '@/types/api';

interface DraftSupporter {
    name: string;
    handle: string;
    color: string;
}

const DEFAULT_COLOR = '#8b5cf6';

export function SupportersPage() {
    const [items, setItems] = useState<Supporter[] | null>(null);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { void refresh(); }, []);

    async function refresh() {
        try {
            const res = await api.get<{ ok: true; supporters: Supporter[] }>('/admin/supporters');
            setItems(res.supporters);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
            setItems([]);
        }
    }

    async function save(id: number, draft: DraftSupporter) {
        try {
            await api.put(`/admin/supporters/${id}`, draft);
            setFlash({ kind: 'success', text: 'Сохранено' });
            await refresh();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    async function create(draft: DraftSupporter) {
        try {
            await api.post('/admin/supporters', draft);
            setFlash({ kind: 'success', text: 'Добавлено' });
            await refresh();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
            throw err;
        }
    }

    async function remove(s: Supporter) {
        if (!confirm(`Удалить «${s.name}»?`)) return;
        try {
            await api.delete(`/admin/supporters/${s.id}`);
            setFlash({ kind: 'success', text: 'Удалено' });
            await refresh();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    async function reorder(orderedIds: number[]) {
        const payload = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
        try {
            await api.patch('/admin/supporters/reorder', { items: payload });
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка сохранения порядка' });
        }
    }

    function move(index: number, dir: -1 | 1) {
        if (!items) return;
        const next = index + dir;
        if (next < 0 || next >= items.length) return;
        const copy = items.slice();
        [copy[index], copy[next]] = [copy[next], copy[index]];
        setItems(copy);
        void reorder(copy.map((s) => s.id));
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Карточки поддержки</h1>
                <p className="text-white/40 mt-1">Показываются на вкладке «О LifonMUSIC». Цвет применяется к фону карточки и аватарке.</p>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            <Card title="Список">
                {items === null ? (
                    <p className="text-white/40">Загружаем…</p>
                ) : items.length === 0 ? (
                    <p className="text-white/40 text-sm">Пока никого нет.</p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {items.map((s, i) => (
                            <SupporterRow
                                key={s.id}
                                supporter={s}
                                onSave={(d) => save(s.id, d)}
                                onDelete={() => remove(s)}
                                onMoveUp={i > 0 ? () => move(i, -1) : undefined}
                                onMoveDown={i < items.length - 1 ? () => move(i, 1) : undefined}
                            />
                        ))}
                    </ul>
                )}
            </Card>

            <Card title="Добавить">
                <AddSupporterForm onCreate={create} />
            </Card>
        </div>
    );
}

interface SupporterRowProps {
    supporter: Supporter;
    onSave: (draft: DraftSupporter) => Promise<void>;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}

function SupporterRow({ supporter, onSave, onDelete, onMoveUp, onMoveDown }: SupporterRowProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<DraftSupporter>({
        name: supporter.name,
        handle: supporter.handle,
        color: supporter.color,
    });
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setDraft({ name: supporter.name, handle: supporter.handle, color: supporter.color });
    }, [supporter.name, supporter.handle, supporter.color]);

    const initial = (draft.name || '?').charAt(0).toUpperCase();
    const color = draft.color || DEFAULT_COLOR;

    if (!editing) {
        return (
            <li
                className="flex items-center gap-3 rounded-xl border px-4 py-3"
                style={{ background: `${color}18`, borderColor: `${color}40` }}
            >
                <div
                    className="flex w-10 h-10 items-center justify-center rounded-full border text-sm font-bold shrink-0"
                    style={{ background: `${color}33`, borderColor: `${color}66`, color }}
                >
                    {initial}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{supporter.name}</div>
                    <div className="text-xs text-white/40 truncate">{supporter.handle}</div>
                </div>
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={onMoveUp} disabled={!onMoveUp} title="Вверх">↑</Button>
                    <Button variant="ghost" size="sm" onClick={onMoveDown} disabled={!onMoveDown} title="Вниз">↓</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Редактировать</Button>
                </div>
            </li>
        );
    }

    return (
        <li
            className="rounded-xl border p-4"
            style={{ background: `${color}10`, borderColor: `${color}30` }}
        >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
                <Field label="Имя">
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} />
                </Field>
                <Field label="Никнейм">
                    <Input value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} maxLength={100} />
                </Field>
                <Field label="Цвет">
                    <input
                        type="color"
                        value={draft.color}
                        onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                        className="w-14 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                    />
                </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Отмена</Button>
                <Button variant="danger" size="sm" onClick={onDelete}>Удалить</Button>
                <Button
                    size="sm"
                    disabled={busy || !draft.name.trim() || !draft.handle.trim()}
                    onClick={async () => {
                        setBusy(true);
                        try { await onSave(draft); setEditing(false); }
                        finally { setBusy(false); }
                    }}
                >
                    {busy ? 'Сохраняем…' : 'Сохранить'}
                </Button>
            </div>
        </li>
    );
}

function AddSupporterForm({ onCreate }: { onCreate: (draft: DraftSupporter) => Promise<void> }) {
    const [draft, setDraft] = useState<DraftSupporter>({ name: '', handle: '', color: DEFAULT_COLOR });
    const [busy, setBusy] = useState(false);

    async function submit() {
        if (!draft.name.trim() || !draft.handle.trim()) return;
        setBusy(true);
        try {
            await onCreate(draft);
            setDraft({ name: '', handle: '', color: DEFAULT_COLOR });
        } catch { /* flash уже выставлен */ }
        finally { setBusy(false); }
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
            <Field label="Имя">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={100} placeholder="Иван" />
            </Field>
            <Field label="Никнейм">
                <Input value={draft.handle} onChange={(e) => setDraft({ ...draft, handle: e.target.value })} maxLength={100} placeholder="@username" />
            </Field>
            <Field label="Цвет">
                <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="w-14 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                />
            </Field>
            <Button onClick={submit} disabled={busy || !draft.name.trim() || !draft.handle.trim()}>
                {busy ? 'Добавляем…' : 'Добавить'}
            </Button>
        </div>
    );
}

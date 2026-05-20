import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { formatTs } from '@/lib/format';
import { Card, Button, Field, Input, Textarea, Select, Flash } from '../ui';
import { Formatted } from '@/lib/markdown';

type Kind = 'notification' | 'banner';

interface BroadcastButton {
    label: string;
    url: string;
    color: string;
    text_color: string;
}

type ButtonRow = BroadcastButton[];

interface BroadcastItem {
    id: number;
    kind: Kind;
    title: string;
    body: string | null;
    image_url: string | null;
    meta: string | null;
    is_active: boolean;
    created_at: number;
    author: string | null;
}

const DEFAULT_BG_NOTIF = 'linear-gradient(90deg, #6d28d9, #8b5cf6)';
const DEFAULT_BG_BANNER = '';
const DEFAULT_TEXT = '#ffffff';
const DEFAULT_BTN_COLOR = '#8b5cf6';

export function BroadcastsPage() {
    const [items, setItems] = useState<BroadcastItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { void refresh(); }, []);

    async function refresh() {
        setLoading(true);
        try {
            const res = await api.get<{ ok: true; items: BroadcastItem[] }>('/admin/broadcasts');
            setItems(res.items);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setLoading(false);
        }
    }

    async function deactivate(id: number) {
        if (!confirm('Скрыть эту рассылку?')) return;
        try {
            await api.delete(`/admin/broadcasts/${id}`);
            setFlash({ kind: 'success', text: 'Скрыта' });
            await refresh();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Рассылка</h1>
                <p className="text-white/40 mt-1">Полная кастомизация: цвета, размеры, видео, ряды кнопок. Активна только одна каждого вида.</p>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            <CreateBroadcast
                onCreated={() => { setFlash({ kind: 'success', text: 'Опубликовано' }); void refresh(); }}
                onError={(t) => setFlash({ kind: 'error', text: t })}
            />

            <Card title="Активные и недавние" description="Последние 100 рассылок">
                {loading ? (
                    <p className="text-white/40">Загружаем…</p>
                ) : items.length === 0 ? (
                    <p className="text-white/40 text-sm">Пока пусто.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {items.map((it) => (
                            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                                <span className="text-lg shrink-0">{it.kind === 'banner' ? '🪧' : '🔔'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{it.title}</div>
                                    <div className="text-xs text-white/40">
                                        {formatTs(it.created_at)} · {it.author || '—'} · {it.is_active ? <span className="text-emerald-400">активна</span> : 'скрыта'}
                                    </div>
                                </div>
                                {it.is_active && (
                                    <Button variant="danger" size="sm" onClick={() => deactivate(it.id)}>Скрыть</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

function CreateBroadcast({ onCreated, onError }: { onCreated: () => void; onError: (t: string) => void }) {
    const [kind, setKind] = useState<Kind>('notification');
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [bgHex, setBgHex] = useState<string>('#6d28d9');
    const [bgAlpha, setBgAlpha] = useState<number>(100);
    const [bgGradient, setBgGradient] = useState<string>('');
    const [textColor, setTextColor] = useState<string>(DEFAULT_TEXT);
    const [titleSize, setTitleSize] = useState<number>(0);  // 0 = дефолт (CSS)
    const [bodySize, setBodySize] = useState<number>(0);
    const [imageKey, setImageKey] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [buttonRows, setButtonRows] = useState<ButtonRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState<'image' | 'video' | null>(null);

    const isBanner = kind === 'banner';

    function reset() {
        setTitle(''); setBody('');
        setBgHex('#6d28d9'); setBgAlpha(100); setBgGradient('');
        setTextColor(DEFAULT_TEXT);
        setTitleSize(0); setBodySize(0);
        setImageKey(null); setImageUrl(null); setVideoUrl(null);
        setButtonRows([]);
    }

    function deriveBg(): string {
        if (!isBanner && bgGradient.trim()) return bgGradient.trim();
        if (bgAlpha === 0) return '';
        if (bgAlpha === 100) return bgHex;
        const r = parseInt(bgHex.slice(1, 3), 16);
        const g = parseInt(bgHex.slice(3, 5), 16);
        const b = parseInt(bgHex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${(bgAlpha / 100).toFixed(2)})`;
    }
    const bg = deriveBg();

    async function uploadImage(file: File) {
        setUploading('image');
        try {
            const fd = new FormData();
            fd.append('kind', 'image');
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setImageKey(res.key);
            setImageUrl(res.url);
        } catch (err) {
            onError(err instanceof ApiException ? err.message : 'Ошибка загрузки картинки');
        } finally {
            setUploading(null);
        }
    }

    async function uploadVideo(file: File) {
        setUploading('video');
        try {
            const fd = new FormData();
            fd.append('kind', 'video');
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setVideoUrl(res.url);
        } catch (err) {
            onError(err instanceof ApiException ? err.message : 'Ошибка загрузки видео');
        } finally {
            setUploading(null);
        }
    }

    function buildMeta(): string | null {
        const meta: Record<string, unknown> = {};
        if (bg.trim())              meta.bg = bg.trim();
        if (textColor !== DEFAULT_TEXT) meta.color = textColor;
        if (titleSize > 0)          meta.title_size = titleSize;
        if (bodySize > 0)           meta.body_size = bodySize;
        if (videoUrl)               meta.video_url = videoUrl;

        if (isBanner) {
            const cleanRows = buttonRows
                .map((row) => row.filter((b) => b.label.trim()))
                .filter((row) => row.length > 0);
            if (cleanRows.length > 0) meta.buttonRows = cleanRows;
        }

        return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
    }

    async function submit() {
        if (!title.trim()) return onError('Введите заголовок');
        setBusy(true);
        try {
            await api.post('/admin/broadcasts', {
                kind,
                title: title.trim(),
                body:      isBanner ? (body.trim() || null) : null,
                image_key: isBanner && !videoUrl ? imageKey : null,
                meta: buildMeta(),
            });
            reset();
            onCreated();
        } catch (err) {
            onError(err instanceof ApiException ? err.message : 'Ошибка');
        } finally {
            setBusy(false);
        }
    }

    function addRow() {
        setButtonRows([...buttonRows, [{ label: '', url: '', color: DEFAULT_BTN_COLOR, text_color: '#ffffff' }]]);
    }

    function addButtonToRow(ri: number) {
        const row = buttonRows[ri];
        if (!row || row.length >= 3) return;
        const next = [...buttonRows];
        next[ri] = [...row, { label: '', url: '', color: DEFAULT_BTN_COLOR, text_color: '#ffffff' }];
        setButtonRows(next);
    }

    function updateButton(ri: number, bi: number, patch: Partial<BroadcastButton>) {
        const next = buttonRows.map((row, i) => i !== ri ? row : row.map((b, j) => j !== bi ? b : { ...b, ...patch }));
        setButtonRows(next);
    }

    function removeButton(ri: number, bi: number) {
        const next = buttonRows
            .map((row, i) => i !== ri ? row : row.filter((_, j) => j !== bi))
            .filter((row) => row.length > 0);
        setButtonRows(next);
    }

    return (
        <Card title="Новая рассылка">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <Field label="Тип">
                        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                            <option value="notification">Верхняя плашка (только заголовок)</option>
                            <option value="banner">Баннер (заголовок + текст + видео/картинка + ряды кнопок)</option>
                        </Select>
                    </Field>

                    <Field label="Заголовок">
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={isBanner ? 200 : 80} placeholder="Заголовок" />
                    </Field>

                    <Field label="Цвет фона и текста">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 flex-1">
                                    <input
                                        type="color"
                                        value={bgHex}
                                        onChange={(e) => setBgHex(e.target.value)}
                                        className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                                        title="Цвет фона"
                                    />
                                    <input
                                        type="range"
                                        min={0} max={100} value={bgAlpha}
                                        onChange={(e) => setBgAlpha(Number(e.target.value))}
                                        className="flex-1 accent-violet-500"
                                        title="Прозрачность фона"
                                    />
                                    <span className="text-xs text-white/40 w-8 text-right tabular-nums shrink-0">{bgAlpha}%</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-white/40">текст</span>
                                    <input
                                        type="color"
                                        value={textColor}
                                        onChange={(e) => setTextColor(e.target.value)}
                                        className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer"
                                        title="Цвет текста"
                                    />
                                </div>
                            </div>
                            {!isBanner && (
                                <Input
                                    value={bgGradient}
                                    onChange={(e) => setBgGradient(e.target.value)}
                                    placeholder="или CSS градиент: linear-gradient(…)"
                                />
                            )}
                        </div>
                    </Field>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Размер заголовка (px)" hint="0 = дефолт">
                            <Input type="number" min={0} max={64} value={titleSize || ''} onChange={(e) => setTitleSize(Number(e.target.value) || 0)} placeholder="0" />
                        </Field>
                        {isBanner && (
                            <Field label="Размер текста (px)" hint="0 = дефолт">
                                <Input type="number" min={0} max={32} value={bodySize || ''} onChange={(e) => setBodySize(Number(e.target.value) || 0)} placeholder="0" />
                            </Field>
                        )}
                    </div>

                    {isBanner && (
                        <>
                            <Field label="Текст" hint="Markdown: *курсив*, **жирный**, `код`. Пустая строка — новый параграф.">
                                <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
                            </Field>

                            <Field label="Видео (приоритетнее картинки)">
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadVideo(f); e.target.value = ''; }}
                                    className="block w-full text-sm text-white/70 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent file:font-medium hover:file:bg-accent/25 file:cursor-pointer"
                                />
                                {uploading === 'video' && <span className="text-xs text-white/40 mt-1 block">Загружаем видео…</span>}
                                {videoUrl && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <video src={videoUrl} className="h-20 rounded-lg border border-white/10" muted />
                                        <Button variant="ghost" size="sm" onClick={() => setVideoUrl(null)}>× убрать</Button>
                                    </div>
                                )}
                            </Field>

                            {!videoUrl && (
                                <Field label="Картинка (если без видео)">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }}
                                        className="block w-full text-sm text-white/70 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent file:font-medium hover:file:bg-accent/25 file:cursor-pointer"
                                    />
                                    {uploading === 'image' && <span className="text-xs text-white/40 mt-1 block">Загружаем…</span>}
                                    {imageUrl && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <img src={imageUrl} alt="" className="h-16 rounded-lg border border-white/10" />
                                            <Button variant="ghost" size="sm" onClick={() => { setImageKey(null); setImageUrl(null); }}>× убрать</Button>
                                        </div>
                                    )}
                                </Field>
                            )}

                            <Field label="Ряды кнопок" hint="В ряду до 3 кнопок — делят ширину поровну.">
                                <div className="space-y-3">
                                    {buttonRows.map((row, ri) => (
                                        <div key={ri} className="rounded-lg border border-white/[0.06] p-2 space-y-2">
                                            {row.map((b, bi) => (
                                                <div key={bi} className="flex gap-2 items-start">
                                                    <Input value={b.label} onChange={(e) => updateButton(ri, bi, { label: e.target.value })} placeholder="Текст" />
                                                    <Input value={b.url}   onChange={(e) => updateButton(ri, bi, { url:   e.target.value })} placeholder="https://…" />
                                                    <input type="color" value={b.color}      onChange={(e) => updateButton(ri, bi, { color:      e.target.value })} className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer" title="Фон" />
                                                    <input type="color" value={b.text_color} onChange={(e) => updateButton(ri, bi, { text_color: e.target.value })} className="w-10 h-10 shrink-0 rounded-lg border border-white/10 bg-transparent cursor-pointer" title="Текст" />
                                                    <Button variant="danger" size="sm" onClick={() => removeButton(ri, bi)}>×</Button>
                                                </div>
                                            ))}
                                            {row.length < 3 && (
                                                <Button variant="ghost" size="sm" onClick={() => addButtonToRow(ri)}>+ Кнопка в ряд</Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button variant="secondary" size="sm" onClick={addRow}>+ Новый ряд</Button>
                                </div>
                            </Field>
                        </>
                    )}

                    <Button onClick={submit} disabled={busy || !title.trim()}>
                        {busy ? 'Публикуем…' : 'Опубликовать'}
                    </Button>
                </div>

                <div>
                    <div className="text-xs uppercase tracking-wide text-white/40 mb-2">Предпросмотр</div>
                    <PreviewPane
                        kind={kind}
                        title={title}
                        body={body}
                        bg={bg}
                        color={textColor}
                        titleSize={titleSize}
                        bodySize={bodySize}
                        imageUrl={imageUrl}
                        videoUrl={videoUrl}
                        buttonRows={buttonRows}
                    />
                </div>
            </div>
        </Card>
    );
}

interface PreviewProps {
    kind: Kind;
    title: string;
    body: string;
    bg: string;
    color: string;
    titleSize: number;
    bodySize: number;
    imageUrl: string | null;
    videoUrl: string | null;
    buttonRows: ButtonRow[];
}

function PreviewPane({ kind, title, body, bg, color, titleSize, bodySize, imageUrl, videoUrl, buttonRows }: PreviewProps) {
    const displayTitle = title || '(заголовок)';

    if (kind === 'notification') {
        return (
            <div
                className="rounded-xl px-4 py-3 text-center font-semibold"
                style={{
                    background: bg || DEFAULT_BG_NOTIF,
                    color: color || DEFAULT_TEXT,
                    fontSize: titleSize > 0 ? titleSize : 14,
                }}
            >
                {displayTitle}
            </div>
        );
    }

    return (
        <div
            className="rounded-2xl border border-white/[0.08] p-5"
            style={{
                background: bg || 'rgba(255,255,255,0.03)',
                color: color || DEFAULT_TEXT,
            }}
        >
            {videoUrl ? (
                <video src={videoUrl} controls className="w-full max-h-40 rounded-lg mb-3 bg-black" />
            ) : imageUrl ? (
                <img src={imageUrl} alt="" className="w-full max-h-40 object-contain rounded-lg mb-3" />
            ) : null}

            <h3 className="font-bold mb-2" style={{ fontSize: titleSize > 0 ? titleSize : 16 }}>{displayTitle}</h3>

            {body && (
                <div className="space-y-2 opacity-90 [&_p]:m-0" style={{ fontSize: bodySize > 0 ? bodySize : 14 }}>
                    <Formatted text={body} />
                </div>
            )}

            {buttonRows
                .map((row) => row.filter((b) => b.label.trim()))
                .filter((row) => row.length > 0)
                .map((row, ri) => (
                    <div key={ri} className="flex gap-2 mt-3">
                        {row.map((b, bi) => (
                            <span
                                key={bi}
                                className="flex-1 text-center py-2.5 px-3 rounded-lg text-sm font-bold"
                                style={{ background: b.color, color: b.text_color }}
                            >
                                {b.label}
                            </span>
                        ))}
                    </div>
                ))}
        </div>
    );
}

// suppress unused warning
void DEFAULT_BG_BANNER;

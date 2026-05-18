import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { toAbsoluteAsset } from '@/lib/assets';
import { Card, Button, Field, Input, Flash } from '../ui';

interface AdminTrack {
    id: number;
    album_id: number;
    title: string;
    artist: string;
    duration: string;
    audio_key: string | null;
    audio_url: string | null;
    lrc: string | null;
    sort_order: number;
}

interface AdminAlbum {
    id: number;
    title: string;
    year: string;
    cover_key: string | null;
    cover_url: string | null;
    cover: string | null;
    sort_order: number;
    tracks: AdminTrack[];
}

export function AlbumsPage() {
    const [albums, setAlbums] = useState<AdminAlbum[] | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => { void refresh(); }, []);

    async function refresh(keepSelected: number | null = selectedId) {
        try {
            const res = await api.get<{ ok: true; albums: AdminAlbum[] }>('/admin/content/albums');
            const normalized = res.albums.map((a) => ({
                ...a,
                cover: toAbsoluteAsset(a.cover ?? a.cover_url),
                cover_url: toAbsoluteAsset(a.cover_url ?? a.cover),
                tracks: a.tracks.map((t) => ({
                    ...t,
                    audio_url: toAbsoluteAsset(t.audio_url),
                })),
            }));
            setAlbums(normalized);
            if (keepSelected && !normalized.find((a) => a.id === keepSelected)) setSelectedId(null);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    const selected = albums?.find((a) => a.id === selectedId) ?? null;

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Альбомы и треки</h1>
                <p className="text-white/40 mt-1">Слева — список альбомов, справа — карточка с треками.</p>
            </header>

            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
                <AlbumList
                    albums={albums}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onCreated={async (id) => { setSelectedId(id); await refresh(id); }}
                    onError={(t) => setFlash({ kind: 'error', text: t })}
                />

                <div>
                    {selected ? (
                        <AlbumEditor
                            album={selected}
                            onChange={() => refresh(selected.id)}
                            onDelete={async () => { setSelectedId(null); await refresh(null); }}
                            setFlash={setFlash}
                        />
                    ) : (
                        <Card>
                            <p className="text-white/40 text-sm text-center py-10">Выбери альбом слева или создай новый.</p>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

interface ListProps {
    albums: AdminAlbum[] | null;
    selectedId: number | null;
    onSelect: (id: number) => void;
    onCreated: (id: number) => void;
    onError: (text: string) => void;
}

function AlbumList({ albums, selectedId, onSelect, onCreated, onError }: ListProps) {
    async function create() {
        const title = prompt('Название нового альбома:');
        if (!title?.trim()) return;
        const year = prompt('Год:');
        if (!year?.trim()) return;
        try {
            const res = await api.post<{ ok: true; id: number }>('/admin/content/albums', {
                title: title.trim(),
                year: year.trim(),
                sort_order: (albums?.length ?? 0),
            });
            onCreated(res.id);
        } catch (err) {
            onError(err instanceof ApiException ? err.message : 'Ошибка создания');
        }
    }

    return (
        <Card
            title="Альбомы"
            actions={<Button size="sm" onClick={create}>+ Новый</Button>}
        >
            {albums === null ? (
                <p className="text-white/40">Загружаем…</p>
            ) : albums.length === 0 ? (
                <p className="text-white/40 text-sm">Альбомов нет.</p>
            ) : (
                <ul className="flex flex-col gap-1.5">
                    {albums.map((a) => (
                        <li key={a.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(a.id)}
                                className={`appearance-none cursor-pointer w-full flex items-center gap-3 rounded-xl p-2 text-left text-white font-sans transition border ${
                                    selectedId === a.id
                                        ? 'bg-accent/15 border-accent/30'
                                        : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]'
                                }`}
                            >
                                {a.cover ? (
                                    <img src={a.cover} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-white/[0.05] flex items-center justify-center text-white/30 shrink-0">♪</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{a.title}</div>
                                    <div className="text-xs text-white/40">{a.year} · {a.tracks.length} тр.</div>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

interface EditorProps {
    album: AdminAlbum;
    onChange: () => Promise<void>;
    onDelete: () => Promise<void>;
    setFlash: (f: { kind: 'success' | 'error'; text: string }) => void;
}

function AlbumEditor({ album, onChange, onDelete, setFlash }: EditorProps) {
    const [title, setTitle] = useState(album.title);
    const [year, setYear] = useState(album.year);
    const [coverKey, setCoverKey] = useState<string | null>(album.cover_key);
    const [coverUrl, setCoverUrl] = useState<string | null>(album.cover ?? album.cover_url);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setTitle(album.title); setYear(album.year);
        setCoverKey(album.cover_key); setCoverUrl(album.cover ?? album.cover_url);
    }, [album.id, album.title, album.year, album.cover_key, album.cover, album.cover_url]);

    async function save() {
        setBusy(true);
        try {
            await api.put(`/admin/content/albums/${album.id}`, {
                title: title.trim(),
                year: year.trim(),
                cover_key: coverKey,
                sort_order: album.sort_order,
            });
            setFlash({ kind: 'success', text: 'Альбом сохранён' });
            await onChange();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally { setBusy(false); }
    }

    async function uploadCover(file: File) {
        try {
            const fd = new FormData();
            fd.append('kind', 'cover');
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setCoverKey(res.key);
            setCoverUrl(res.url);
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка загрузки' });
        }
    }

    async function removeAlbum() {
        if (!confirm(`Удалить альбом «${album.title}» и все его треки?`)) return;
        try {
            await api.delete(`/admin/content/albums/${album.id}`);
            await onDelete();
            setFlash({ kind: 'success', text: 'Удалено' });
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    return (
        <div className="space-y-6">
            <Card title="Альбом">
                <div className="grid grid-cols-[auto_1fr] gap-4">
                    <label className="cursor-pointer block">
                        {coverUrl ? (
                            <img src={coverUrl} alt="" className="w-32 h-32 rounded-xl object-cover border border-white/10" />
                        ) : (
                            <div className="w-32 h-32 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/30 text-sm">Обложка</div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadCover(f); e.target.value = ''; }}
                        />
                    </label>
                    <div className="space-y-3">
                        <Field label="Название"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
                        <Field label="Год"><Input value={year} onChange={(e) => setYear(e.target.value)} maxLength={16} /></Field>
                        <div className="flex gap-2">
                            <Button onClick={save} disabled={busy || !title.trim() || !year.trim()}>
                                {busy ? 'Сохраняем…' : 'Сохранить'}
                            </Button>
                            <Button variant="danger" onClick={removeAlbum}>Удалить альбом</Button>
                        </div>
                    </div>
                </div>
            </Card>

            <TracksEditor album={album} onChange={onChange} setFlash={setFlash} />
        </div>
    );
}

interface TracksEditorProps {
    album: AdminAlbum;
    onChange: () => Promise<void>;
    setFlash: (f: { kind: 'success' | 'error'; text: string }) => void;
}

function TracksEditor({ album, onChange, setFlash }: TracksEditorProps) {
    const [editingId, setEditingId] = useState<number | 'new' | null>(null);

    async function remove(t: AdminTrack) {
        if (!confirm(`Удалить «${t.title}»?`)) return;
        try {
            await api.delete(`/admin/content/tracks/${t.id}`);
            setFlash({ kind: 'success', text: 'Трек удалён' });
            await onChange();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        }
    }

    return (
        <Card
            title="Треки"
            actions={
                <Button size="sm" onClick={() => setEditingId('new')} disabled={editingId === 'new'}>
                    + Новый трек
                </Button>
            }
        >
            {album.tracks.length === 0 && editingId !== 'new' && (
                <p className="text-white/40 text-sm">Треков пока нет.</p>
            )}

            <ul className="space-y-2">
                {album.tracks.map((t, idx) => (
                    <li key={t.id}>
                        <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                            <span className="w-6 text-center text-white/40 text-sm shrink-0">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{t.title}</div>
                                <div className="text-xs text-white/40">{t.artist} · {t.duration}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setEditingId(editingId === t.id ? null : t.id)}>
                                {editingId === t.id ? 'Закрыть' : 'Изменить'}
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => remove(t)}>×</Button>
                        </div>
                        {editingId === t.id && (
                            <div className="mt-2 ml-9">
                                <TrackForm
                                    album={album}
                                    track={t}
                                    onClose={() => setEditingId(null)}
                                    onSaved={async () => { setEditingId(null); await onChange(); }}
                                    setFlash={setFlash}
                                />
                            </div>
                        )}
                    </li>
                ))}
            </ul>

            {editingId === 'new' && (
                <div className="mt-4">
                    <TrackForm
                        album={album}
                        track={null}
                        onClose={() => setEditingId(null)}
                        onSaved={async () => { setEditingId(null); await onChange(); }}
                        setFlash={setFlash}
                    />
                </div>
            )}
        </Card>
    );
}

interface TrackFormProps {
    album: AdminAlbum;
    track: AdminTrack | null;
    onClose: () => void;
    onSaved: () => Promise<void>;
    setFlash: (f: { kind: 'success' | 'error'; text: string }) => void;
}

function TrackForm({ album, track, onClose, onSaved, setFlash }: TrackFormProps) {
    const [title, setTitle] = useState(track?.title ?? '');
    const [artist, setArtist] = useState(track?.artist ?? 'CUPSIZE');
    const [duration, setDuration] = useState(track?.duration ?? '');
    const [audioKey, setAudioKey] = useState<string | null | undefined>(track?.audio_key ?? undefined);
    const [audioUrl, setAudioUrl] = useState<string | null>(track?.audio_url ?? null);
    const [lrc, setLrc] = useState<string | null | undefined>(track?.lrc ?? undefined);
    const [lrcName, setLrcName] = useState<string | null>(track?.lrc ? 'текст в БД' : null);
    const [busy, setBusy] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);

    // Если в БД нет LRC, но есть бандленый /lyrics/<id>.lrc — отображаем это
    useEffect(() => {
        if (!track || track.lrc) return;
        let cancelled = false;
        fetch(`/lyrics/${track.id}.lrc`, { method: 'HEAD' })
            .then((r) => { if (!cancelled && r.ok) setLrcName('встроенный текст (не в БД)'); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [track]);

    async function uploadAudio(file: File) {
        setUploadingAudio(true);
        try {
            const dur = await readAudioDuration(file);
            if (dur) setDuration(dur);
            const fd = new FormData();
            fd.append('kind', 'audio');
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setAudioKey(res.key);
            setAudioUrl(toAbsoluteAsset(res.url));
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка загрузки аудио' });
        } finally {
            setUploadingAudio(false);
        }
    }

    async function uploadLrc(file: File) {
        try {
            setLrc(await file.text());
            setLrcName(`${file.name} (после сохранения трека пойдёт в БД)`);
        } catch {
            setFlash({ kind: 'error', text: 'Не удалось прочитать LRC' });
        }
    }

    async function save() {
        if (!title.trim()) { setFlash({ kind: 'error', text: 'Название обязательно' }); return; }
        if (uploadingAudio) { setFlash({ kind: 'error', text: 'Дождитесь окончания загрузки' }); return; }
        if (!audioKey && !track?.audio_key) { setFlash({ kind: 'error', text: 'Загрузите аудио' }); return; }
        if (!duration) { setFlash({ kind: 'error', text: 'Длительность не определена' }); return; }

        setBusy(true);
        try {
            const payload = {
                album_id: album.id,
                title: title.trim(),
                artist: artist.trim() || 'CUPSIZE',
                duration,
                audio_key: audioKey,
                lrc,
                sort_order: track?.sort_order ?? album.tracks.length,
            };
            if (track) await api.put(`/admin/content/tracks/${track.id}`, payload);
            else       await api.post('/admin/content/tracks', payload);
            setFlash({ kind: 'success', text: track ? 'Трек сохранён' : 'Трек добавлен' });
            await onSaved();
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-xl border border-accent/20 bg-accent/[0.04] p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3">
                <Field label="Название"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
                <Field label="Исполнитель"><Input value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} /></Field>
                <Field label="Длительность" hint="из аудио"><Input value={duration} readOnly className="bg-white/[0.02]" /></Field>
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm shrink-0">
                        <span className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">{audioUrl ? 'Заменить аудио' : 'Загрузить аудио'}</span>
                        <input type="file" accept="audio/*" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAudio(f); e.target.value = ''; }}
                        />
                    </label>
                    {uploadingAudio && <span className="text-white/40 text-xs">Загружаем…</span>}
                </div>
                {audioUrl && !uploadingAudio && (
                    <audio
                        controls
                        src={audioUrl}
                        className="w-full h-10"
                        style={{ colorScheme: 'dark' }}
                    />
                )}

                <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm shrink-0">
                        <span className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15">{lrcName ? 'Заменить текст' : 'Загрузить текст'}</span>
                        <input type="file" accept=".lrc,text/plain" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLrc(f); e.target.value = ''; }}
                        />
                    </label>
                    <span className="text-white/40 text-xs">{lrcName ?? 'нет текста'}</span>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
                <Button size="sm" onClick={save} disabled={busy || uploadingAudio}>
                    {busy ? 'Сохраняем…' : (track ? 'Сохранить' : 'Добавить')}
                </Button>
            </div>
        </div>
    );
}

function readAudioDuration(file: File): Promise<string> {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        const url = URL.createObjectURL(file);
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            const sec = audio.duration;
            if (!Number.isFinite(sec)) return resolve('');
            const m = Math.floor(sec / 60);
            const s = Math.round(sec % 60);
            resolve(`${m}:${String(s).padStart(2, '0')}`);
        };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
        audio.src = url;
    });
}

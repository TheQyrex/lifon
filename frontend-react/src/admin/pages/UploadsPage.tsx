import { useRef, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { Card, Button, Field, Select, Flash } from '../ui';

type UploadKind = 'image' | 'cover' | 'audio' | 'video' | 'avatar' | 'lrc';

const KIND_LABELS: Record<UploadKind, string> = {
    image:  'Картинка (для баннеров)',
    cover:  'Обложка альбома',
    audio:  'Аудио',
    video:  'Видео',
    avatar: 'Аватарка',
    lrc:    'LRC-файл',
};

interface UploadResult {
    key: string;
    url: string;
}

export function UploadsPage() {
    const [kind, setKind] = useState<UploadKind>('image');
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file) {
            setError('Выберите файл');
            return;
        }
        setBusy(true);
        setError(null);
        setResult(null);
        try {
            const fd = new FormData();
            fd.append('kind', kind);
            fd.append('file', file);
            const res = await api.upload<{ ok: true; key: string; url: string }>('/admin/uploads', fd);
            setResult({ key: res.key, url: res.url });
        } catch (err) {
            setError(err instanceof ApiException ? err.message : 'Ошибка загрузки');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Файлы</h1>
                <p className="text-white/40 mt-1">Прямая загрузка в R2. Возвращает <code className="px-1 rounded bg-white/10 text-xs">key</code> + публичный URL.</p>
            </header>

            <Card>
                <form className="space-y-4" onSubmit={submit}>
                    <Field label="Тип файла">
                        <Select value={kind} onChange={(e) => setKind(e.target.value as UploadKind)}>
                            {(Object.keys(KIND_LABELS) as UploadKind[]).map((k) => (
                                <option key={k} value={k}>{KIND_LABELS[k]}</option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Файл">
                        <input
                            ref={fileRef}
                            type="file"
                            className="block w-full text-sm text-white/70 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-accent/15 file:text-accent file:font-medium hover:file:bg-accent/25 file:cursor-pointer"
                        />
                    </Field>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={busy}>
                            {busy ? 'Загружаем…' : 'Загрузить'}
                        </Button>
                        {error && <Flash kind="error">{error}</Flash>}
                    </div>
                </form>

                {result && (
                    <div className="mt-6 space-y-3">
                        <Flash kind="success">Готово</Flash>
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2 font-mono text-xs">
                            <div><span className="text-white/40">key:</span> <span className="text-accent break-all">{result.key}</span></div>
                            <div><span className="text-white/40">url:</span> <a className="text-accent hover:underline break-all" href={result.url} target="_blank" rel="noopener">{result.url}</a></div>
                        </div>
                        {kind !== 'audio' && kind !== 'lrc' && (
                            <img src={result.url} alt="" className="max-w-xs rounded-xl border border-white/10" />
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

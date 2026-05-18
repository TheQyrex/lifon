import { useEffect, useState } from 'react';
import { api, ApiException } from '@/lib/api';
import { Card, Button, Field, Input, Flash } from '../ui';

interface MaintenanceState {
    enabled: boolean;
    message: string;
}

const DEFAULT_MSG = 'Сайт находится на технических работах';

export function MaintenancePage() {
    const [enabled, setEnabled] = useState(false);
    const [message, setMessage] = useState(DEFAULT_MSG);
    const [busy, setBusy] = useState(false);
    const [flash, setFlash] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get<{ ok: true; maintenance: MaintenanceState }>('/admin/maintenance')
            .then((res) => {
                setEnabled(res.maintenance.enabled);
                setMessage(res.maintenance.message);
            })
            .catch((err) => setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' }))
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        setBusy(true);
        setFlash(null);
        try {
            const res = await api.put<{ ok: true; maintenance: MaintenanceState }>('/admin/maintenance', {
                enabled,
                message: message.trim() || DEFAULT_MSG,
            });
            setEnabled(res.maintenance.enabled);
            setMessage(res.maintenance.message);
            setFlash({ kind: 'success', text: res.maintenance.enabled ? 'Техработы включены' : 'Техработы выключены' });
        } catch (err) {
            setFlash({ kind: 'error', text: err instanceof ApiException ? err.message : 'Ошибка' });
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-bold tracking-tight">Технические работы</h1>
                <p className="text-white/40 mt-1">Когда режим включён, обычные юзеры видят заглушку и не могут пользоваться сайтом. Админы заходят как обычно.</p>
            </header>

            <Card>
                {loading ? (
                    <p className="text-white/40">Загружаем…</p>
                ) : (
                    <div className="space-y-5">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-1 w-5 h-5 rounded accent-accent"
                                checked={enabled}
                                onChange={(e) => setEnabled(e.target.checked)}
                            />
                            <div>
                                <div className="font-semibold">Закрыть сайт для всех, кроме админов</div>
                                <div className="text-sm text-white/40 mt-0.5">
                                    Все API-запросы не-админов получают 503, сайт показывает плашку.
                                </div>
                            </div>
                        </label>

                        <Field label="Текст плашки" hint={`По умолчанию: «${DEFAULT_MSG}»`}>
                            <Input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={240}
                                placeholder={DEFAULT_MSG}
                            />
                        </Field>

                        <div className="flex items-center gap-3">
                            <Button onClick={save} disabled={busy}>
                                {busy ? 'Сохраняем…' : 'Сохранить режим'}
                            </Button>
                            {flash && <Flash kind={flash.kind}>{flash.text}</Flash>}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}

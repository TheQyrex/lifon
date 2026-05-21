import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/store/auth';
import { ApiException } from '@/lib/api';
import type { TelegramAuthData } from '@/types/api';

const TG_BOT = 'lifonmusic_auth_bot';

export function LinkTelegramScreen() {
    const { linkTelegram, logout } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const tgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        (window as any).onTelegramLink = async (tgUser: TelegramAuthData) => {
            setError(null);
            setBusy(true);
            try {
                await linkTelegram(tgUser);
            } catch (err) {
                if (err instanceof ApiException) setError(err.message);
                else if (err instanceof Error) setError(err.message);
                else setError('Ошибка привязки Telegram');
            } finally {
                setBusy(false);
            }
        };

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TG_BOT);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '20');
        script.setAttribute('data-onauth', 'onTelegramLink(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        tgRef.current?.appendChild(script);

        return () => {
            script.remove();
            delete (window as any).onTelegramLink;
        };
    }, []);

    return (
        <div className="auth-screen">
            <div className="auth-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                <h1>Привяжи Telegram</h1>
                <p className="auth-subtitle" style={{ textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 280, margin: '0 auto 8px' }}>
                    Для доступа к сервису необходимо привязать аккаунт Telegram
                </p>

                <div className="auth-form">
                    {busy && <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Привязываем…</p>}
                    {error && <p className="auth-error">{error}</p>}

                    <div ref={tgRef} className="tg-btn-wrapper" />

                    <span
                        className="auth-link"
                        style={{ textAlign: 'center', fontSize: 13 }}
                        onClick={() => logout()}
                    >
                        Выйти из аккаунта
                    </span>
                </div>
            </div>
        </div>
    );
}

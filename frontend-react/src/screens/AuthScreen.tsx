import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { ApiException } from '@/lib/api';
import type { TelegramAuthData } from '@/types/api';

const TG_BOT = 'lifonmusic_auth_bot';

export function AuthScreen() {
    const { login, loginWithTelegram } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const tgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        (window as any).onTelegramAuth = async (tgUser: TelegramAuthData) => {
            setError(null);
            setBusy(true);
            try {
                await loginWithTelegram(tgUser);
            } catch (err) {
                if (err instanceof ApiException) setError(err.message);
                else if (err instanceof Error) setError(err.message);
                else setError('Ошибка входа через Telegram');
            } finally {
                setBusy(false);
            }
        };

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', TG_BOT);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '20');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        tgRef.current?.appendChild(script);

        return () => {
            script.remove();
            delete (window as any).onTelegramAuth;
        };
    }, []);

    async function submitPassword() {
        setError(null);
        if (!username || !password) { setError('Заполни все поля'); return; }
        setBusy(true);
        try {
            await login(username, password);
        } catch (err) {
            if (err instanceof ApiException) setError(err.message);
            else if (err instanceof Error) setError(err.message);
            else setError('Неизвестная ошибка');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-screen">
            <div className="auth-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                <h1>Войти</h1>
                <p className="auth-subtitle">LifonMUSIC</p>

                <div className="auth-form">
                    {error && <p className="auth-error">{error}</p>}

                    <div ref={tgRef} className="tg-btn-wrapper" />

                    {!showPassword ? (
                        <span
                            className="auth-link"
                            style={{ textAlign: 'center', fontSize: 13 }}
                            onClick={() => { setShowPassword(true); setError(null); }}
                        >
                            Войти с паролем
                        </span>
                    ) : (
                        <>
                            <input
                                type="text"
                                placeholder="Имя пользователя"
                                autoComplete="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Пароль"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
                            />
                            <button className="btn-primary" type="button" onClick={submitPassword} disabled={busy}>
                                {busy ? '...' : 'Войти'}
                            </button>
                            <span
                                className="auth-link"
                                style={{ textAlign: 'center', fontSize: 13 }}
                                onClick={() => { setShowPassword(false); setError(null); }}
                            >
                                ← Назад
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

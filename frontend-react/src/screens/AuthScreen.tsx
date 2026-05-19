import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { ApiException } from '@/lib/api';
import type { TelegramAuthData } from '@/types/api';

const TG_BOT = 'lifonmusic_auth_bot';

export function AuthScreen() {
    const { login, register, loginWithTelegram } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
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
    }, []); // loginWithTelegram is a stable zustand action

    async function submit() {
        setError(null);
        if (!username || !password) {
            setError('Заполни все поля');
            return;
        }
        setBusy(true);
        try {
            if (mode === 'login') await login(username, password);
            else await register(username, password);
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
                <h1>{mode === 'login' ? 'Войти' : 'Регистрация'}</h1>
                <p className="auth-subtitle">LifonMUSIC</p>

                <div className="auth-form">
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
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                    />
                    {error && <p className="auth-error">{error}</p>}

                    <button className="btn-primary" type="button" onClick={submit} disabled={busy}>
                        {busy ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                    </button>

                    <div className="auth-divider"><span>или</span></div>

                    <div ref={tgRef} className="tg-btn-wrapper" />

                    <div className="auth-switch">
                        <span>{mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}</span>
                        <span
                            className="auth-link"
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                        >
                            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

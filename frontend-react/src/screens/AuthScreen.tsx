import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { ApiException } from '@/lib/api';
import type { TelegramAuthData } from '@/types/api';

const TG_BOT = 'lifonmusic_auth_bot';

export function AuthScreen() {
    const {
        login, setFirstPassword, cancelPendingUsername, pendingUsername,
        loginWithTelegram, completeTelegramSetup, cancelTelegramSetup, pendingTg,
    } = useAuth();

    const [step, setStep] = useState<'username' | 'password' | 'set_password'>('username');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const tgRef = useRef<HTMLDivElement>(null);

    // Если вернули pendingUsername — нужно задать пароль
    useEffect(() => {
        if (pendingUsername) {
            setStep('set_password');
            setPassword('');
            setConfirm('');
            setError(null);
        }
    }, [pendingUsername]);

    // Когда приходит pendingTg — предзаполняем ник
    useEffect(() => {
        if (pendingTg) {
            setUsername(pendingTg.suggestedUsername);
            setPassword('');
            setError(null);
        }
    }, [pendingTg]);

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

    // Шаг 1: проверяем username
    async function submitUsername() {
        setError(null);
        if (!username.trim()) { setError('Введи имя пользователя'); return; }
        setBusy(true);
        try {
            await login(username.trim());
            // Если needs_password — useEffect поймает pendingUsername и переключит шаг
            // Если нет needs_password — ждём пароль
            setStep('password');
        } catch (err) {
            if (err instanceof ApiException) {
                if (err.error === 'invalid_credentials') setError('Пользователь не найден');
                else if (err.error === 'password_required') setStep('password'); // у юзера уже есть пароль
                else if (err.error === 'telegram_only') setError('Этот аккаунт входит только через Telegram');
                else setError(err.message || 'Ошибка');
            } else {
                setError('Ошибка соединения');
            }
        } finally {
            setBusy(false);
        }
    }

    // Шаг 2a: обычный вход с паролем
    async function submitPassword() {
        setError(null);
        if (!password) { setError('Введи пароль'); return; }
        setBusy(true);
        try {
            await login(username.trim(), password);
        } catch (err) {
            if (err instanceof ApiException) {
                if (err.error === 'invalid_credentials') setError('Неверный пароль');
                else if (err.error === 'account_locked') setError('Слишком много попыток. Подожди немного.');
                else setError(err.message);
            } else {
                setError('Ошибка соединения');
            }
        } finally {
            setBusy(false);
        }
    }

    // Шаг 2b: первичная установка пароля
    async function submitSetPassword() {
        setError(null);
        if (password.length < 8) { setError('Пароль слишком короткий (минимум 8 символов)'); return; }
        if (password !== confirm) { setError('Пароли не совпадают'); return; }
        setBusy(true);
        try {
            await setFirstPassword(password);
        } catch (err) {
            if (err instanceof ApiException) setError(err.message);
            else if (err instanceof Error) setError(err.message);
            else setError('Неизвестная ошибка');
        } finally {
            setBusy(false);
        }
    }

    // Создание аккаунта через Telegram (шаг 2 TG)
    async function submitTgSetup() {
        setError(null);
        if (!username) { setError('Введи имя пользователя'); return; }
        if (!password) { setError('Введи пароль'); return; }
        setBusy(true);
        try {
            await completeTelegramSetup(username, password);
        } catch (err) {
            if (err instanceof ApiException) setError(err.message);
            else if (err instanceof Error) setError(err.message);
            else setError('Неизвестная ошибка');
        } finally {
            setBusy(false);
        }
    }

    // ── Telegram setup (новый аккаунт через TG) ──────────────────────────────
    if (pendingTg) {
        return (
            <div className="auth-screen">
                <div className="auth-content">
                    <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                    <h1>Создай аккаунт</h1>
                    <p className="auth-subtitle">LifonMUSIC</p>
                    <div className="auth-form">
                        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
                            Выбери ник и придумай пароль
                        </p>
                        <input type="text" placeholder="Имя пользователя" autoComplete="username"
                            value={username} onChange={(e) => setUsername(e.target.value)} />
                        <input type="password" placeholder="Пароль (мин. 12 символов, буква + цифра)" autoComplete="new-password"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitTgSetup(); }} />
                        {error && <p className="auth-error">{error}</p>}
                        <button className="btn-primary" type="button" onClick={submitTgSetup} disabled={busy}>
                            {busy ? '...' : 'Создать аккаунт'}
                        </button>
                        <span className="auth-link" style={{ textAlign: 'center', fontSize: 13 }}
                            onClick={() => { cancelTelegramSetup(); setError(null); }}>
                            ← Назад
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Установка нового пароля (первый вход) ────────────────────────────────
    if (step === 'set_password') {
        return (
            <div className="auth-screen">
                <div className="auth-content">
                    <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                    <h1>Придумай пароль</h1>
                    <p className="auth-subtitle">Привет, {pendingUsername}! Создай пароль для входа</p>
                    <div className="auth-form">
                        <input type="password" placeholder="Новый пароль (мин. 8 символов)" autoComplete="new-password"
                            value={password} onChange={(e) => setPassword(e.target.value)} />
                        <input type="password" placeholder="Повтори пароль" autoComplete="new-password"
                            value={confirm} onChange={(e) => setConfirm(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitSetPassword(); }} />
                        {error && <p className="auth-error">{error}</p>}
                        <button className="btn-primary" type="button" onClick={submitSetPassword} disabled={busy}>
                            {busy ? '...' : 'Сохранить пароль и войти'}
                        </button>
                        <span className="auth-link" style={{ textAlign: 'center', fontSize: 13 }}
                            onClick={() => { cancelPendingUsername(); setStep('username'); setPassword(''); setConfirm(''); setError(null); }}>
                            ← Назад
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Ввод пароля (существующий пользователь) ──────────────────────────────
    if (step === 'password') {
        return (
            <div className="auth-screen">
                <div className="auth-content">
                    <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                    <h1>Войти</h1>
                    <p className="auth-subtitle">LifonMUSIC</p>
                    <div className="auth-form">
                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 4 }}>
                            {username}
                        </p>
                        <input type="password" placeholder="Пароль" autoComplete="current-password"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
                            autoFocus />
                        {error && <p className="auth-error">{error}</p>}
                        <button className="btn-primary" type="button" onClick={submitPassword} disabled={busy}>
                            {busy ? '...' : 'Войти'}
                        </button>
                        <span className="auth-link" style={{ textAlign: 'center', fontSize: 13 }}
                            onClick={() => { setStep('username'); setPassword(''); setError(null); }}>
                            ← Назад
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Шаг 1: Telegram кнопка + поле ника ──────────────────────────────────
    return (
        <div className="auth-screen">
            <div className="auth-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                <h1>Войти</h1>
                <p className="auth-subtitle">LifonMUSIC</p>
                <div className="auth-form">
                    {error && <p className="auth-error">{error}</p>}
                    <div ref={tgRef} className="tg-btn-wrapper" />
                    <input
                        type="text"
                        placeholder="Имя пользователя"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitUsername(); }}
                    />
                    <button className="btn-primary" type="button" onClick={submitUsername} disabled={busy}>
                        {busy ? '...' : 'Продолжить'}
                    </button>
                </div>
            </div>
        </div>
    );
}

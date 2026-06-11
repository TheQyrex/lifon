import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { ApiException } from '@/lib/api';
import type { TelegramAuthData } from '@/types/api';

const TG_BOT = 'lifonmusic_auth_bot';

type Step = 'username' | 'password' | 'set_password' | 'link_telegram';

export function AuthScreen() {
    const {
        login, setFirstPassword, cancelPendingUsername, pendingUsername,
        loginWithTelegram, completeTelegramSetup, cancelTelegramSetup, pendingTg,
        pendingFirstLoginUser, completeFirstLogin, linkTelegram,
    } = useAuth();

    const [step, setStep] = useState<Step>('username');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    // tgRef — контейнер для Telegram-виджета (всегда в DOM, виден только на нужных шагах)
    const tgRef = useRef<HTMLDivElement>(null);
    // Ссылка на текущий обработчик TG-авторизации (меняется в зависимости от шага)
    const tgHandlerRef = useRef<(data: TelegramAuthData) => void>(async () => {});

    // Если вернули pendingUsername — переключаем на шаг установки пароля
    useEffect(() => {
        if (pendingUsername) {
            setStep('set_password');
            setPassword('');
            setConfirm('');
            setError(null);
        }
    }, [pendingUsername]);

    // После первичной установки пароля — переключаем на шаг привязки Telegram
    useEffect(() => {
        if (pendingFirstLoginUser) {
            setStep('link_telegram');
            setBusy(false);
            setError(null);
        }
    }, [pendingFirstLoginUser]);

    // Когда приходит pendingTg — предзаполняем предложенный ник
    useEffect(() => {
        if (pendingTg) {
            setUsername(pendingTg.suggestedUsername);
            setPassword('');
            setError(null);
        }
    }, [pendingTg]);

    // Обновляем TG-обработчик при смене шага
    useEffect(() => {
        if (step === 'link_telegram') {
            tgHandlerRef.current = async (tgUser) => {
                setError(null);
                setBusy(true);
                try {
                    await linkTelegram(tgUser);
                    completeFirstLogin(); // компонент размонтируется — это нормально
                } catch (err) {
                    if (err instanceof ApiException) setError(err.message);
                    else setError('Ошибка привязки Telegram');
                    setBusy(false);
                }
            };
        } else {
            tgHandlerRef.current = async (tgUser) => {
                setError(null);
                setBusy(true);
                try {
                    await loginWithTelegram(tgUser);
                } catch (err) {
                    if (err instanceof ApiException) setError(err.message);
                    else if (err instanceof Error) setError(err.message);
                    else setError('Ошибка входа через Telegram');
                    setBusy(false);
                }
            };
        }
    }, [step, linkTelegram, completeFirstLogin, loginWithTelegram]);

    // Загружаем TG-виджет один раз; onTelegramAuth делегирует актуальному обработчику
    useEffect(() => {
        (window as any).onTelegramAuth = (tgUser: TelegramAuthData) => {
            tgHandlerRef.current(tgUser);
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

    // ── Шаг 1: проверяем username ─────────────────────────────────────────────
    async function submitUsername() {
        setError(null);
        if (!username.trim()) { setError('Введи имя пользователя'); return; }
        setBusy(true);
        try {
            await login(username.trim());
            // Если needs_password — useEffect поймает pendingUsername и переключит на set_password
            setStep('password');
        } catch (err) {
            if (err instanceof ApiException) {
                if (err.error === 'invalid_credentials')
                    setError('Аккаунт не найден. Для регистрации — войди через Telegram ↑');
                else if (err.error === 'password_required') setStep('password');
                else if (err.error === 'telegram_only') setError('Этот аккаунт входит только через Telegram');
                else setError(err.message || 'Ошибка');
            } else {
                setError('Ошибка соединения');
            }
        } finally {
            setBusy(false);
        }
    }

    // ── Шаг 2a: обычный вход с паролем ───────────────────────────────────────
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

    // ── Шаг 2b: первичная установка пароля ───────────────────────────────────
    async function submitSetPassword() {
        setError(null);
        if (password.length < 8) { setError('Пароль слишком короткий (минимум 8 символов)'); return; }
        if (password !== confirm) { setError('Пароли не совпадают'); return; }
        setBusy(true);
        try {
            await setFirstPassword(password);
            // pendingFirstLoginUser теперь установлен → useEffect переключит на link_telegram
        } catch (err) {
            if (err instanceof ApiException) setError(err.message);
            else if (err instanceof Error) setError(err.message);
            else setError('Неизвестная ошибка');
        } finally {
            setBusy(false);
        }
    }

    // ── Создание аккаунта через Telegram ─────────────────────────────────────
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

    // ── Пропустить привязку Telegram ─────────────────────────────────────────
    function skipTgLink() {
        completeFirstLogin();
    }

    // ── Создание аккаунта через Telegram (отдельный ранний return) ─────────
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

    // ── Основной render (все остальные шаги) ──────────────────────────────────
    // tgRef всегда в DOM — скрываем/показываем через style, чтобы виджет не пересоздавался
    return (
        <div className="auth-screen">
            <div className="auth-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="auth-logo" />
                <h1>
                    {step === 'link_telegram' ? 'Привяжи Telegram'
                        : step === 'set_password' ? 'Придумай пароль'
                        : 'Войти'}
                </h1>
                <p className="auth-subtitle">
                    {step === 'set_password'
                        ? `Привет, ${pendingUsername}! Создай пароль для входа`
                        : step === 'link_telegram'
                        ? 'Это поможет войти, если забудешь пароль'
                        : 'LifonMUSIC'}
                </p>
                <div className="auth-form">
                    {/* TG-виджет: всегда в DOM, виден только на нужных шагах */}
                    <div
                        ref={tgRef}
                        className="tg-btn-wrapper"
                        style={{ display: step === 'username' || step === 'link_telegram' ? '' : 'none' }}
                    />

                    {error && <p className="auth-error">{error}</p>}

                    {/* ── username ── */}
                    {step === 'username' && (
                        <>
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
                        </>
                    )}

                    {/* ── password ── */}
                    {step === 'password' && (
                        <>
                            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 4 }}>
                                {username}
                            </p>
                            <input
                                type="password"
                                placeholder="Пароль"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitPassword(); }}
                                autoFocus
                            />
                            <button className="btn-primary" type="button" onClick={submitPassword} disabled={busy}>
                                {busy ? '...' : 'Войти'}
                            </button>
                            <span className="auth-link" style={{ textAlign: 'center', fontSize: 13 }}
                                onClick={() => { setStep('username'); setPassword(''); setError(null); }}>
                                ← Назад
                            </span>
                        </>
                    )}

                    {/* ── set_password ── */}
                    {step === 'set_password' && (
                        <>
                            <input
                                type="password"
                                placeholder="Новый пароль (мин. 8 символов)"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <input
                                type="password"
                                placeholder="Повтори пароль"
                                autoComplete="new-password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitSetPassword(); }}
                            />
                            <button className="btn-primary" type="button" onClick={submitSetPassword} disabled={busy}>
                                {busy ? '...' : 'Сохранить пароль'}
                            </button>
                            <span className="auth-link" style={{ textAlign: 'center', fontSize: 13 }}
                                onClick={() => {
                                    cancelPendingUsername();
                                    setStep('username');
                                    setPassword('');
                                    setConfirm('');
                                    setError(null);
                                }}>
                                ← Назад
                            </span>
                        </>
                    )}

                    {/* ── link_telegram ── */}
                    {step === 'link_telegram' && (
                        <>
                            <p style={{
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: 12,
                                textAlign: 'center',
                                marginTop: 4,
                                marginBottom: 12,
                            }}>
                                Или войди в аккаунт через Telegram выше
                            </p>
                            <button
                                className="btn-primary"
                                type="button"
                                onClick={skipTgLink}
                                disabled={busy}
                                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
                            >
                                Пропустить →
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

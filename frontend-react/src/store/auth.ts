import { create } from 'zustand';
import { api, getToken, setToken } from '@/lib/api';
import type { AuthResponse, NeedsPasswordResponse, TelegramAuthData, TelegramAuthResponse, User } from '@/types/api';

interface PendingTg {
    data: TelegramAuthData;
    suggestedUsername: string;
}

interface AuthState {
    user: User | null;
    ready: boolean;
    pendingTg: PendingTg | null;
    /** username, ожидающий первичной установки пароля */
    pendingUsername: string | null;
    bootstrap: () => Promise<void>;
    /** Шаг 1: без пароля — проверяем username. Шаг 2: с паролем — логин / установка пароля. */
    login: (username: string, password?: string) => Promise<void>;
    setFirstPassword: (password: string) => Promise<void>;
    cancelPendingUsername: () => void;
    loginWithTelegram: (data: TelegramAuthData) => Promise<void>;
    completeTelegramSetup: (username: string, password: string) => Promise<void>;
    cancelTelegramSetup: () => void;
    linkTelegram: (data: TelegramAuthData) => Promise<void>;
    logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
    user: null,
    ready: false,
    pendingTg: null,
    pendingUsername: null,

    async bootstrap() {
        if (!getToken()) {
            set({ ready: true });
            return;
        }
        try {
            const res = await api.get<{ ok: true; user: User }>('/profile');
            set({ user: res.user, ready: true });
        } catch {
            setToken(null);
            set({ user: null, ready: true });
        }
    },

    async login(username, password?) {
        const res = await api.post<AuthResponse | NeedsPasswordResponse>(
            '/auth/login',
            password ? { username, password } : { username },
        );
        if ('needs_password' in res && res.needs_password) {
            set({ pendingUsername: username });
            return;
        }
        const auth = res as AuthResponse;
        setToken(auth.token);
        set({ user: auth.user, pendingUsername: null });
    },

    async setFirstPassword(password) {
        const { pendingUsername } = get();
        if (!pendingUsername) throw new Error('Нет активной сессии');
        const res = await api.post<AuthResponse>('/auth/login', { username: pendingUsername, password });
        setToken(res.token);
        set({ user: res.user, pendingUsername: null });
    },

    cancelPendingUsername() {
        set({ pendingUsername: null });
    },

    async loginWithTelegram(data) {
        const res = await api.post<TelegramAuthResponse>('/auth/telegram', data);
        if (res.pending) {
            set({ pendingTg: { data, suggestedUsername: res.suggested_username } });
        } else {
            setToken(res.token);
            set({ user: res.user, pendingTg: null });
        }
    },

    async completeTelegramSetup(username, password) {
        const { pendingTg } = get();
        if (!pendingTg) throw new Error('Нет активной сессии Telegram');
        const res = await api.post<AuthResponse>('/auth/telegram/complete', {
            tg_data: pendingTg.data,
            username,
            password,
        });
        setToken(res.token);
        set({ user: res.user, pendingTg: null });
    },

    cancelTelegramSetup() {
        set({ pendingTg: null });
    },

    async linkTelegram(data) {
        const res = await api.post<{ ok: true; telegram_id: number }>('/auth/telegram/link', data);
        set((s) => ({ user: s.user ? { ...s.user, telegram_id: res.telegram_id } : null }));
    },

    logout() {
        setToken(null);
        set({ user: null });
    },
}));

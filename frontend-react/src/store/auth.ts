import { create } from 'zustand';
import { api, getToken, setToken } from '@/lib/api';
import type { AuthResponse, TelegramAuthData, TelegramAuthResponse, User } from '@/types/api';

interface PendingTg {
    data: TelegramAuthData;
    suggestedUsername: string;
}

interface AuthState {
    user: User | null;
    ready: boolean;
    pendingTg: PendingTg | null;
    bootstrap: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    loginWithTelegram: (data: TelegramAuthData) => Promise<void>;
    completeTelegramSetup: (username: string, password: string) => Promise<void>;
    cancelTelegramSetup: () => void;
    logout: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
    user: null,
    ready: false,
    pendingTg: null,

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

    async login(username, password) {
        const res = await api.post<AuthResponse>('/auth/login', { username, password });
        setToken(res.token);
        set({ user: res.user });
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

    logout() {
        setToken(null);
        set({ user: null });
    },
}));

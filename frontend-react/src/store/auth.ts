import { create } from 'zustand';
import { api, getToken, setToken } from '@/lib/api';
import type { AuthResponse, User } from '@/types/api';

interface AuthState {
    user: User | null;
    ready: boolean;
    bootstrap: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, password: string) => Promise<void>;
    logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
    user: null,
    ready: false,

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

    async register(username, password) {
        const res = await api.post<AuthResponse>('/auth/register', { username, password });
        setToken(res.token);
        set({ user: res.user });
    },

    logout() {
        setToken(null);
        set({ user: null });
    },
}));

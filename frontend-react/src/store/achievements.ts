import { create } from 'zustand';
import { api } from '@/lib/api';
import type { AchievementNotification } from '@/types/api';

interface AchievementsState {
    notifications: AchievementNotification[];
    currentPopup: AchievementNotification | null;
    load: () => Promise<void>;
    dismissPopup: () => void;
}

export const useAchievements = create<AchievementsState>((set, get) => ({
    notifications: [],
    currentPopup: null,

    async load() {
        try {
            const res = await api.get<{ ok: true; notifications: AchievementNotification[] }>('/achievements/notifications');
            const incoming = res.notifications ?? [];
            if (incoming.length === 0) return;

            // Mark all as read on the server
            void api.post('/achievements/notifications/read', {});

            // Queue them up: show the first immediately if nothing is showing
            const { currentPopup } = get();
            set({
                notifications: incoming,
                currentPopup: currentPopup ?? incoming[0] ?? null,
            });
        } catch {
            // Silently ignore — achievements are non-critical
        }
    },

    dismissPopup() {
        const { notifications, currentPopup } = get();
        if (!currentPopup) return;
        const remaining = notifications.filter((n) => n.id !== currentPopup.id);
        set({
            notifications: remaining,
            currentPopup: remaining[0] ?? null,
        });
    },
}));

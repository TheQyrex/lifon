import { create } from 'zustand';

interface UiState {
    sidebarCollapsed: boolean;
    disclaimerAccepted: boolean;
    showAuth: boolean;  // переключатель welcome → auth (когда юзер кликнул «Войти»)
    snowOn: boolean;

    toggleSidebar: () => void;
    acceptDisclaimer: () => void;
    goToAuth: () => void;
    backToWelcome: () => void;
    toggleSnow: () => void;
}

export const useUi = create<UiState>((set) => ({
    sidebarCollapsed: localStorage.getItem('sidebar_collapsed') === '1',
    disclaimerAccepted: localStorage.getItem('disclaimer_shown') === 'true',
    showAuth: false,
    snowOn: localStorage.getItem('snow_on') === '1',

    toggleSidebar: () => set((s) => {
        const next = !s.sidebarCollapsed;
        localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
        document.body.classList.toggle('sidebar-collapsed', next);
        return { sidebarCollapsed: next };
    }),

    acceptDisclaimer: () => {
        localStorage.setItem('disclaimer_shown', 'true');
        set({ disclaimerAccepted: true });
    },

    goToAuth: () => set({ showAuth: true }),
    backToWelcome: () => set({ showAuth: false }),

    toggleSnow: () => set((s) => {
        const next = !s.snowOn;
        localStorage.setItem('snow_on', next ? '1' : '0');
        return { snowOn: next };
    }),
}));

import type { Config } from 'tailwindcss';

const config: Config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    // Preflight отключён — иначе он перетирает оригинальный CSS LifonMUSIC.
    // Tailwind остаётся доступным как utility-only (используем для новой админки).
    corePlugins: {
        preflight: false,
    },
    theme: {
        extend: {
            colors: {
                accent: {
                    DEFAULT: '#E8D5FF',
                    soft: 'rgba(232, 213, 255, 0.7)',
                    muted: 'rgba(232, 213, 255, 0.4)',
                },
                purple: {
                    500: '#8b5cf6',
                    600: '#7c3aed',
                },
                bg: {
                    top: '#1A1A1F',
                    mid: '#111114',
                    bot: '#080809',
                },
            },
            fontFamily: {
                sans: [
                    'Google Sans',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    'Segoe UI',
                    'Roboto',
                    'sans-serif',
                ],
            },
            backgroundImage: {
                'app-gradient': 'linear-gradient(180deg, #1A1A1F 0%, #111114 50%, #080809 100%)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease',
                'slide-up': 'slideUp 0.5s ease',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;

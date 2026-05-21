import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '@/store/auth';

interface NavItem {
    to: string;
    label: string;
    icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
    { to: '/admin',             label: 'Статистика',   icon: <IconStats /> },
    { to: '/admin/users',       label: 'Пользователи', icon: <IconUsers /> },
    { to: '/admin/maintenance', label: 'Техработы',    icon: <IconWrench /> },
    { to: '/admin/broadcasts',  label: 'Рассылка',     icon: <IconMegaphone /> },
    { to: '/admin/albums',      label: 'Альбомы',      icon: <IconDisc /> },
    { to: '/admin/uploads',     label: 'Файлы',        icon: <IconUpload /> },
    { to: '/admin/supporters',  label: 'Поддержка',    icon: <IconHeart /> },
];

export function AdminShell() {
    const { user } = useAuth();

    return (
        <div className="admin-scope h-screen w-full flex bg-app-gradient text-white overflow-hidden font-sans">
            <aside className="w-64 shrink-0 border-r border-white/[0.06] bg-black/30 backdrop-blur-md flex flex-col overflow-y-auto">
                <div className="px-5 py-5 border-b border-white/[0.05]">
                    <Link to="/" className="flex items-center gap-2 text-white/60 hover:text-white text-sm transition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" /></svg>
                        К плееру
                    </Link>
                    <div className="mt-3 flex items-center">
                        <img src="/admin.png" alt="LifonMUSIC admin" className="w-10 h-10 rounded-lg object-contain shrink-0" />
                    </div>
                </div>

                <nav className="flex-1 p-3 flex flex-col gap-1">
                    {ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/admin'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                                    isActive
                                        ? 'bg-accent/15 text-accent'
                                        : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
                                }`
                            }
                        >
                            <span className="shrink-0">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/[0.05] text-xs text-white/40">
                    Вошли как <span className="text-white/70">{user?.username}</span>
                </div>
            </aside>

            <main className="flex-1 min-w-0 px-8 py-8 overflow-y-auto">
                <div className="mx-auto max-w-5xl">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

function IconStats() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
    );
}
function IconWrench() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
    );
}
function IconMegaphone() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 3 13 7 13 12 18 12 6 7 11 3 11" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
    );
}
function IconDisc() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}
function IconUpload() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
    );
}
function IconHeart() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
    );
}
function IconUsers() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

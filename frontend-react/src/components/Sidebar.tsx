import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useUi } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useLive } from '@/store/live';

interface NavItem {
    to: string;
    label: string;
    icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
    {
        to: '/',
        label: 'Библиотека',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.566 4.657A4.505 4.505 0 0 1 6.75 4.5h10.5c.41 0 .806.055 1.183.157A3 3 0 0 0 15.75 3h-7.5a3 3 0 0 0-2.684 1.657ZM2.25 12a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3v-6ZM5.25 7.5c-.41 0-.806.055-1.184.157A3 3 0 0 1 6.75 6h10.5a3 3 0 0 1 2.683 1.657A4.505 4.505 0 0 0 18.75 7.5H5.25Z" />
            </svg>
        ),
    },
    {
        to: '/favorites',
        label: 'Избранное',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
            </svg>
        ),
    },
    {
        to: '/about',
        label: 'О LifonMUSIC',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
            </svg>
        ),
    },
];

const ADMIN_ITEM: NavItem = {
    to: '/admin',
    label: 'Админка',
    icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.113.335-.124.45-.081l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692a1.875 1.875 0 0 0 .432-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
        </svg>
    ),
};

const PROFILE_ITEM: NavItem = {
    to: '/profile',
    label: 'Профиль',
    icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
        </svg>
    ),
};

export function Sidebar() {
    const { sidebarCollapsed, toggleSidebar } = useUi();
    const isAdmin = useAuth((s) => !!s.user?.is_admin);
    const avatarUrl = useAuth((s) => s.user?.avatar_url ?? null);
    const liveTotal = useLive((s) => s.total);
    const bottomItems = isAdmin ? [ADMIN_ITEM, PROFILE_ITEM] : [PROFILE_ITEM];

    // Синхронизируем body-класс с состоянием store при первом рендере и логине
    useEffect(() => {
        document.body.classList.toggle('sidebar-collapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    return (
        <nav id="sidebar" className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
            <div className="sidebar-content">
                <div className="sidebar-logo">
                    <img src={sidebarCollapsed ? '/minlogo.png' : '/Logo.png'} alt="LifonMUSIC" className="logo-full" />
                    <button className="btn-toggle-sidebar" onClick={toggleSidebar} type="button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path
                                fillRule="evenodd"
                                d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </button>
                </div>

                <div className="sidebar-menu">
                    {ITEMS.map((item) => <SidebarLink key={item.to} item={item} />)}
                </div>

                <div className="sidebar-menu sidebar-menu-bottom">
                    {bottomItems.map((item) =>
                        item.to === '/profile' && avatarUrl
                            ? <SidebarLink key={item.to} item={{ ...item, icon: (
                                <img src={avatarUrl} alt="" className="sidebar-avatar" />
                              ) }} />
                            : <SidebarLink key={item.to} item={item} />
                    )}
                    {liveTotal > 0 && !sidebarCollapsed && (
                        <div className="sidebar-live" title="Сейчас слушают">
                            <span className="sidebar-live-dot" />
                            <span>Онлайн: {liveTotal}</span>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}

function SidebarLink({ item }: { item: NavItem }) {
    return (
        <NavLink
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
        >
            {item.icon}
            <span>{item.label}</span>
        </NavLink>
    );
}

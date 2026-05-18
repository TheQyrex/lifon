// Adds an "Админка" entry to the sidebar — but only for users whose /profile
// response has is_admin = true. Non-admins never see the link.

(function () {
    const { el } = window.LifonDOM;

    let cached = null;

    async function refresh() {
        if (!window.LifonAPI.getToken()) return;
        try {
            const res = await window.LifonAPI.get('/profile');
            cached = res.user;
        } catch {
            return;
        }
        if (!cached?.is_admin) return;
        ensureLink();
    }

    function ensureLink() {
        const menu = document.querySelector('.sidebar-menu-bottom');
        if (!menu || menu.querySelector('[data-screen="admin"]')) return;

        const profileItem = menu.querySelector('[data-screen="profile"]');
        const link = el('a', {
            class: 'sidebar-item',
            href: 'admin/admin.html',
            target: '_self',
            dataset: { screen: 'admin' },
            style: { textDecoration: 'none', color: 'inherit' },
        }, [
            buildIcon(),
            el('span', { text: 'Админка' }),
        ]);
        if (profileItem) menu.insertBefore(link, profileItem);
        else menu.appendChild(link);
    }

    function buildIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.113.335-.124.45-.081l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692a1.875 1.875 0 0 0 .432-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z');
        svg.appendChild(path);
        return svg;
    }

    window.LifonAdminLink = { refresh };
    document.addEventListener('DOMContentLoaded', () => { refresh(); });
})();

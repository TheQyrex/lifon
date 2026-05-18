// Loads active broadcasts from the API and renders two UI surfaces:
//  - a compact top bar (kind === 'notification') with just a title
//  - a full-screen modal banner (kind === 'banner') with title + body + image
//
// The body of a banner supports a small Markdown-ish syntax (`*italic*`,
// `**bold**`, ``mono``) rendered safely via LifonDOM.renderFormatted.

(function () {
    const DISMISSED_KEY = 'lifon_dismissed_broadcasts';
    const { el, clear, renderFormatted } = window.LifonDOM;

    function loadDismissed() {
        try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')); }
        catch { return new Set(); }
    }
    function saveDismissed(set) {
        localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
    }

    function ensureRoot() {
        let root = document.getElementById('broadcastRoot');
        if (root) return root;
        root = el('div', { id: 'broadcastRoot' });
        document.body.appendChild(root);
        return root;
    }

    function renderNotification(item, dismissed) {
        const root = ensureRoot();
        let bar = root.querySelector('.broadcast-bar');
        if (bar) bar.remove();

        if (!item || dismissed.has(`n:${item.id}`)) {
            document.body.classList.remove('app-has-notification');
            return;
        }

        bar = el('div', { class: 'broadcast-bar', role: 'status' }, [
            el('span', { class: 'broadcast-bar-title', text: item.title }),
            el('button', {
                class: 'broadcast-bar-close',
                'aria-label': 'Закрыть',
                onclick: () => {
                    dismissed.add(`n:${item.id}`);
                    saveDismissed(dismissed);
                    bar.remove();
                    document.body.classList.remove('app-has-notification');
                },
                text: '×',
            }),
        ]);
        root.appendChild(bar);
        document.body.classList.add('app-has-notification');
    }

    function renderBanner(item, dismissed) {
        const root = ensureRoot();
        let modal = root.querySelector('.broadcast-modal');
        if (modal) modal.remove();

        if (!item || dismissed.has(`b:${item.id}`)) return;

        const close = () => {
            dismissed.add(`b:${item.id}`);
            saveDismissed(dismissed);
            modal.remove();
        };

        const card = el('div', { class: 'broadcast-card' }, [
            item.image_url ? el('img', { src: item.image_url, class: 'broadcast-card-image', alt: '' }) : null,
            el('h2', { class: 'broadcast-card-title', text: item.title }),
        ]);

        if (item.body) {
            const body = el('div', { class: 'broadcast-card-body' });
            body.appendChild(renderFormatted(item.body));
            card.appendChild(body);
        }

        if (item.meta) {
            try {
                const meta = JSON.parse(item.meta);
                if (Array.isArray(meta.buttons) && meta.buttons.length) {
                    const btnRow = el('div', { class: 'broadcast-card-buttons' });
                    for (const btn of meta.buttons) {
                        const b = el('a', {
                            href: btn.url || '#',
                            target: '_blank',
                            rel: 'noopener',
                            class: 'broadcast-card-btn',
                            text: btn.label || 'Подробнее',
                            style: { background: btn.color || '#8b5cf6' },
                        });
                        btnRow.appendChild(b);
                    }
                    card.appendChild(btnRow);
                }
            } catch {}
        }

        card.appendChild(el('button', {
            class: 'broadcast-card-ok',
            text: 'Понятно',
            onclick: close,
        }));

        modal = el('div', { class: 'broadcast-modal', role: 'dialog', 'aria-modal': 'true' }, [
            el('div', { class: 'broadcast-modal-backdrop', onclick: close }),
            card,
        ]);
        root.appendChild(modal);
    }

    async function refresh() {
        let res;
        try {
            res = await window.LifonAPI.get('/notification');
        } catch {
            return; // network blip, fail silently
        }
        const dismissed = loadDismissed();
        const items = Array.isArray(res?.items) ? res.items : [];
        const notif = items.find(i => i.kind === 'notification') || null;
        const banner = items.find(i => i.kind === 'banner') || null;
        renderNotification(notif, dismissed);
        renderBanner(banner, dismissed);
    }

    window.LifonBroadcasts = { refresh };
    document.addEventListener('DOMContentLoaded', () => { refresh(); });
})();

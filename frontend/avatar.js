(function () {
    const { el, clear } = window.LifonDOM;

    let currentUrl = null;
    let pendingFile = null;

    async function mount() {
        const container = document.querySelector('.profile-info');
        if (!container) return;

        const avatarEl = container.querySelector('.profile-avatar');
        if (!avatarEl) return;

        if (avatarEl.querySelector('.profile-avatar-overlay')) return; // already mounted

        const profile = await fetchProfile();
        currentUrl = profile?.avatar_url || null;

        setup(avatarEl);
    }

    function setup(avatarEl) {
        // -- overlay --
        const uploadBtn = el('button', {
            class: 'profile-avatar-action',
            type: 'button',
            title: 'Поставить аватар',
        }, [buildCameraIcon()]);
        const removeBtn = el('button', {
            class: 'profile-avatar-action profile-avatar-action-danger',
            type: 'button',
            title: 'Удалить аватар',
            style: { display: currentUrl ? '' : 'none' },
        }, [buildTrashIcon()]);
        const overlay = el('div', { class: 'profile-avatar-overlay' }, [uploadBtn, removeBtn]);
        avatarEl.appendChild(overlay);

        if (currentUrl) setAvatarImage(avatarEl, currentUrl);

        // -- hidden file input --
        const fileInput = el('input', {
            type: 'file',
            accept: 'image/png,image/jpeg,image/webp,image/gif',
            style: { display: 'none' },
        });
        document.body.appendChild(fileInput);
        uploadBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            fileInput.click();
        });

        // -- controls below avatar (all in same scope as fileInput listener) --
        const status   = el('span', { class: 'profile-avatar-status' });
        const confirmBtn = el('button', { class: 'btn-secondary', text: 'Загрузить', style: { display: 'none' } });
        const cancelBtn  = el('button', { class: 'btn-link',      text: 'Отмена',    style: { display: 'none' } });

        const controls = el('div', { class: 'profile-avatar-controls' }, [
            confirmBtn, cancelBtn, status,
        ]);
        avatarEl.insertAdjacentElement('afterend', controls);

        function showConfirm(show) {
            confirmBtn.style.display = show ? '' : 'none';
            cancelBtn.style.display  = show ? '' : 'none';
            removeBtn.style.display  = show ? 'none' : (currentUrl ? '' : 'none');
        }

        // file selected → preview
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            fileInput.value = '';
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) {
                setStatus(status, 'Файл больше 2 МБ', true);
                return;
            }
            pendingFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                setAvatarImage(avatarEl, e.target.result);
                showConfirm(true);
                setStatus(status, '');
            };
            reader.readAsDataURL(file);
        });

        // confirm → upload
        confirmBtn.addEventListener('click', async () => {
            if (!pendingFile) return;
            confirmBtn.disabled = true;
            setStatus(status, 'Загружаем…');
            const form = new FormData();
            form.append('file', pendingFile);
            // Keep the dataURL preview while we upload
            const previewDataUrl = avatarEl.querySelector('img')?.src || null;
            try {
                const res = await window.LifonAPI.upload('/profile/avatar', form);
                currentUrl = res.avatar_url;
                pendingFile = null;
                showConfirm(false);
                setStatus(status, 'Сохранено');
                setTimeout(() => setStatus(status, ''), 2000);
                // Try loading the server URL; keep preview on failure
                const probe = new Image();
                probe.onload = () => setAvatarImage(avatarEl, currentUrl);
                probe.onerror = () => {
                    if (previewDataUrl) setAvatarImage(avatarEl, previewDataUrl);
                };
                probe.src = currentUrl;
            } catch (err) {
                setStatus(status, err?.message || 'Ошибка загрузки', true);
            } finally {
                confirmBtn.disabled = false;
            }
        });

        // cancel → restore
        cancelBtn.addEventListener('click', () => {
            pendingFile = null;
            if (currentUrl) setAvatarImage(avatarEl, currentUrl);
            else renderPlaceholder(avatarEl);
            showConfirm(false);
            setStatus(status, '');
        });

        // remove avatar
        removeBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            setStatus(status, 'Удаляем…');
            try {
                await window.LifonAPI.delete('/profile/avatar');
                currentUrl = null;
                pendingFile = null;
                renderPlaceholder(avatarEl);
                showConfirm(false);
                setStatus(status, '');
            } catch (err) {
                setStatus(status, err?.message || 'Ошибка', true);
            }
        });
    }

    function setAvatarImage(avatarEl, url) {
        const overlay = avatarEl.querySelector('.profile-avatar-overlay');
        clear(avatarEl);
        const img = el('img', { src: url, alt: 'Аватар', class: 'profile-avatar-image' });
        img.addEventListener('error', () => renderPlaceholder(avatarEl));
        avatarEl.appendChild(img);
        if (overlay) avatarEl.appendChild(overlay);
    }

    function renderPlaceholder(avatarEl) {
        const overlay = avatarEl.querySelector('.profile-avatar-overlay');
        clear(avatarEl);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '60');
        svg.setAttribute('height', '60');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z');
        svg.appendChild(path);
        avatarEl.appendChild(svg);
        if (overlay) avatarEl.appendChild(overlay);
    }

    function buildCameraIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '28');
        svg.setAttribute('height', '28');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'white');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm7-11.2h-2.76l-1.62-2H9.38L7.76 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z');
        svg.appendChild(path);
        return svg;
    }

    function buildTrashIcon() {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '22');
        svg.setAttribute('height', '22');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'white');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M9 3h6l1 2h5v2H3V5h5l1-2Zm1 6h2v9h-2V9Zm4 0h2v9h-2V9ZM6 9h12l-1 12H7L6 9Z');
        svg.appendChild(path);
        return svg;
    }

    async function fetchProfile() {
        try {
            const res = await window.LifonAPI.get('/profile');
            return res?.user || null;
        } catch {
            return null;
        }
    }

    function setStatus(node, text, isError = false) {
        node.textContent = text;
        node.classList.toggle('profile-avatar-status-error', !!isError);
    }

    window.LifonAvatar = { mount };
})();

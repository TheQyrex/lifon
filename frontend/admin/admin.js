// Admin SPA — complete rewrite.
// Tabs: Stats | Рассылка | Альбомы | Файлы
// Uses window.LifonDOM.el / clear / renderFormatted and window.LifonAPI.

(function () {
    'use strict';

    const { el, clear, renderFormatted } = window.LifonDOM;
    const api = window.LifonAPI;

    const root = document.getElementById('adminRoot');
    const whoamiEl = document.getElementById('adminWhoami');

    document.addEventListener('DOMContentLoaded', boot);

    // ============================================================
    // Boot & shell
    // ============================================================

    async function boot() {
        if (!api.getToken()) return showAccessDenied('Войдите в плеере, чтобы попасть в админку.');

        let profile;
        try {
            const res = await api.get('/profile');
            profile = res.user;
        } catch (err) {
            return showAccessDenied(err?.message || 'Не удалось проверить доступ.');
        }
        if (!profile?.is_admin) return showAccessDenied('У вас нет прав администратора.');

        whoamiEl.textContent = `${profile.username} (admin)`;
        renderShell();
        switchTab('stats');
    }

    function showAccessDenied(message) {
        clear(root);
        root.appendChild(el('div', { class: 'admin-error-screen' }, [
            el('h2', { text: 'Доступ закрыт' }),
            el('p', { text: message }),
        ]));
    }

    function renderShell() {
        clear(root);
        const tabs = el('div', { class: 'admin-tabs' });
        const sections = el('div', { class: 'admin-sections' });

        const sectionDefs = [
            { id: 'stats',      title: 'Статистика', render: renderStatsSection },
            { id: 'maintenance', title: 'Техработы',  render: renderMaintenanceSection },
            { id: 'broadcasts', title: 'Рассылка',   render: renderBroadcastsSection },
            { id: 'content',    title: 'Альбомы',    render: renderContentSection },
            { id: 'uploads',    title: 'Файлы',      render: renderUploadsSection },
            { id: 'supporters', title: 'Поддержка',  render: renderSupportersSection },
        ];

        for (const def of sectionDefs) {
            tabs.appendChild(el('button', {
                class: 'admin-tab',
                dataset: { tab: def.id },
                text: def.title,
                onclick: () => switchTab(def.id),
            }));

            const section = el('div', { class: 'admin-section', dataset: { section: def.id } });
            sections.appendChild(section);
            def.render(section);
        }

        root.appendChild(tabs);
        root.appendChild(sections);
    }

    function switchTab(id) {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.dataset.section === id));
    }

    // ============================================================
    // Maintenance
    // ============================================================

    function renderMaintenanceSection(host) {
        const enabledInp = el('input', { type: 'checkbox' });
        const messageInp = el('input', {
            type: 'text',
            maxlength: 240,
            placeholder: 'Сайт находится на технических работах',
        });
        const saveBtn = el('button', { class: 'admin-btn', type: 'button', text: 'Сохранить режим' });
        const flashSlot = el('div');

        host.appendChild(el('div', { class: 'admin-card' }, [
            el('h2', { text: 'Режим технических работ' }),
            el('p', {
                class: 'admin-hint',
                text: 'Когда режим включён, все API-запросы не-админов получают 503, а сайт показывает заглушку.',
            }),
            el('label', { class: 'maintenance-toggle-row' }, [
                enabledInp,
                el('div', null, [
                    el('strong', { text: 'Закрыть сайт для всех, кроме админов' }),
                    el('div', { class: 'admin-hint', text: 'Админы смогут войти и работать в админке.' }),
                ]),
            ]),
            field('Текст плашки', messageInp).wrapper,
            el('div', { class: 'admin-inline-actions' }, [saveBtn, flashSlot]),
        ]));

        refreshMaintenance();

        saveBtn.addEventListener('click', async () => {
            clear(flashSlot);
            saveBtn.disabled = true;
            try {
                const res = await api.put('/admin/maintenance', {
                    enabled: enabledInp.checked,
                    message: messageInp.value.trim() || 'Сайт находится на технических работах',
                });
                applyMaintenanceState(res.maintenance);
                flashSlot.appendChild(flash(enabledInp.checked ? 'Техработы включены' : 'Техработы выключены'));
            } catch (err) {
                flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
            } finally {
                saveBtn.disabled = false;
            }
        });

        async function refreshMaintenance() {
            clear(flashSlot);
            flashSlot.appendChild(el('div', { class: 'admin-hint', text: 'Загружаем…' }));
            try {
                const res = await api.get('/admin/maintenance');
                clear(flashSlot);
                applyMaintenanceState(res.maintenance);
            } catch (err) {
                clear(flashSlot);
                flashSlot.appendChild(flash(err?.message || 'Не удалось загрузить режим', true));
            }
        }

        function applyMaintenanceState(state) {
            enabledInp.checked = !!state?.enabled;
            messageInp.value = state?.message || 'Сайт находится на технических работах';
        }
    }

    // ============================================================
    // Stats
    // ============================================================

    async function renderStatsSection(host) {
        host.appendChild(el('div', { class: 'admin-loading', text: 'Загружаем статистику…' }));

        let data;
        try {
            data = await api.get('/admin/stats');
        } catch (err) {
            clear(host);
            host.appendChild(flash(err?.message || 'Не удалось загрузить статистику', true));
            return;
        }

        clear(host);

        const grid = el('div', { class: 'stats-grid' });
        const totals = data.totals;
        const items = [
            ['Пользователи', totals.users],
            ['Активны (30 дн)', totals.users_active_30d],
            ['Прослушиваний', totals.listens],
            ['За 30 дней', totals.listens_recent_30d],
            ['Лайков', totals.likes],
            ['Часов прослушано', Math.round(totals.listen_ms / 3_600_000)],
        ];
        for (const [label, value] of items) {
            grid.appendChild(el('div', { class: 'stat-box' }, [
                el('div', { class: 'stat-box-label', text: label }),
                el('div', { class: 'stat-box-value', text: String(value) }),
            ]));
        }
        host.appendChild(grid);

        host.appendChild(buildTopTracksCard('Топ по прослушиваниям', data.top_tracks, ['track_id', 'plays', 'listeners']));
        host.appendChild(buildTopTracksCard('Топ по лайкам', data.top_liked, ['track_id', 'likes']));
        host.appendChild(buildRecentUsersCard(data.recent_users));
    }

    function buildTopTracksCard(title, rows, columns) {
        const table = el('table', { class: 'admin-table' });
        table.appendChild(el('thead', null, [el('tr', null, columns.map(c => el('th', { text: c })))]));
        const body = el('tbody');
        for (const row of rows) {
            body.appendChild(el('tr', null, columns.map(c => el('td', {
                class: c === 'track_id' ? '' : 'num',
                text: c === 'track_id' ? describeTrackCell(row) : String(row[c] ?? ''),
            }))));
        }
        table.appendChild(body);
        return el('div', { class: 'admin-card' }, [el('h2', { text: title }), table]);
    }

    function describeTrack(trackId) {
        const id = Number(trackId);
        const source = getCatalogAlbums();
        for (const album of source) {
            const track = (album.tracks || []).find(t => t.id === id);
            if (track) return `${track.title} · ${album.title}`;
        }
        return String(trackId ?? '');
    }

    function describeTrackCell(row) {
        if (row.title) return `${row.title} · ${row.album_title || row.artist || row.track_id}`;
        return describeTrack(row.track_id);
    }

    function buildRecentUsersCard(rows) {
        const cols = ['username', 'created_at', 'last_seen_at', 'is_admin'];
        const table = el('table', { class: 'admin-table' });
        table.appendChild(el('thead', null, [el('tr', null, cols.map(c => el('th', { text: c })))]));
        const body = el('tbody');
        for (const row of rows) {
            body.appendChild(el('tr', null, [
                el('td', { text: row.username }),
                el('td', { text: formatTs(row.created_at) }),
                el('td', { text: row.last_seen_at ? formatTs(row.last_seen_at) : '—' }),
                el('td', { text: row.is_admin ? '✓' : '' }),
            ]));
        }
        table.appendChild(body);
        return el('div', { class: 'admin-card' }, [el('h2', { text: 'Недавние регистрации' }), table]);
    }

    // ============================================================
    // Broadcasts (Рассылка)
    // ============================================================

    function renderBroadcastsSection(host) {
        // Two-column layout: form left, preview right
        const formCol = el('div');
        const previewCol = el('div');
        const grid = el('div', { class: 'broadcast-form-grid' }, [formCol, previewCol]);

        const formCard = el('div', { class: 'admin-card' }, [el('h2', { text: 'Новая рассылка' }), grid]);
        const listCard = el('div', { class: 'admin-card' }, [el('h2', { text: 'Активные и недавние' })]);
        host.appendChild(formCard);
        host.appendChild(listCard);

        let imageKey = null;
        let imageUrl = null;

        // --- Fields ---
        const kindSel = el('select', null, [
            el('option', { value: 'notification', text: 'Верхнее уведомление (только заголовок)' }),
            el('option', { value: 'banner', text: 'Большой баннер (заголовок + текст + фото)' }),
        ]);
        const kindField = field('Тип', kindSel);

        const titleInp = el('input', { type: 'text', maxlength: 200, placeholder: 'Заголовок' });
        const titleField = field('Заголовок', titleInp);

        // Body with mini toolbar
        const bodyArea = el('textarea', { style: { minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' } });
        const toolbar = el('div', { class: 'body-toolbar' });
        for (const [label, wrap] of [['B', '**'], ['I', '*'], ['`', '`']]) {
            toolbar.appendChild(el('button', {
                type: 'button',
                text: label,
                onclick: () => wrapSelection(bodyArea, wrap, wrap),
            }));
        }
        const bodyWrapper = el('div', null, [toolbar, bodyArea]);
        const bodyField = field('Текст (Markdown: *italic*, **bold**, `mono`)', bodyWrapper);

        // Image upload
        const imgFileInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
        const imgPreview = el('div', null);
        const imgPickBtn = el('button', { class: 'admin-btn admin-btn-secondary admin-btn-sm', type: 'button', text: 'Выбрать картинку' });
        imgPickBtn.addEventListener('click', () => imgFileInput.click());
        const imageSection = el('div', null, [imgPickBtn, imgFileInput, imgPreview]);
        const imageField = field('Картинка (баннер)', imageSection);

        imgFileInput.addEventListener('change', async () => {
            const file = imgFileInput.files?.[0];
            if (!file) return;
            imgPickBtn.textContent = 'Загружаем…';
            try {
                const fd = new FormData();
                fd.append('kind', 'image');
                fd.append('file', file);
                const res = await api.upload('/admin/uploads', fd);
                imageKey = res.key;
                imageUrl = res.url;
                imgPickBtn.textContent = file.name;
                clear(imgPreview);
                imgPreview.appendChild(el('img', {
                    src: imageUrl,
                    class: 'broadcast-img-preview',
                    alt: '',
                }));
                refreshPreview();
            } catch (err) {
                imgPickBtn.textContent = err?.message || 'Ошибка загрузки';
            }
        });

        // Buttons editor
        const btnRows = [];
        const btnsContainer = el('div', { class: 'broadcast-buttons-editor' });
        const addBtnRowBtn = el('button', { class: 'btn-add-row', type: 'button', text: '+ Добавить кнопку' });
        const btnsField = field('Кнопки', el('div', null, [btnsContainer, addBtnRowBtn]));

        function addBtnRow(initial = {}) {
            const labelInp = el('input', { type: 'text', placeholder: 'Текст кнопки', value: initial.label || '' });
            const urlInp = el('input', { type: 'text', placeholder: 'https://...', value: initial.url || '' });
            const colorInp = el('input', { type: 'color', value: initial.color || '#8b5cf6' });
            const removeBtn = el('button', {
                class: 'admin-btn admin-btn-danger admin-btn-sm',
                type: 'button',
                text: '×',
            });
            const rowEl = el('div', { class: 'broadcast-btn-row' }, [labelInp, urlInp, colorInp, removeBtn]);
            const rowData = { el: rowEl, labelInp, urlInp, colorInp };
            btnRows.push(rowData);
            btnsContainer.appendChild(rowEl);

            removeBtn.addEventListener('click', () => {
                const idx = btnRows.indexOf(rowData);
                if (idx !== -1) btnRows.splice(idx, 1);
                rowEl.remove();
                refreshPreview();
            });
            [labelInp, urlInp, colorInp].forEach(i => i.addEventListener('input', refreshPreview));
        }

        addBtnRowBtn.addEventListener('click', () => { addBtnRow(); refreshPreview(); });

        // Preview
        const previewBox = el('div', { class: 'broadcast-preview' });
        previewCol.appendChild(el('div', { class: 'admin-hint', text: 'Предпросмотр', style: { marginBottom: '8px', fontSize: '13px' } }));
        previewCol.appendChild(previewBox);

        const flashSlot = el('div');
        const submitBtn = el('button', { class: 'admin-btn', text: 'Опубликовать', type: 'button' });

        const form = el('form', { class: 'admin-form' }, [
            kindField.wrapper,
            titleField.wrapper,
            bodyField.wrapper,
            imageField.wrapper,
            btnsField.wrapper,
            submitBtn,
            flashSlot,
        ]);
        formCol.appendChild(form);

        function refreshPreview() {
            clear(previewBox);
            const kind = kindSel.value;
            const titleVal = titleInp.value.trim() || '(заголовок)';
            if (kind === 'notification') {
                previewBox.appendChild(el('div', { class: 'broadcast-bar', style: { position: 'relative', inset: 'auto', margin: '0' } }, [
                    el('span', { class: 'broadcast-bar-title', text: titleVal }),
                ]));
            } else {
                if (imageUrl) {
                    previewBox.appendChild(el('img', {
                        src: imageUrl,
                        style: { maxWidth: '100%', maxHeight: '160px', objectFit: 'contain', borderRadius: '10px', marginBottom: '10px', display: 'block' },
                        alt: '',
                    }));
                }
                previewBox.appendChild(el('h3', { text: titleVal, style: { margin: '0 0 8px', fontSize: '16px' } }));
                if (bodyArea.value) {
                    const bodyDiv = el('div', { class: 'broadcast-card-body' });
                    bodyDiv.appendChild(renderFormatted(bodyArea.value));
                    previewBox.appendChild(bodyDiv);
                }
                // Render button previews
                const validBtns = btnRows.filter(r => r.labelInp.value.trim());
                if (validBtns.length) {
                    const btnRowEl = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' } });
                    for (const r of validBtns) {
                        btnRowEl.appendChild(el('a', {
                            href: '#',
                            class: 'broadcast-card-btn',
                            text: r.labelInp.value,
                            style: { background: r.colorInp.value },
                            onclick: e => e.preventDefault(),
                        }));
                    }
                    previewBox.appendChild(btnRowEl);
                }
            }
        }

        function getBannerMeta() {
            const validBtns = btnRows.filter(r => r.labelInp.value.trim());
            if (!validBtns.length) return null;
            return JSON.stringify({
                buttons: validBtns.map(r => ({
                    label: r.labelInp.value.trim(),
                    url: r.urlInp.value.trim(),
                    color: r.colorInp.value,
                })),
            });
        }

        kindSel.addEventListener('change', () => {
            const isBanner = kindSel.value === 'banner';
            bodyField.wrapper.style.display = isBanner ? '' : 'none';
            imageField.wrapper.style.display = isBanner ? '' : 'none';
            btnsField.wrapper.style.display = isBanner ? '' : 'none';
            refreshPreview();
        });
        titleInp.addEventListener('input', refreshPreview);
        bodyArea.addEventListener('input', refreshPreview);

        submitBtn.addEventListener('click', async () => {
            clear(flashSlot);
            const kind = kindSel.value;
            const title = titleInp.value.trim();
            if (!title) { flashSlot.appendChild(flash('Введите заголовок', true)); return; }

            submitBtn.disabled = true;
            try {
                await api.post('/admin/broadcasts', {
                    kind,
                    title,
                    body: kind === 'banner' ? bodyArea.value || null : null,
                    image_key: kind === 'banner' ? imageKey : null,
                    meta: kind === 'banner' ? getBannerMeta() : null,
                });
                flashSlot.appendChild(flash('Опубликовано'));
                titleInp.value = '';
                bodyArea.value = '';
                imgFileInput.value = '';
                imageKey = null;
                imageUrl = null;
                imgPickBtn.textContent = 'Выбрать картинку';
                clear(imgPreview);
                // Clear button rows
                btnRows.length = 0;
                clear(btnsContainer);
                refreshPreview();
                refreshList();
            } catch (err) {
                flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
            } finally {
                submitBtn.disabled = false;
            }
        });

        // --- List ---
        const listSlot = el('div');
        listCard.appendChild(listSlot);

        async function refreshList() {
            clear(listSlot);
            listSlot.appendChild(el('div', { class: 'admin-hint', text: 'Загружаем…' }));
            try {
                const res = await api.get('/admin/broadcasts');
                clear(listSlot);
                if (!res.items.length) {
                    listSlot.appendChild(el('div', { class: 'admin-hint', text: 'Пока ничего нет.' }));
                    return;
                }
                for (const it of res.items) {
                    const row = el('div', { class: 'broadcast-list-item' }, [
                        el('div', null, [
                            el('div', { class: 'broadcast-list-title', text: `${it.kind === 'banner' ? '🪧 ' : '🔔 '}${it.title}` }),
                            el('div', { class: 'broadcast-list-meta', text: `${formatTs(it.created_at)} · ${it.author || '—'} · ${it.is_active ? 'активна' : 'скрыта'}` }),
                        ]),
                        it.is_active ? el('button', {
                            class: 'admin-btn admin-btn-danger admin-btn-sm',
                            text: 'Скрыть',
                            onclick: async () => {
                                if (!confirm('Скрыть это сообщение?')) return;
                                await api.delete(`/admin/broadcasts/${it.id}`);
                                refreshList();
                            },
                        }) : null,
                    ]);
                    listSlot.appendChild(row);
                }
            } catch (err) {
                clear(listSlot);
                listSlot.appendChild(flash(err?.message || 'Ошибка', true));
            }
        }

        // Initial state
        kindSel.dispatchEvent(new Event('change'));
        refreshPreview();
        refreshList();
    }

    // Wrap selection in textarea
    function wrapSelection(textarea, before, after) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        const selected = val.slice(start, end) || 'текст';
        textarea.value = val.slice(0, start) + before + selected + after + val.slice(end);
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
        textarea.dispatchEvent(new Event('input'));
    }

    // ============================================================
    // Content (Albums + Tracks)
    // ============================================================

    function renderContentSection(host) {
        const state = { albums: [], selectedId: null };

        const titleRow = el('div', { class: 'admin-content-head' }, [
            el('div', null, [
                el('h2', { text: 'Дискография' }),
                el('p', { class: 'admin-hint', text: 'Карточки, редактор альбомов и песни работают в одном стиле с сайтом.' }),
            ]),
        ]);
        const gridSlot = el('div');
        const detailSlot = el('div');
        host.appendChild(titleRow);
        host.appendChild(gridSlot);
        host.appendChild(detailSlot);

        refreshAlbums();

        async function refreshAlbums(selectId = state.selectedId) {
            clear(gridSlot);
            gridSlot.appendChild(el('div', { class: 'admin-hint', text: 'Загружаем…' }));
            try {
                const res = await api.get('/admin/content/albums');
                const dbAlbums = (res.albums || []).map(normalizeAdminAlbum);
                const dbIds = new Set(dbAlbums.map(a => a.id));
                const legacyAlbums = getBundledAlbums()
                    .filter(a => !dbIds.has(a.id))
                    .map((a, idx) => normalizeAdminAlbum({ ...a, sort_order: 10_000 + idx, _legacy: true }));

                state.albums = [...dbAlbums, ...legacyAlbums].sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));
                renderAlbumCards();

                const selected = state.albums.find(a => a.id === selectId && !a._legacy);
                if (selected) renderAlbumEditor(selected);
                else clear(detailSlot);
            } catch (err) {
                clear(gridSlot);
                gridSlot.appendChild(flash(err?.message || 'Ошибка', true));
            }
        }

        function renderAlbumCards() {
            clear(gridSlot);
            const grid = el('div', { class: 'admin-albums-grid' });
            gridSlot.appendChild(grid);

            for (const album of state.albums) {
                const card = el('div', {
                    class: `album-card admin-album-card${state.selectedId === album.id ? ' active' : ''}`,
                    draggable: album._legacy ? 'false' : 'true',
                    dataset: { albumId: String(album.id), legacy: album._legacy ? 'true' : 'false' },
                    onclick: async () => {
                        if (album._legacy) {
                            const imported = await importBundledAlbum(album);
                            if (imported) {
                                state.selectedId = imported;
                                await refreshAlbums(imported);
                            }
                            return;
                        }
                        state.selectedId = album.id;
                        renderAlbumCards();
                        renderAlbumEditor(album);
                    },
                }, [
                    album.cover
                        ? el('img', { src: album.cover, alt: album.title })
                        : el('div', { class: 'admin-album-cover-placeholder', text: '♪' }),
                    el('h3', { text: album.title }),
                    el('p', { text: album._legacy ? `${album.year} · импорт` : album.year }),
                ]);
                grid.appendChild(card);
            }

            grid.appendChild(el('button', {
                class: 'admin-create-album-card',
                type: 'button',
                onclick: () => {
                    state.selectedId = null;
                    renderAlbumCards();
                    renderCreateAlbum();
                },
            }, [
                el('span', { class: 'admin-create-plus', text: '+' }),
                el('strong', { text: 'Создать альбом' }),
            ]));

            makeDraggable(grid, '.admin-album-card:not([data-legacy="true"])', async (orderedIds) => {
                const items = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
                if (items.length) await api.patch('/admin/content/albums/reorder', { items });
            });
        }

        function renderCreateAlbum() {
            clear(detailSlot);
            detailSlot.appendChild(buildAlbumForm({
                title: '',
                year: '',
                cover: '',
                cover_key: null,
                tracks: [],
            }, async (album, values, flashSlot, saveBtn) => {
                if (!values.title || !values.year) {
                    flashSlot.appendChild(flash('Название и год обязательны', true));
                    return;
                }
                saveBtn.disabled = true;
                try {
                    const res = await api.post('/admin/content/albums', {
                        title: values.title,
                        year: values.year,
                        cover_key: values.coverKey,
                        sort_order: state.albums.filter(a => !a._legacy).length,
                    });
                    state.selectedId = res.id;
                    await refreshAlbums(res.id);
                } catch (err) {
                    flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                } finally {
                    saveBtn.disabled = false;
                }
            }));
        }

        function renderAlbumEditor(album) {
            clear(detailSlot);
            detailSlot.appendChild(buildAlbumForm(album, async (album, values, flashSlot, saveBtn) => {
                if (!values.title || !values.year) {
                    flashSlot.appendChild(flash('Название и год обязательны', true));
                    return;
                }
                saveBtn.disabled = true;
                try {
                    await api.put(`/admin/content/albums/${album.id}`, {
                        title: values.title,
                        year: values.year,
                        cover_key: values.coverKey,
                        sort_order: album.sort_order || 0,
                    });
                    flashSlot.appendChild(flash('Альбом сохранён'));
                    await refreshAlbums(album.id);
                } catch (err) {
                    flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                } finally {
                    saveBtn.disabled = false;
                }
            }));
        }

        function buildAlbumForm(album, onSave) {
            let coverKey = album.cover_key || null;
            let coverUrl = album.cover || album.cover_url || '';
            const flashSlot = el('div');
            const titleInp = el('input', { type: 'text', maxlength: 200, value: album.title || '', placeholder: 'Название альбома' });
            const yearInp = el('input', { type: 'text', maxlength: 16, value: album.year || '', placeholder: 'Год' });
            const coverBtn = el('button', { class: 'admin-cover-picker', type: 'button', title: 'Выбрать обложку' });

            function renderCover() {
                clear(coverBtn);
                coverBtn.appendChild(coverUrl
                    ? el('img', { src: coverUrl, alt: '' })
                    : el('span', { text: 'Обложка' }));
            }
            renderCover();

            const coverInput = el('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
            coverBtn.addEventListener('click', () => coverInput.click());
            coverInput.addEventListener('change', async () => {
                const file = coverInput.files?.[0];
                coverInput.value = '';
                if (!file) return;
                coverUrl = URL.createObjectURL(file);
                renderCover();
                try {
                    const uploaded = await uploadFile('cover', file);
                    coverKey = uploaded.key;
                    coverUrl = uploaded.url;
                    renderCover();
                } catch (err) {
                    clear(flashSlot);
                    flashSlot.appendChild(flash(err?.message || 'Ошибка загрузки обложки', true));
                }
            });

            const saveBtn = el('button', { class: 'admin-btn', type: 'button', text: album.id ? 'Сохранить альбом' : 'Создать альбом' });
            saveBtn.addEventListener('click', () => {
                clear(flashSlot);
                onSave(album, {
                    title: titleInp.value.trim(),
                    year: yearInp.value.trim(),
                    coverKey,
                }, flashSlot, saveBtn);
            });

            const actions = [saveBtn, flashSlot];
            if (album.id) {
                actions.unshift(el('button', {
                    class: 'admin-btn admin-btn-danger',
                    type: 'button',
                    text: 'Удалить альбом',
                    onclick: async () => {
                        if (!confirm(`Удалить альбом «${album.title}» вместе со всеми треками?`)) return;
                        await api.delete(`/admin/content/albums/${album.id}`);
                        state.selectedId = null;
                        await refreshAlbums(null);
                    },
                }));
            }

            const top = el('div', { class: 'admin-album-editor-head' }, [
                coverBtn,
                coverInput,
                el('div', { class: 'admin-album-editor-fields' }, [
                    titleInp,
                    yearInp,
                    el('div', { class: 'admin-inline-actions' }, actions),
                ]),
            ]);

            const children = [top];
            if (album.id) {
                children.push(renderTracksEditor(album));
            }

            return el('div', { class: 'admin-album-editor' }, children);
        }

        function renderTracksEditor(album) {
            const trackList = el('div', { class: 'admin-track-list' });
            for (const track of album.tracks || []) {
                trackList.appendChild(renderTrackEditorRow(album, track));
            }

            makeDraggable(trackList, '.admin-track-row', async (orderedIds) => {
                const items = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
                if (items.length) await api.patch('/admin/content/tracks/reorder', { items });
                await refreshAlbums(album.id);
            });

            return el('div', { class: 'admin-tracks-editor' }, [
                el('h3', { text: 'Песни' }),
                trackList,
                buildTrackForm(album, null),
            ]);
        }

        function renderTrackEditorRow(album, track) {
            const body = el('div', { class: 'admin-track-edit-body' });
            const row = el('div', {
                class: 'admin-track-row',
                draggable: 'true',
                dataset: { trackId: String(track.id) },
            }, [
                el('div', { class: 'track-number', text: String((album.tracks || []).indexOf(track) + 1) }),
                el('div', { class: 'track-info' }, [
                    el('div', { class: 'track-title', text: track.title }),
                    el('div', { class: 'track-artist', text: `${track.artist} · ${track.duration}` }),
                ]),
                el('button', {
                    class: 'admin-icon-btn',
                    type: 'button',
                    title: 'Редактировать песню',
                    text: '✎',
                    onclick: () => {
                        if (body.childNodes.length) clear(body);
                        else body.appendChild(buildTrackForm(album, track));
                    },
                }),
                el('span', { class: 'drag-handle', title: 'Переместить', text: '⠿' }),
            ]);
            return el('div', null, [row, body]);
        }

        function buildTrackForm(album, track) {
            let audioKey = track?.audio_key ?? undefined;
            let lrc = track?.lrc ?? undefined;
            let durationValue = track?.duration || '';
            let isUploadingAudio = false;
            const flashSlot = el('div');
            const titleInp = el('input', { type: 'text', placeholder: 'Название песни', value: track?.title || '' });
            const artistInp = el('input', { type: 'text', placeholder: 'Исполнитель', value: track?.artist || 'CUPSIZE' });
            const durationLabel = el('div', {
                class: `admin-track-duration-chip${durationValue ? '' : ' empty'}`,
                text: durationValue ? `Длительность: ${durationValue}` : 'Длительность определится после загрузки аудио',
            });
            const audioInput = el('input', { type: 'file', accept: 'audio/*,.m4a,audio/mp4', style: { display: 'none' } });
            const lrcInput = el('input', { type: 'file', accept: '.lrc,text/plain', style: { display: 'none' } });
            const audioLabel = el('span', { class: 'admin-hint', text: track?.audio_key ? 'Аудио уже загружено' : '' });
            const lrcLabel = el('span', { class: 'admin-hint', text: track?.lrc ? 'Текст загружен' : '' });
            let saveBtn = null;

            function setDuration(value) {
                durationValue = value || '';
                durationLabel.textContent = durationValue
                    ? `Длительность: ${durationValue}`
                    : 'Длительность определится после загрузки аудио';
                durationLabel.classList.toggle('empty', !durationValue);
            }

            function updateSaveState() {
                if (saveBtn) saveBtn.disabled = isUploadingAudio;
            }

            audioInput.addEventListener('change', async () => {
                const file = audioInput.files?.[0];
                audioInput.value = '';
                if (!file) return;
                isUploadingAudio = true;
                updateSaveState();
                audioLabel.textContent = 'Читаем длительность…';
                const duration = await readAudioDuration(file);
                setDuration(duration);
                audioLabel.textContent = 'Загружаем аудио…';
                try {
                    const uploaded = await uploadFile('audio', file);
                    audioKey = uploaded.key;
                    audioLabel.textContent = duration ? file.name : `${file.name} · длительность не определилась`;
                } catch (err) {
                    audioLabel.textContent = err?.message || 'Ошибка загрузки';
                } finally {
                    isUploadingAudio = false;
                    updateSaveState();
                }
            });

            lrcInput.addEventListener('change', async () => {
                const file = lrcInput.files?.[0];
                lrcInput.value = '';
                if (!file) return;
                lrc = await file.text();
                lrcLabel.textContent = file.name;
            });

            saveBtn = el('button', { class: 'admin-btn admin-btn-sm', type: 'button', text: track ? 'Сохранить песню' : 'Добавить песню' });
            saveBtn.addEventListener('click', async () => {
                clear(flashSlot);
                const title = titleInp.value.trim();
                const duration = durationValue;
                if (!title) {
                    flashSlot.appendChild(flash('Название обязательно', true));
                    return;
                }
                if (isUploadingAudio) {
                    flashSlot.appendChild(flash('Дождитесь окончания загрузки аудио', true));
                    return;
                }
                if (!audioKey) {
                    flashSlot.appendChild(flash('Загрузите аудио', true));
                    return;
                }
                if (!duration) {
                    flashSlot.appendChild(flash('Не удалось определить длительность аудио', true));
                    return;
                }
                saveBtn.disabled = true;
                try {
                    const payload = {
                        album_id: album.id,
                        title,
                        artist: artistInp.value.trim() || 'CUPSIZE',
                        duration,
                        audio_key: audioKey,
                        lrc,
                        sort_order: track?.sort_order ?? (album.tracks || []).length,
                    };
                    if (track) await api.put(`/admin/content/tracks/${track.id}`, payload);
                    else await api.post('/admin/content/tracks', payload);
                    await refreshAlbums(album.id);
                } catch (err) {
                    flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                } finally {
                    saveBtn.disabled = false;
                }
            });

            const buttons = [
                el('button', { class: 'admin-btn admin-btn-secondary admin-btn-sm', type: 'button', text: 'Аудио', onclick: () => audioInput.click() }),
                audioInput,
                audioLabel,
                el('button', { class: 'admin-btn admin-btn-secondary admin-btn-sm', type: 'button', text: 'Текст LRC', onclick: () => lrcInput.click() }),
                lrcInput,
                lrcLabel,
            ];
            if (track) {
                buttons.push(el('button', {
                    class: 'admin-btn admin-btn-danger admin-btn-sm',
                    type: 'button',
                    text: 'Удалить',
                    onclick: async () => {
                        if (!confirm(`Удалить трек «${track.title}»?`)) return;
                        await api.delete(`/admin/content/tracks/${track.id}`);
                        await refreshAlbums(album.id);
                    },
                }));
            }

            return el('div', { class: 'admin-track-form' }, [
                el('div', { class: 'admin-track-form-grid' }, [titleInp, artistInp, durationLabel]),
                el('div', { class: 'admin-track-upload-row' }, buttons),
                el('div', { class: 'admin-inline-actions' }, [saveBtn, flashSlot]),
            ]);
        }

        async function importBundledAlbum(album) {
            if (!confirm(`Добавить «${album.title}» в базу, чтобы редактировать его в админке?`)) return null;
            try {
                const created = await api.post('/admin/content/albums', {
                    id: album.id,
                    title: album.title,
                    year: album.year,
                    cover_key: album.raw_cover || album.cover,
                    sort_order: album.sort_order || 0,
                });
                for (const [idx, track] of (album.tracks || []).entries()) {
                    await api.post('/admin/content/tracks', {
                        id: track.id,
                        album_id: album.id,
                        title: track.title,
                        artist: track.artist || 'CUPSIZE',
                        duration: track.duration,
                        audio_key: typeof getAudioPath === 'function' ? getAudioPath(track) : null,
                        sort_order: idx,
                    });
                }
                return created.id || album.id;
            } catch (err) {
                alert(err?.message || 'Не удалось импортировать альбом');
                return null;
            }
        }
    }

    function normalizeAdminAlbum(album) {
        const sourceCover = album.cover || album.cover_url || '';
        return {
            ...album,
            cover: toAdminAssetUrl(sourceCover),
            raw_cover: album.raw_cover || album.cover_key || sourceCover,
            cover_key: album.cover_key ?? album.coverKey ?? null,
            sort_order: Number(album.sort_order || album.sortOrder || 0),
            tracks: (album.tracks || []).map(track => ({
                ...track,
                albumId: track.albumId || track.album_id || album.id,
                audio_key: track.audio_key ?? track.audioKey ?? null,
                audioUrl: track.audioUrl || track.audio_url || track.audio || null,
                sort_order: Number(track.sort_order || track.sortOrder || 0),
            })),
            _legacy: !!album._legacy,
        };
    }

    function toAdminAssetUrl(url) {
        if (!url || /^https?:\/\//i.test(url) || url.startsWith('../') || url.startsWith('/')) return url || '';
        if (url.startsWith('preview/') || url.startsWith('audio/')) return `../${url}`;
        return url;
    }

    function getBundledAlbums() {
        const source = getCatalogAlbums();
        return source.length ? source : [];
    }

    function getCatalogAlbums() {
        try {
            if (window.LifonCatalog?.albums) return window.LifonCatalog.albums;
            return typeof albums !== 'undefined' && Array.isArray(albums) ? albums : [];
        } catch {
            return [];
        }
    }

    async function uploadFile(kind, file) {
        const fd = new FormData();
        fd.append('kind', kind);
        fd.append('file', file);
        return api.upload('/admin/uploads', fd);
    }

    function readAudioDuration(file) {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            const url = URL.createObjectURL(file);
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(url);
                resolve(formatDuration(audio.duration));
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                resolve('');
            };
            audio.src = url;
        });
    }

    // ============================================================
    // Uploads (Файлы)
    // ============================================================

    function renderUploadsSection(host) {
        host.appendChild(el('div', { class: 'admin-card' }, [
            el('h2', { text: 'Прямая загрузка в R2' }),
            el('p', { class: 'admin-hint', text: 'Возвращает key и публичный URL.' }),
            buildUploadForm(),
        ]));
    }

    function buildUploadForm() {
        const kindSel = field('Тип файла', el('select', null, [
            el('option', { value: 'image', text: 'Картинка (для баннеров)' }),
            el('option', { value: 'cover', text: 'Обложка альбома' }),
            el('option', { value: 'audio', text: 'Аудио' }),
            el('option', { value: 'avatar', text: 'Аватарка' }),
            el('option', { value: 'lrc', text: 'LRC-файл' }),
        ]));
        const fileInput = el('input', { type: 'file' });
        const result = el('div', { class: 'admin-hint', text: 'Результат появится здесь.' });
        const flashSlot = el('div');

        const submit = el('button', {
            class: 'admin-btn',
            text: 'Загрузить',
            type: 'button',
            onclick: async () => {
                clear(flashSlot);
                const file = fileInput.files?.[0];
                if (!file) { flashSlot.appendChild(flash('Выберите файл', true)); return; }
                submit.disabled = true;
                try {
                    const fd = new FormData();
                    fd.append('kind', kindSel.input.value);
                    fd.append('file', file);
                    const res = await api.upload('/admin/uploads', fd);
                    result.textContent = '';
                    result.appendChild(el('div', { text: `key: ${res.key}` }));
                    result.appendChild(el('div', { text: `url: ${res.url}` }));
                } catch (err) {
                    flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                } finally {
                    submit.disabled = false;
                }
            },
        });

        return el('form', { class: 'admin-form' }, [kindSel.wrapper, field('Файл', fileInput).wrapper, submit, result, flashSlot]);
    }

    // ============================================================
    // Drag-and-drop helper
    // ============================================================

    /**
     * makeDraggable(container, itemSelector, onReorder)
     * Attaches HTML5 drag events to children matching itemSelector.
     * onReorder(orderedIds) is called with array of numeric IDs (from data-album-id or data-track-id).
     */
    function makeDraggable(container, itemSelector, onReorder) {
        let dragSrc = null;
        let dragSrcUnit = null;

        function getItems() {
            return Array.from(container.children)
                .map(child => child.matches(itemSelector) ? child : child.querySelector(itemSelector))
                .filter(Boolean);
        }

        function getItemId(el) {
            return Number(el.dataset.albumId || el.dataset.trackId || 0);
        }

        function getDirectUnit(el) {
            let unit = el;
            while (unit && unit.parentElement !== container) unit = unit.parentElement;
            return unit || el;
        }

        function clearDropIndicators() {
            getItems().forEach(i => { i.classList.remove('drag-over-top', 'drag-over-bottom'); });
        }

        container.addEventListener('dragstart', (e) => {
            dragSrc = e.target.closest(itemSelector);
            if (!dragSrc) return;
            dragSrcUnit = getDirectUnit(dragSrc);
            dragSrc.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        container.addEventListener('dragend', () => {
            if (dragSrc) dragSrc.classList.remove('dragging');
            clearDropIndicators();
            dragSrc = null;
            dragSrcUnit = null;
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            clearDropIndicators();
            const target = e.target.closest(itemSelector);
            if (!target || target === dragSrc) return;
            const rect = target.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                target.classList.add('drag-over-top');
            } else {
                target.classList.add('drag-over-bottom');
            }
        });

        container.addEventListener('dragleave', (e) => {
            if (!container.contains(e.relatedTarget)) clearDropIndicators();
        });

        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest(itemSelector);
            const targetUnit = target ? getDirectUnit(target) : null;
            if (!target || !dragSrc || !dragSrcUnit || !targetUnit || target === dragSrc || targetUnit === dragSrcUnit) {
                clearDropIndicators();
                return;
            }
            const rect = target.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (e.clientY < mid) {
                container.insertBefore(dragSrcUnit, targetUnit);
            } else {
                container.insertBefore(dragSrcUnit, targetUnit.nextSibling);
            }
            clearDropIndicators();

            const orderedIds = getItems().map(getItemId).filter(Boolean);
            Promise.resolve(onReorder(orderedIds)).catch(err => {
                console.error('Failed to save order:', err);
            });
        });
    }

    // ============================================================
    // Supporters (Поддержка)
    // ============================================================

    function renderSupportersSection(host) {
        const listSlot = el('div');
        const flashSlot = el('div');

        const card = el('div', { class: 'admin-card' }, [
            el('h2', { text: 'Карточки поддержки' }),
            el('p', { class: 'admin-hint', text: 'Порядок меняется перетаскиванием. Цвет применяется к аватарке.' }),
            listSlot,
            flashSlot,
            buildAddSupporterForm(),
        ]);
        host.appendChild(card);

        refreshSupporters();

        async function refreshSupporters() {
            clear(listSlot);
            listSlot.appendChild(el('div', { class: 'admin-hint', text: 'Загружаем…' }));
            try {
                const res = await api.get('/admin/supporters');
                clear(listSlot);
                renderSupporterList(res.supporters || []);
            } catch (err) {
                clear(listSlot);
                listSlot.appendChild(flash(err?.message || 'Ошибка загрузки', true));
            }
        }

        function renderSupporterList(items) {
            const list = el('div', { class: 'admin-track-list', style: { marginBottom: '16px' } });

            for (const s of items) {
                list.appendChild(buildSupporterRow(s));
            }

            makeDraggable(list, '.supporter-admin-row', async (orderedIds) => {
                const reorderItems = orderedIds.map((id, idx) => ({ id, sort_order: idx }));
                try {
                    await api.patch('/admin/supporters/reorder', { items: reorderItems });
                } catch (err) {
                    clear(flashSlot);
                    flashSlot.appendChild(flash(err?.message || 'Ошибка сохранения порядка', true));
                }
            });

            listSlot.appendChild(list);
        }

        function buildSupporterRow(s) {
            const editBody = el('div', { class: 'admin-track-edit-body' });

            const initial = (s.name || '?')[0].toUpperCase();
            const avatar = el('div', {
                class: 'supporter-avatar',
                text: initial,
                style: { background: s.color + '22', borderColor: s.color + '44', color: s.color, flexShrink: '0', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: '700', fontSize: '13px', border: '1px solid' },
            });

            const row = el('div', {
                class: 'admin-track-row supporter-admin-row',
                draggable: 'true',
                dataset: { trackId: String(s.id) },
                style: { cursor: 'default' },
            }, [
                avatar,
                el('div', { class: 'track-info' }, [
                    el('div', { class: 'track-title', text: s.name }),
                    el('div', { class: 'track-artist', text: s.handle }),
                ]),
                el('button', {
                    class: 'admin-icon-btn',
                    type: 'button',
                    title: 'Редактировать',
                    text: '✎',
                    onclick: () => {
                        if (editBody.childNodes.length) { clear(editBody); return; }
                        clear(editBody);
                        editBody.appendChild(buildSupporterEditForm(s, avatar, async (updated) => {
                            clear(flashSlot);
                            try {
                                await api.put(`/admin/supporters/${s.id}`, updated);
                                Object.assign(s, updated);
                                const newInitial = (updated.name || '?')[0].toUpperCase();
                                avatar.textContent = newInitial;
                                avatar.style.background = updated.color + '22';
                                avatar.style.borderColor = updated.color + '44';
                                avatar.style.color = updated.color;
                                row.querySelector('.track-title').textContent = updated.name;
                                row.querySelector('.track-artist').textContent = updated.handle;
                                clear(editBody);
                                flashSlot.appendChild(flash('Сохранено'));
                            } catch (err) {
                                flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                            }
                        }, async () => {
                            clear(flashSlot);
                            if (!confirm(`Удалить «${s.name}»?`)) return;
                            try {
                                await api.delete(`/admin/supporters/${s.id}`);
                                row.closest('.supporter-admin-row')?.parentElement?.remove();
                                const wrapper = editBody.closest('div');
                                wrapper?.remove();
                                flashSlot.appendChild(flash('Удалено'));
                                await refreshSupporters();
                            } catch (err) {
                                flashSlot.appendChild(flash(err?.message || 'Ошибка', true));
                            }
                        }));
                    },
                }),
                el('span', { class: 'drag-handle', title: 'Переместить', text: '⠿' }),
            ]);

            return el('div', null, [row, editBody]);
        }

        function buildSupporterEditForm(s, avatar, onSave, onDelete) {
            const nameInp   = el('input', { type: 'text', placeholder: 'Имя', value: s?.name || '', maxlength: 100 });
            const handleInp = el('input', { type: 'text', placeholder: '@никнейм', value: s?.handle || '', maxlength: 100 });
            const colorInp  = el('input', { type: 'color', value: s?.color || '#8b5cf6', title: 'Цвет аватарки' });
            const saveBtn   = el('button', { class: 'admin-btn admin-btn-sm', type: 'button', text: s ? 'Сохранить' : 'Добавить' });

            colorInp.addEventListener('input', () => {
                if (avatar) {
                    avatar.style.background   = colorInp.value + '22';
                    avatar.style.borderColor  = colorInp.value + '44';
                    avatar.style.color        = colorInp.value;
                }
            });

            saveBtn.addEventListener('click', async () => {
                const name   = nameInp.value.trim();
                const handle = handleInp.value.trim();
                if (!name || !handle) return;
                saveBtn.disabled = true;
                try {
                    await onSave({ name, handle, color: colorInp.value });
                } finally {
                    saveBtn.disabled = false;
                }
            });

            const actions = [saveBtn];
            if (onDelete) {
                actions.push(el('button', {
                    class: 'admin-btn admin-btn-danger admin-btn-sm',
                    type: 'button',
                    text: 'Удалить',
                    onclick: onDelete,
                }));
            }

            return el('div', { class: 'admin-track-form' }, [
                el('div', { class: 'admin-track-form-grid' }, [nameInp, handleInp, colorInp]),
                el('div', { class: 'admin-inline-actions' }, actions),
            ]);
        }

        function buildAddSupporterForm() {
            const formFlash = el('div');
            const fakeAvatar = el('div', {
                style: { display: 'none' },
            });

            const form = buildSupporterEditForm(null, fakeAvatar, async (data) => {
                try {
                    await api.post('/admin/supporters', data);
                    clear(formFlash);
                    formFlash.appendChild(flash('Добавлено'));
                    await refreshSupporters();
                    // Reset inputs
                    form.querySelectorAll('input[type="text"]').forEach(i => { i.value = ''; });
                    form.querySelector('input[type="color"]').value = '#8b5cf6';
                } catch (err) {
                    clear(formFlash);
                    formFlash.appendChild(flash(err?.message || 'Ошибка', true));
                }
            }, null);

            return el('div', { class: 'admin-card', style: { marginTop: '12px' } }, [
                el('h3', { text: 'Добавить поддержавшего', style: { marginBottom: '8px', fontSize: '15px' } }),
                form,
                formFlash,
            ]);
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    function field(label, input) {
        const wrapper = el('div', { class: 'admin-field' }, [
            el('label', { text: label }),
            input,
        ]);
        return { wrapper, input };
    }

    function flash(message, isError = false) {
        return el('div', { class: `admin-flash ${isError ? 'err' : 'ok'}`, text: message });
    }

    function formatTs(unixSec) {
        if (!unixSec) return '—';
        const d = new Date(unixSec * 1000);
        return d.toISOString().replace('T', ' ').slice(0, 16);
    }

    function formatDuration(seconds) {
        if (!Number.isFinite(seconds)) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
})();

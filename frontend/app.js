// Глобальные переменные
let currentUser = null;
let authToken = null;
let likedTracks = new Set();
let currentTrack = null;
let currentAlbum = null;
let isPlaying = false;
let isShuffled = false;
let isRepeating = false;
let playlist = [];
let currentPlaylistIndex = 0;
let isLoginMode = true;
let trackStartTime = null;
let currentListenRecorded = false;
let userStats = null;
let isPlayingFromFavorites = false;
let appSetupDone = false;

const audioPlayer = document.getElementById('audioPlayer');
audioPlayer.crossOrigin = 'anonymous';
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationFrameId = null;
let dominantColor = { r: 138, g: 43, b: 226 }; // Дефолтный фиолетовый

// Кастомные цвета для альбомов
const customAlbumColors = {
    4: { r: 208, g: 141, b: 159 }, // "кажется, в аду прикольно" - неоново-розовый
    5: { r: 210, g: 200, b: 88 }, // "в моих легких выросли цветы" - #d2c858
    7: { r: 200, g: 50, b: 255 }  // "Хайперпоп" - яркий фиолетово-розовый
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', async () => {
    loadLikedTracks();
    await loadCatalogFromServer();
    const maintenance = window.LifonCatalog?.getMaintenanceState?.();
    if (maintenance?.enabled) {
        showMaintenanceScreen(maintenance.message);
        return;
    }
    checkDisclaimer();
    ensureAppSetup();
    loadSupporters();
});

async function loadSupporters() {
    const list = document.getElementById('supportersList');
    if (!list) return;
    try {
        const res = await fetch(`${API_BASE}/supporters`);
        const data = await res.json();
        list.innerHTML = '';
        if (!data.ok || !data.supporters?.length) return;
        for (const s of data.supporters) {
            const initial = (s.name || '?')[0].toUpperCase();
            const item = document.createElement('div');
            item.className = 'supporter-item';
            item.style.cssText = `background:${s.color}18;border-color:${s.color}40;`;
            item.innerHTML = `
                <div class="supporter-left">
                    <div class="supporter-avatar" style="background:${s.color}33;border-color:${s.color}66;color:${s.color}">${initial}</div>
                    <div class="supporter-name">${escapeHtml(s.name)}</div>
                </div>
                <div class="supporter-handle">${escapeHtml(s.handle)}</div>`;
            list.appendChild(item);
        }
    } catch {
        // Тихий фейл — список просто не обновится
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function ensureAppSetup() {
    if (appSetupDone) return;
    setupAudioPlayer();
    setupKeyboardShortcuts();
    loadVolume();
    setupAudioAnalyser();
    setupProgressBarHover();
    setupTrackSaving();
    appSetupDone = true;
}

// Настройка анализатора аудио
function setupAudioAnalyser() {
    audioPlayer.addEventListener('play', () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            const source = audioContext.createMediaElementSource(audioPlayer);
            source.connect(analyser);
            analyser.connect(audioContext.destination);
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        }
        startAudioVisualization();
    });

    audioPlayer.addEventListener('pause', () => {
        stopAudioVisualization();
    });
}

function startAudioVisualization() {
    const lyricsModal = document.getElementById('lyricsModal');
    let rotation = 0;
    let targetScale = 1;
    let currentScale = 1;
    let targetOpacity = 0.2;
    let currentOpacity = 0.2;
    let kickPower = 0;
    let lastBass = 0;
    let currentHue = 0;
    let targetHue = 0;

    function animate() {
        if (!analyser || lyricsModal.classList.contains('hidden') || !isPlaying || lyricsModal.classList.contains('visualizer-off')) {
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        // Анализируем ТОЛЬКО суб-басы (20-60 Hz) - kick drum, bass
        const subBass = dataArray.slice(0, 8).reduce((a, b) => a + b) / 8;
        const kick = dataArray.slice(8, 15).reduce((a, b) => a + b) / 7;
        const high = dataArray.slice(100, 150).reduce((a, b) => a + b) / 50;

        const bass = (subBass * 0.6 + kick * 0.4);
        const bassIntensity = bass / 255;
        const highIntensity = high / 255;

        // Динамическое изменение оттенка
        targetHue = (highIntensity * 50) + (bassIntensity * 30);
        currentHue += (targetHue - currentHue) * 0.2;

        // Применяем изменение оттенка
        const adjustedColor = adjustHue(dominantColor, currentHue);

        // Детекция резкого удара
        const bassDelta = Math.abs(bassIntensity - lastBass);
        if (bassDelta > 0.2 && bassIntensity > 0.6) {
            kickPower = 1;
        }
        lastBass = bassIntensity;

        // РЕЗКИЕ СКАЧКИ без плавности
        if (kickPower > 0) {
            targetScale = 2.5 + (Math.random() * 0.5);
            targetOpacity = 0.6 + (Math.random() * 0.3);
            kickPower -= 0.08;
        } else {
            targetScale = 1 + (bassIntensity * 1.5);
            targetOpacity = 0.15 + (bassIntensity * 0.3);
        }

        // ОЧЕНЬ быстрая интерполяция для дёрганья
        currentScale += (targetScale - currentScale) * 0.85;
        currentOpacity += (targetOpacity - currentOpacity) * 0.9;

        // Быстрое хаотичное вращение
        rotation += 2 + (bassIntensity * 8) + (kickPower * 15);

        lyricsModal.style.setProperty('--wave-scale', currentScale);
        lyricsModal.style.setProperty('--wave-opacity', currentOpacity);
        lyricsModal.style.setProperty('--wave-color', `${adjustedColor.r}, ${adjustedColor.g}, ${adjustedColor.b}`);
        lyricsModal.style.setProperty('--wave-rotation', `${rotation}deg`);

        animationFrameId = requestAnimationFrame(animate);
    }

    animate();
}

// Функция для изменения оттенка цвета
function adjustHue(color, hueShift) {
    // Конвертируем RGB в HSL
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    // Применяем сдвиг оттенка
    h = (h * 360 + hueShift) % 360 / 360;

    // Конвертируем обратно в RGB
    function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    let newR, newG, newB;
    if (s === 0) {
        newR = newG = newB = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        newR = hue2rgb(p, q, h + 1/3);
        newG = hue2rgb(p, q, h);
        newB = hue2rgb(p, q, h - 1/3);
    }

    return {
        r: Math.round(newR * 255),
        g: Math.round(newG * 255),
        b: Math.round(newB * 255)
    };
}

function toggleVisualizer() {
    const lyricsModal = document.getElementById('lyricsModal');
    const isOff = lyricsModal.classList.toggle('visualizer-off');

    // Сохраняем состояние
    localStorage.setItem('visualizer_off', isOff);

    // Обновляем иконку
    const icon = document.getElementById('visualizerIcon');
    if (isOff) {
        icon.style.opacity = '0.5';
    } else {
        icon.style.opacity = '1';
        if (isPlaying) {
            startAudioVisualization();
        }
    }
}

function stopAudioVisualization() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Извлечение доминантного цвета из изображения
function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;

            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            let r = 0, g = 0, b = 0, count = 0;

            // Берем каждый 10-й пиксель для производительности
            for (let i = 0; i < data.length; i += 40) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }

            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);

            // Увеличиваем насыщенность
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const saturation = max === 0 ? 0 : (max - min) / max;

            if (saturation < 0.3) {
                // Если цвет слишком серый, делаем его более насыщенным
                const boost = 1.5;
                r = Math.min(255, Math.floor(r * boost));
                g = Math.min(255, Math.floor(g * boost));
                b = Math.min(255, Math.floor(b * boost));
            }

            resolve({ r, g, b });
        };

        img.onerror = () => {
            // Если ошибка, возвращаем дефолтный цвет
            resolve({ r: 138, g: 43, b: 226 });
        };

        img.src = imageUrl;
    });
}

// Сохранение текущего трека
function saveCurrentTrack() {
    if (currentTrack) {
        const trackData = {
            trackId: currentTrack.id,
            currentTime: audioPlayer.currentTime,
            isPlaying: isPlaying
        };
        localStorage.setItem('current_track', JSON.stringify(trackData));
    }
}

// Восстановление текущего трека
function restoreCurrentTrack() {
    const saved = localStorage.getItem('current_track');
    if (saved) {
        try {
            const trackData = JSON.parse(saved);
            const allTracks = albums.flatMap(a => a.tracks);
            const track = allTracks.find(t => t.id === trackData.trackId);

            if (track) {
                // Загружаем трек без автовоспроизведения
                currentTrack = track;
                const album = albums.find(a => a.id === track.albumId);
                currentAlbum = album;

                // Обновляем UI
                document.getElementById('playerTitle').textContent = track.title;
                document.getElementById('playerArtist').textContent = track.artist;
                const coverUrl = track.cover || album?.cover || '';
                document.getElementById('playerCover').src = coverUrl;

                // Загружаем аудио
                const audioPath = getAudioPath(track);
                if (audioPath) {
                    audioPlayer.src = audioPath;
                    audioPlayer.currentTime = trackData.currentTime || 0;
                }

                updateLikeButton();
                document.getElementById('player').classList.remove('hidden');

                // Если трек играл - продолжаем воспроизведение
                if (trackData.isPlaying) {
                    audioPlayer.play().then(() => {
                        isPlaying = true;
                        updatePlayPauseButton();
                    }).catch(err => {
                        console.log('Autoplay prevented:', err);
                        isPlaying = false;
                        updatePlayPauseButton();
                    });
                }
            }
        } catch (error) {
            console.error('Failed to restore track:', error);
        }
    }
}

// Сохраняем позицию трека периодически
function setupTrackSaving() {
    audioPlayer.addEventListener('timeupdate', () => {
        if (currentTrack && audioPlayer.currentTime > 0) {
            saveCurrentTrack();
        }
    });
}

// Клавиатурные сокращения
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Пробел - play/pause
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            e.preventDefault();
            if (currentTrack) togglePlay();
        }
        // Стрелка влево - предыдущий трек
        if (e.code === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            prevTrack();
        }
        // Стрелка вправо - следующий трек
        if (e.code === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            nextTrack();
        }
        // L - лайк
        if (e.code === 'KeyL' && currentTrack) {
            e.preventDefault();
            toggleLike();
        }
        // Escape - закрыть модальные окна
        if (e.code === 'Escape') {
            const lyricsModal = document.getElementById('lyricsModal');
            if (!lyricsModal.classList.contains('hidden')) {
                toggleLyrics();
            }
        }
    });
}

// Disclaimer
function checkDisclaimer() {
    const disclaimerShown = localStorage.getItem('disclaimer_shown');
    if (disclaimerShown) {
        document.getElementById('disclaimer').classList.add('hidden');
        checkAuth();
    }
}

function acceptDisclaimer() {
    localStorage.setItem('disclaimer_shown', 'true');
    document.getElementById('disclaimer').classList.add('hidden');
    checkAuth();
}

function showAuthScreen() {
    document.getElementById('maintenanceScreen')?.classList.add('hidden');
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
}

function showMaintenanceScreen(message) {
    document.getElementById('disclaimer').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('player').classList.add('hidden');
    document.getElementById('maintenanceMessage').textContent = message || 'Сайт находится на технических работах';
    document.getElementById('maintenanceScreen').classList.remove('hidden');
}

function showAdminLoginFromMaintenance() {
    isLoginMode = true;
    document.getElementById('authTitle').textContent = 'Войти';
    document.getElementById('authButton').textContent = 'Войти';
    document.getElementById('authSwitchText').textContent = 'Нет аккаунта? ';
    document.querySelector('.auth-link').textContent = 'Зарегистрироваться';
    document.getElementById('authError').classList.add('hidden');
    showAuthScreen();
}

// Авторизация
async function checkAuth() {
    authToken = localStorage.getItem('auth_token');
    currentUser = localStorage.getItem('username');

    if (authToken) {
        await loadLikesFromServer();
        showMainApp();
    } else {
        document.getElementById('welcomeScreen').classList.remove('hidden');
    }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;

    const authContent = document.querySelector('.auth-content');
    const authTitle = document.getElementById('authTitle');
    const authButton = document.getElementById('authButton');

    // Добавляем анимацию
    authContent.style.animation = 'none';
    setTimeout(() => {
        authContent.style.animation = 'slideUp 0.3s ease';
    }, 10);

    authTitle.textContent = isLoginMode ? 'Войти' : 'Регистрация';
    authButton.textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    document.getElementById('authSwitchText').textContent = isLoginMode ? 'Нет аккаунта? ' : 'Уже есть аккаунт? ';
    document.querySelector('.auth-link').textContent = isLoginMode ? 'Зарегистрироваться' : 'Войти';
    document.getElementById('authError').classList.add('hidden');
}

async function handleAuth() {
    const username = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('authError');
    const button = document.getElementById('authButton');

    if (!username || !password) {
        errorEl.textContent = 'Заполни все поля';
        errorEl.classList.remove('hidden');
        return;
    }

    button.disabled = true;
    button.textContent = '...';
    errorEl.classList.add('hidden');

    try {
        const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.ok && data.token) {
            authToken = data.token;
            currentUser = username;
            localStorage.setItem('auth_token', authToken);
            localStorage.setItem('username', username);

            await loadCatalogFromServer();
            if (window.LifonCatalog?.getMaintenanceState?.()?.enabled) {
                throw new Error(window.LifonCatalog.getMaintenanceState().message);
            }
            await loadLikesFromServer();
            ensureAppSetup();
            showMainApp();
        } else {
            errorEl.textContent = data.message || data.error || 'Ошибка сервера';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = error?.message || 'Нет соединения';
        errorEl.classList.remove('hidden');
    } finally {
        button.disabled = false;
        button.textContent = isLoginMode ? 'Войти' : 'Зарегистрироваться';
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    authToken = null;
    currentUser = null;
    location.reload();
}

function showMainApp() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('sidebar').classList.remove('hidden');
    document.body.classList.add('app-main-visible');
    restoreSidebarState();
    switchScreen('library'); // Начинаем с библиотеки
    updateProfile();
    restoreCurrentTrack(); // Восстанавливаем последний трек
}

// Лайки
function loadLikedTracks() {
    const saved = localStorage.getItem('liked_tracks');
    if (saved) {
        likedTracks = new Set(JSON.parse(saved));
    }
}

function saveLikedTracks() {
    localStorage.setItem('liked_tracks', JSON.stringify([...likedTracks]));
}

async function loadLikesFromServer() {
    if (!authToken || authToken === 'guest') return;

    try {
        const response = await fetch(`${API_BASE}/likes`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            likedTracks = new Set(data.liked);
            saveLikedTracks();
        }
    } catch (error) {
        console.error('Failed to load likes:', error);
    }
}

async function toggleLike(trackId = null) {
    const id = trackId || currentTrack?.id;
    if (!id) return;

    if (likedTracks.has(id)) {
        likedTracks.delete(id);
        if (authToken && authToken !== 'guest') {
            await fetch(`${API_BASE}/likes`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ track_id: id })
            });
        }
    } else {
        likedTracks.add(id);
        if (authToken && authToken !== 'guest') {
            await fetch(`${API_BASE}/likes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ track_id: id })
            });
        }
    }

    saveLikedTracks();
    updateLikeButton();
    updateFavorites();
    updateProfile();
}

function updateLikeButton() {
    const likeBtn = document.querySelector('.btn-like');
    const likeIcon = document.getElementById('likeIcon');

    if (currentTrack && likedTracks.has(currentTrack.id)) {
        likeBtn.classList.add('liked');
        likeIcon.setAttribute('fill', 'currentColor');
    } else {
        likeBtn.classList.remove('liked');
        likeIcon.setAttribute('fill', 'none');
    }
}

// Навигация
function switchScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`${screen}Screen`).classList.add('active');
    document.querySelector(`[data-screen="${screen}"]`).classList.add('active');

    if (screen === 'favorites') {
        updateFavorites();
    } else if (screen === 'profile') {
        updateProfile();
    } else if (screen === 'library') {
        renderAlbums();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const logo = document.getElementById('sidebarLogo');

    sidebar.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');

    // Переключаем логотип
    if (sidebar.classList.contains('collapsed')) {
        logo.src = 'minlogo.png';
    } else {
        logo.src = 'Logo.png';
    }

    // Сохраняем состояние в localStorage
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
}

// Восстанавливаем состояние сайдбара при загрузке
function restoreSidebarState() {
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    const sidebar = document.getElementById('sidebar');
    const logo = document.getElementById('sidebarLogo');

    if (isCollapsed) {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        logo.src = 'minlogo.png';
    }
}

// Альбомы
function renderAlbumGrid(list) {
    const grid = document.getElementById('albumsGrid');
    LifonDOM.clear(grid);
    for (const album of list) {
        grid.appendChild(LifonRender.albumCard(album, openAlbum));
    }
}

function renderAlbums() {
    renderAlbumGrid(albums);
}

function filterAlbums() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const filtered = albums.filter(a =>
        a.title.toLowerCase().includes(search) ||
        a.year.includes(search)
    );
    renderAlbumGrid(filtered);
}

function openAlbum(albumId) {
    currentAlbum = albums.find(a => a.id === albumId);
    if (!currentAlbum) return;

    document.getElementById('albumCover').src = currentAlbum.cover;
    document.getElementById('albumTitle').textContent = currentAlbum.title;
    document.getElementById('albumYear').textContent = currentAlbum.year;

    const tracksList = document.getElementById('albumTracks');
    LifonDOM.clear(tracksList);
    currentAlbum.tracks.forEach((track, index) => {
        tracksList.appendChild(LifonRender.trackRow({
            track,
            index,
            isCurrent: currentTrack?.id === track.id,
            liked: likedTracks.has(track.id),
            onPlay: (id) => playTrack(id),
            onToggleLike: (id) => toggleLike(id),
        }));
    });

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('albumScreen').classList.add('active');
}

function closeAlbum() {
    document.getElementById('albumScreen').classList.remove('active');
    document.getElementById('libraryScreen').classList.add('active');
}

function playAlbum() {
    if (currentAlbum && currentAlbum.tracks.length > 0) {
        playlist = currentAlbum.tracks;
        currentPlaylistIndex = 0;
        playTrack(playlist[0].id);
    }
}

// Избранное
function updateFavorites() {
    const allTracks = albums.flatMap(a => a.tracks);
    const favorites = allTracks.filter(t => likedTracks.has(t.id));

    const list = document.getElementById('favoritesList');

    LifonDOM.clear(list);

    if (favorites.length === 0) {
        list.appendChild(LifonRender.emptyState('Нет избранных треков'));
        return;
    }

    favorites.forEach((track, index) => {
        list.appendChild(LifonRender.trackRow({
            track,
            index,
            isCurrent: currentTrack?.id === track.id,
            liked: true,
            onPlay: (id) => playTrack(id, true),
            onToggleLike: (id) => toggleLike(id),
        }));
    });
}

// Профиль
async function updateProfile() {
    document.getElementById('profileUsername').textContent = currentUser || 'Пользователь';

    if (authToken && window.LifonAvatar) {
        window.LifonAvatar.mount();
    }

    if (authToken && window.LifonAdminLink) {
        window.LifonAdminLink.refresh();
    }

    // Загружаем статистику с сервера
    if (authToken) {
        userStats = await fetchStats(authToken);
        console.log('User stats:', userStats);

        if (userStats) {
            const totalTime = formatListeningTime(userStats.totalMs);
            const totalListens = userStats.totalListens || 0;

            console.log('Total listens:', totalListens);
            document.getElementById('profileStats').textContent = `Любимых треков: ${likedTracks.size} • Прослушано: ${totalTime} • Треков прослушано: ${totalListens} раз`;

            // Отображаем топ треков если есть
            if (userStats.topTracks && userStats.topTracks.length > 0) {
                displayTopTracks(userStats.topTracks);
            }
        } else {
            document.getElementById('profileStats').textContent = `Любимых треков: ${likedTracks.size}`;
        }
    } else {
        document.getElementById('profileStats').textContent = `Любимых треков: ${likedTracks.size}`;
    }
}

function formatListeningTime(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
        return `${hours} ч ${minutes} мин`;
    }
    return `${minutes} мин`;
}

function displayTopTracks(topTracks) {
    // Находим треки по ID
    const allTracks = albums.flatMap(a => a.tracks);
    const topTracksData = topTracks.map(item => {
        const track = allTracks.find(t => t.id === item.trackId);
        if (!track) return null;
        const album = albums.find(a => a.id === track.albumId);
        return { ...track, playCount: item.playCount, album };
    }).filter(t => t !== null);

    if (topTracksData.length === 0) return;

    // Добавляем секцию топ треков в профиль
    const profileInfo = document.querySelector('.profile-info');
    let topSection = document.getElementById('topTracksSection');

    if (!topSection) {
        topSection = document.createElement('div');
        topSection.id = 'topTracksSection';
        topSection.style.marginTop = '24px';
        topSection.style.paddingTop = '24px';
        topSection.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
        profileInfo.appendChild(topSection);
    }

    const { el, clear } = LifonDOM;
    clear(topSection);

    const positionColor = (pos) => pos === 1 ? '#FFD700' : pos === 2 ? '#B0BEC5' : '#CD7F32';

    const favoriteTrack = topTracksData[0];
    topSection.appendChild(el('div', { style: { marginBottom: '24px' } }, [
        el('h3', {
            text: 'ЛЮБИМЫЙ ТРЕК',
            class: 'profile-section-heading',
        }),
        el('div', {
            class: 'profile-favorite-card',
            onclick: () => playTrack(favoriteTrack.id),
        }, [
            el('img', { src: favoriteTrack.album?.cover || '', class: 'profile-favorite-cover' }),
            el('div', { class: 'profile-favorite-info' }, [
                el('div', { class: 'profile-favorite-title', text: favoriteTrack.title }),
                el('div', { class: 'profile-favorite-artist', text: favoriteTrack.artist }),
            ]),
            el('div', { class: 'profile-favorite-count' }, [
                el('div', { class: 'profile-favorite-count-value', text: String(favoriteTrack.playCount) }),
                el('div', { class: 'profile-favorite-count-label', text: 'раз' }),
            ]),
        ]),
    ]));

    const topList = el('div', null, [
        el('h3', { text: 'ТОП ТРЕКОВ', class: 'profile-section-heading' }),
    ]);
    topTracksData.forEach((track, index) => {
        topList.appendChild(el('div', {
            class: 'profile-top-row',
            onclick: () => playTrack(track.id),
        }, [
            el('div', {
                class: 'profile-top-position',
                style: { color: positionColor(index + 1) },
                text: String(index + 1),
            }),
            el('img', { src: track.album?.cover || '', class: 'profile-top-cover' }),
            el('div', { class: 'profile-top-info' }, [
                el('div', { class: 'profile-top-title', text: track.title }),
                el('div', { class: 'profile-top-artist', text: track.artist }),
            ]),
            el('div', { class: 'profile-top-count', text: `${track.playCount} раз` }),
        ]));
    });
    topSection.appendChild(topList);
}

// Плеер
function setupAudioPlayer() {
    // iOS: Разрешаем воспроизведение в фоне
    audioPlayer.crossOrigin = 'anonymous';
    audioPlayer.setAttribute('playsinline', '');
    audioPlayer.setAttribute('webkit-playsinline', '');

    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', async () => {
        await commitCurrentListen(true);
        nextTrack();
    });
    audioPlayer.addEventListener('pause', () => {
        if (!audioPlayer.ended) commitCurrentListen(false);
    });
    audioPlayer.addEventListener('loadedmetadata', () => {
        document.getElementById('duration').textContent = formatTime(audioPlayer.duration);
        // Обновляем длительность в модальном окне текстов
        const lyricsDuration = document.getElementById('lyricsDuration');
        if (lyricsDuration) {
            lyricsDuration.textContent = formatTime(audioPlayer.duration);
        }
    });

    // iOS: Инициализация аудио контекста при первом взаимодействии
    const initAudioContext = () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        document.removeEventListener('touchstart', initAudioContext);
        document.removeEventListener('click', initAudioContext);
    };
    document.addEventListener('touchstart', initAudioContext);
    document.addEventListener('click', initAudioContext);

    // Media Session API для системных медиа-контролов
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            audioPlayer.play();
            isPlaying = true;
            updatePlayPauseButton();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            audioPlayer.pause();
            isPlaying = false;
            updatePlayPauseButton();
        });
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', nextTrack);

        // iOS: Дополнительные обработчики для seekbar
        try {
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                audioPlayer.currentTime = Math.max(audioPlayer.currentTime - (details.seekOffset || 10), 0);
            });
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                audioPlayer.currentTime = Math.min(audioPlayer.currentTime + (details.seekOffset || 10), audioPlayer.duration);
            });
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (details.seekTime) {
                    audioPlayer.currentTime = details.seekTime;
                }
            });
        } catch (error) {
            console.log('Some media session actions not supported');
        }
    }
}

async function playTrack(trackId, fromFavorites = false) {
    await commitCurrentListen(false);

    const allTracks = albums.flatMap(a => a.tracks);
    const track = allTracks.find(t => t.id === trackId);

    if (!track) return;

    currentTrack = track;
    trackStartTime = Date.now();
    currentListenRecorded = false;

    // Установка плейлиста
    if (fromFavorites) {
        playlist = allTracks.filter(t => likedTracks.has(t.id));
        isPlayingFromFavorites = true;
    } else if (isPlayingFromFavorites && likedTracks.has(trackId)) {
        // Если мы уже в режиме избранного и трек в избранном - оставляем плейлист избранного
        playlist = allTracks.filter(t => likedTracks.has(t.id));
    } else if (currentAlbum) {
        playlist = currentAlbum.tracks;
        isShuffled = false;
        isPlayingFromFavorites = false;
        document.getElementById('shuffleBtn').classList.remove('active');
    } else {
        const album = albums.find(a => a.id === track.albumId);
        playlist = album ? album.tracks : [track];
        isPlayingFromFavorites = false;
    }

    currentPlaylistIndex = playlist.findIndex(t => t.id === trackId);

    // Обновление UI
    document.getElementById('playerTitle').textContent = track.title;
    document.getElementById('playerArtist').textContent = track.artist;

    const album = albums.find(a => a.id === track.albumId);
    currentAlbum = album; // Обновляем currentAlbum для корректной работы модального окна текстов

    // Используем индивидуальную обложку трека, если есть, иначе обложку альбома
    const coverUrl = track.cover || album?.cover || '';
    document.getElementById('playerCover').src = coverUrl;

    // Обновление Media Session
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: album?.title || 'CUPSIZE',
            artwork: [
                { src: coverUrl, sizes: '512x512', type: 'image/jpeg' }
            ]
        });
    }

    // Воспроизведение аудио
    const audioPath = getAudioPath(track);
    if (audioPath) {
        audioPlayer.src = audioPath;
        try {
            await audioPlayer.play();
            isPlaying = true;
        } catch (error) {
            console.error('Failed to play audio:', error);
            isPlaying = false;
        }
    }

    updatePlayPauseButton();
    updateLikeButton();

    document.getElementById('player').classList.remove('hidden');

    // Сохраняем текущий трек в localStorage
    saveCurrentTrack();

    // Обновление списка треков
    document.querySelectorAll('.track-item').forEach(item => {
        item.classList.remove('playing');
    });

    // Подсветка текущего трека
    const currentTrackElement = document.querySelector(`[onclick*="playTrack(${trackId})"]`);
    if (currentTrackElement) {
        currentTrackElement.classList.add('playing');
    }

    // Обновляем текст песни, если модальное окно открыто
    const lyricsModal = document.getElementById('lyricsModal');
    if (!lyricsModal.classList.contains('hidden')) {
        await updateLyricsForCurrentTrack();
    }
}

async function commitCurrentListen(force = false) {
    if (!authToken || authToken === 'guest' || !currentTrack || currentListenRecorded) return;

    const byAudioTime = Number.isFinite(audioPlayer.currentTime) ? Math.floor(audioPlayer.currentTime * 1000) : 0;
    const byWallTime = trackStartTime ? Date.now() - trackStartTime : 0;
    const trackDurationMs = Number.isFinite(audioPlayer.duration) ? audioPlayer.duration * 1000 : 0;
    const rawDurationMs = Math.max(byAudioTime, byWallTime);
    const durationMs = Math.min(rawDurationMs, trackDurationMs || rawDurationMs, 60 * 60 * 1000);
    const listenedEnough = durationMs >= 30000 || (trackDurationMs > 0 && durationMs >= trackDurationMs * 0.5);

    if (!force && !listenedEnough) return;

    currentListenRecorded = true;
    await recordListen(authToken, currentTrack.id, Math.max(durationMs, 1000));
    if (document.getElementById('profileScreen')?.classList.contains('active')) {
        updateProfile();
    }
}

async function updateLyricsForCurrentTrack() {
    if (!currentTrack) return;

    console.log('Updating lyrics for new track:', currentTrack.id, currentTrack.title);

    // Обновляем информацию о треке
    document.getElementById('lyricsTrackTitle').textContent = currentTrack.title;
    document.getElementById('lyricsTrackArtist').textContent = currentTrack.artist;

    // Обновляем обложку
    const album = albums.find(a => a.id === currentTrack.albumId);
    // Используем индивидуальную обложку трека, если есть, иначе обложку альбома
    const coverUrl = currentTrack.cover || album?.cover || '';
    if (coverUrl) {
        document.getElementById('lyricsCover').src = coverUrl;
    }

    // Обновляем иконку play/pause
    updateLyricsPlayIcon();

    // Загружаем новый текст
    const lyricsContainer = document.getElementById('lyricsText');
    lyricsContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Загрузка...</p>';

    stopLyricsSync();

    const lyricsData = await loadLyrics(currentTrack.id);
    console.log('New lyrics data received:', lyricsData);

    if (lyricsData && lyricsData.raw) {
        console.log('Displaying new lyrics, raw length:', lyricsData.raw.length);
        displaySyncLyrics(lyricsData);
        startLyricsSync();
    } else {
        console.error('No lyrics data for new track');
        lyricsContainer.innerHTML = '<div style="text-align: center; padding: 20px 40px;"><img src="zmp.png" style="width: 80px; height: 80px; opacity: 0.3; margin-bottom: 16px;"><p style="color: rgba(255,255,255,0.5);">Текста песни нету</p><p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 8px;">Помогите проекту и создайте синхронизированный текст, обращайтесь за инструкциями в ТГ <a href="https://t.me/videlsvet" style="color: rgba(255,255,255,0.4); text-decoration: none;">@videlsvet</a></p></div>';
    }
}

function togglePlay() {
    if (isPlaying) {
        audioPlayer.pause();
        isPlaying = false;
    } else {
        audioPlayer.play();
        isPlaying = true;
    }
    updatePlayPauseButton();
}

function updatePlayPauseButton() {
    const icon = document.getElementById('playPauseIcon');
    if (isPlaying) {
        // Pause icon (Yandex style)
        icon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
    } else {
        // Play icon (Yandex style)
        icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
    }

    // Обновляем иконку в модальном окне текстов, если оно открыто
    const lyricsModal = document.getElementById('lyricsModal');
    if (!lyricsModal.classList.contains('hidden')) {
        updateLyricsPlayIcon();
    }
}

function prevTrack() {
    if (playlist.length === 0) return;

    if (isShuffled) {
        currentPlaylistIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentPlaylistIndex = (currentPlaylistIndex - 1 + playlist.length) % playlist.length;
    }

    const nextTrackId = playlist[currentPlaylistIndex].id;
    playTrack(nextTrackId);
}

function nextTrack() {
    if (playlist.length === 0) return;

    if (isRepeating) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
        return;
    }

    if (isShuffled) {
        currentPlaylistIndex = Math.floor(Math.random() * playlist.length);
    } else {
        currentPlaylistIndex = (currentPlaylistIndex + 1) % playlist.length;
    }

    const nextTrackId = playlist[currentPlaylistIndex].id;
    playTrack(nextTrackId);
}

function toggleShuffle() {
    isShuffled = !isShuffled;
    document.getElementById('shuffleBtn').classList.toggle('active', isShuffled);
}

function toggleRepeat() {
    isRepeating = !isRepeating;
    document.getElementById('repeatBtn').classList.toggle('active', isRepeating);
}

function updateProgress() {
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    const progressBar = document.getElementById('progressBar');
    const progressFilled = document.querySelector('.player-progress-filled');
    const progressThumb = document.querySelector('.player-progress-thumb');

    progressBar.value = progress || 0;

    // Обновляем визуальные элементы
    if (progressFilled) {
        progressFilled.style.width = `${progress || 0}%`;
    }
    if (progressThumb) {
        progressThumb.style.left = `${progress || 0}%`;
    }

    // Обновляем CSS переменную для совместимости
    progressBar.style.setProperty('--progress-width', `${progress || 0}%`);
    document.getElementById('currentTime').textContent = formatTime(audioPlayer.currentTime);

    // Обновляем прогресс-бар в модальном окне текстов
    const lyricsProgressBar = document.getElementById('lyricsProgressBar');
    const lyricsCurrentTime = document.getElementById('lyricsCurrentTime');
    if (lyricsProgressBar) {
        lyricsProgressBar.value = progress || 0;
    }
    if (lyricsCurrentTime) {
        lyricsCurrentTime.textContent = formatTime(audioPlayer.currentTime);
    }
}

function seekTo(value) {
    const time = (value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = time;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Тексты песен
let currentLyricsLines = [];
let lyricsUpdateInterval = null;

async function toggleLyrics() {
    const modal = document.getElementById('lyricsModal');

    if (modal.classList.contains('hidden')) {
        // Сбрасываем флаги отсчета и лоадера
        window.countdownShown = false;
        window.loaderShown = false;

        if (currentTrack) {
            console.log('Loading lyrics for track:', currentTrack.id, currentTrack.title);

            // Восстанавливаем состояние визуализатора
            const visualizerOff = localStorage.getItem('visualizer_off') === 'true';
            if (visualizerOff) {
                modal.classList.add('visualizer-off');
                document.getElementById('visualizerIcon').style.opacity = '0.5';
            } else {
                modal.classList.remove('visualizer-off');
                document.getElementById('visualizerIcon').style.opacity = '1';
            }

            // Обновляем информацию о треке в модальном окне
            document.getElementById('lyricsTrackTitle').textContent = currentTrack.title;
            document.getElementById('lyricsTrackArtist').textContent = currentTrack.artist;

            // Обновляем обложку и извлекаем доминантный цвет
            // Используем индивидуальную обложку трека, если есть, иначе обложку альбома
            const coverUrl = currentTrack.cover || currentAlbum?.cover || '';
            if (coverUrl) {
                document.getElementById('lyricsCover').src = coverUrl;

                // Проверяем, есть ли кастомный цвет для этого альбома
                if (customAlbumColors[currentAlbum?.id]) {
                    dominantColor = customAlbumColors[currentAlbum.id];
                    console.log('Using custom color for album:', currentAlbum.title, dominantColor);
                } else {
                    // Если кастомного цвета нет, извлекаем из обложки
                    extractDominantColor(coverUrl).then(color => {
                        dominantColor = color;
                        console.log('Dominant color:', color);
                    });
                }
            }

            // Обновляем иконку play/pause
            updateLyricsPlayIcon();

            const lyricsContainer = document.getElementById('lyricsText');
            lyricsContainer.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.5); padding: 40px;">Загрузка...</p>';

            const lyricsData = await loadLyrics(currentTrack.id);
            console.log('Lyrics data received:', lyricsData);

            if (lyricsData && lyricsData.raw) {
                console.log('Displaying lyrics, raw length:', lyricsData.raw.length);
                displaySyncLyrics(lyricsData);
                startLyricsSync();
            } else {
                console.error('No lyrics data or raw text');
                lyricsContainer.innerHTML = '<div style="text-align: center; padding: 20px 40px;"><img src="zmp.png" style="width: 80px; height: 80px; opacity: 0.3; margin-bottom: 16px;"><p style="color: rgba(255,255,255,0.5);">Текста песни нету</p><p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 8px;">Помогите проекту и создайте синхронизированный текст, обращайтесь за инструкциями в ТГ <a href="https://t.me/videlsvet" style="color: rgba(255,255,255,0.4); text-decoration: none;">@videlsvet</a></p></div>';
            }
        }
        modal.classList.remove('hidden');
        if (isPlaying && !modal.classList.contains('visualizer-off')) {
            startAudioVisualization();
        }
    } else {
        modal.classList.add('hidden');
        stopLyricsSync();
        stopAudioVisualization();
    }
}

function updateLyricsPlayIcon() {
    const icon = document.getElementById('lyricsPlayIcon');
    if (isPlaying) {
        icon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
    } else {
        icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
    }
}

function displaySyncLyrics(lyricsData) {
    const lyricsContainer = document.getElementById('lyricsText');
    lyricsContainer.className = 'lyrics-scroller';

    // Парсим LRC формат
    const lines = lyricsData.raw.split('\n');
    currentLyricsLines = [];

    console.log('Parsing', lines.length, 'lines');

    for (const line of lines) {
        // Строки с временными метками [00:00.00]текст
        const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.+)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const centiseconds = parseInt(match[3]);
            const text = match[4].trim();

            if (text) {
                const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;
                currentLyricsLines.push({
                    time: timeInSeconds,
                    text: text
                });
            }
        }
    }

    console.log('Parsed', currentLyricsLines.length, 'lyrics lines');

    if (currentLyricsLines.length === 0) {
        console.error('No lyrics lines parsed');
        lyricsContainer.innerHTML = '<div style="text-align: center; padding: 20px 40px;"><img src="zmp.png" style="width: 80px; height: 80px; opacity: 0.3; margin-bottom: 16px;"><p style="color: rgba(255,255,255,0.5);">Текста песни нету</p><p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 8px;">Помогите проекту и создайте синхронизированный текст, обращайтесь за инструкциями в ТГ <a href="https://t.me/videlsvet" style="color: rgba(255,255,255,0.4); text-decoration: none;">@videlsvet</a></p></div>';
        return;
    }

    // Создаем HTML для строк
    let html = '';
    currentLyricsLines.forEach((line, index) => {
        html += `<div class="lyrics-line" data-index="${index}" data-time="${line.time}" onclick="seekToLyricLine(${line.time})">${line.text}</div>`;
    });

    // Футер с авторами убран

    lyricsContainer.innerHTML = html;
    console.log('Lyrics HTML set, container has', lyricsContainer.children.length, 'children');

    // Добавляем лоадер поверх текста
    const loader = document.createElement('div');
    loader.className = 'lyrics-loader';
    loader.innerHTML = '<div class="lyrics-loader-element" style="animation-delay: 0.275s;"></div><div class="lyrics-loader-element" style="animation-delay: 0.55s;"></div><div class="lyrics-loader-element" style="animation-delay: 0.825s;"></div><div class="lyrics-loader-element" style="animation-delay: 1.1s;"></div>';
    lyricsContainer.appendChild(loader);

    // Определяем многострочные элементы после рендеринга
    setTimeout(() => {
        const lines = lyricsContainer.querySelectorAll('.lyrics-line');
        lines.forEach(line => {
            // Если высота элемента больше минимальной (80px + padding), значит текст перенесся
            if (line.offsetHeight > 112) { // 80px min-height + 32px padding
                line.setAttribute('data-multiline', 'true');
            }
        });
    }, 100);

    // Запускаем удаление лоадера и отсчет 3-2-1 за 3 секунды до первой строки
    if (currentLyricsLines.length > 0 && typeof showLyricsCountdown === 'function') {
        const firstLineTime = currentLyricsLines[0].time;

        // Если текст начинается сразу (меньше 3 секунд), удаляем лоадер немедленно
        if (firstLineTime < 3) {
            setTimeout(() => {
                const loaderEl = document.querySelector('.lyrics-loader');
                if (loaderEl) loaderEl.remove();
            }, 100);
        } else {
            // Удаляем лоадер и показываем отсчет за 3 секунды
            const countdownTime = firstLineTime - 3;
            const checkCountdown = setInterval(() => {
                if (audioPlayer.currentTime >= countdownTime && audioPlayer.currentTime < firstLineTime && !window.countdownShown) {
                    showLyricsCountdown(firstLineTime);
                    clearInterval(checkCountdown);
                }
            }, 100);
        }
    }
}

function startLyricsSync() {
    stopLyricsSync();
    lyricsUpdateInterval = setInterval(updateLyricsHighlight, 100);
}

function stopLyricsSync() {
    if (lyricsUpdateInterval) {
        clearInterval(lyricsUpdateInterval);
        lyricsUpdateInterval = null;
    }
}

function updateLyricsHighlight() {
    if (!audioPlayer || !currentLyricsLines.length) return;

    const currentTime = audioPlayer.currentTime;
    const lyricsContainer = document.getElementById('lyricsText');

    // Находим текущую строку
    let activeIndex = -1;
    for (let i = 0; i < currentLyricsLines.length; i++) {
        if (currentTime >= currentLyricsLines[i].time) {
            activeIndex = i;
        } else {
            break;
        }
    }

    // Обновляем классы
    const lines = lyricsContainer.querySelectorAll('.lyrics-line');
    lines.forEach((line, index) => {
        line.classList.remove('active', 'past');
        if (index === activeIndex) {
            line.classList.add('active');
            // Плавная прокрутка к активной строке
            line.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (index < activeIndex) {
            line.classList.add('past');
        }
    });
}

function seekToLyricLine(time) {
    if (audioPlayer) {
        // Удаляем лоадер и отсчет при клике на строчку
        const loader = document.querySelector('.lyrics-loader');
        if (loader) loader.remove();
        const countdown = document.querySelector('.lyrics-countdown');
        if (countdown) countdown.remove();
        window.countdownShown = true;

        audioPlayer.currentTime = time;
        if (!isPlaying) {
            togglePlay();
        }
    }
}

// Управление громкостью
function loadVolume() {
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) {
        const volume = parseFloat(savedVolume);
        audioPlayer.volume = volume;
        document.getElementById('volumeSlider').value = volume * 100;
        updateVolumeIcon(volume);
    }
}

function changeVolume(value) {
    const volume = value / 100;
    audioPlayer.volume = volume;
    localStorage.setItem('volume', volume);
    updateVolumeIcon(volume);
}

function toggleMute() {
    if (audioPlayer.volume > 0) {
        audioPlayer.dataset.previousVolume = audioPlayer.volume;
        audioPlayer.volume = 0;
        document.getElementById('volumeSlider').value = 0;
        updateVolumeIcon(0);
    } else {
        const previousVolume = parseFloat(audioPlayer.dataset.previousVolume) || 1;
        audioPlayer.volume = previousVolume;
        document.getElementById('volumeSlider').value = previousVolume * 100;
        updateVolumeIcon(previousVolume);
    }
    localStorage.setItem('volume', audioPlayer.volume);
}

function updateVolumeIcon(volume) {
    const icon = document.getElementById('volumeIcon');
    if (volume === 0) {
        // Volume X (muted) - Heroicons
        icon.innerHTML = '<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z"/>';
    } else if (volume < 0.5) {
        // Volume 1 (low) - Heroicons
        icon.innerHTML = '<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"/>';
    } else {
        // Volume 2 (high) - Heroicons
        icon.innerHTML = '<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z"/><path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"/>';
    }
}

// Настройка задержки скрытия прогресс-бара
function setupProgressBarHover() {
    const progressBg = document.querySelector('.player-progress-background');
    let hoverTimeout = null;

    if (progressBg) {
        progressBg.addEventListener('mouseenter', () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            progressBg.classList.remove('recently-hovered');
        });

        progressBg.addEventListener('mouseleave', () => {
            progressBg.classList.add('recently-hovered');
            hoverTimeout = setTimeout(() => {
                progressBg.classList.remove('recently-hovered');
            }, 1000);
        });
    }
}

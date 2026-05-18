// Wave - "Моя волна" album wheel
let waveCurrentIndex = 0;
let waveInitialized = false;

const albumColors = [
    { r: 194, g: 159, b: 255 },
    { r: 100, g: 180, b: 255 },
    { r: 208, g: 141, b: 159 },
    { r: 210, g: 200, b: 88  },
    { r: 140, g: 220, b: 170 },
    { r: 255, g: 160, b: 100 },
    { r: 200, g: 50,  b: 255 },
    { r: 255, g: 100, b: 130 },
    { r: 130, g: 130, b: 220 },
    { r: 220, g: 180, b: 140 }
];

function initWave() {
    if (waveInitialized) return;
    waveInitialized = true;

    buildWheel();
    waveSelect(0, false);
    setupWaveScroll();
}

function buildWheel() {
    const wheel = document.getElementById('waveWheel');
    if (!wheel) return;

    wheel.innerHTML = albums.map((album, i) => `
        <div class="wave-wheel-item ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="waveSelect(${i})">
            <img class="wave-wheel-item-cover" src="${album.cover}" alt="${album.title}">
            <div class="wave-wheel-item-info">
                <div class="wave-wheel-item-label">Альбом</div>
                <div class="wave-wheel-item-name">${album.title}</div>
            </div>
        </div>
    `).join('');
}

function waveSelect(index, animate) {
    if (animate === undefined) animate = true;
    if (index < 0) index = albums.length - 1;
    if (index >= albums.length) index = 0;
    waveCurrentIndex = index;

    const album = albums[index];
    if (!album) return;

    const cover = document.getElementById('waveCover');
    const title = document.getElementById('waveAlbumTitle');
    const tag = document.getElementById('waveTag');
    const trackName = document.getElementById('waveTrackName');

    if (animate) {
        title.style.opacity = '0';
        title.style.transform = 'translateY(10px)';
        cover.style.opacity = '0';
    }

    setTimeout(() => {
        cover.src = album.cover;
        title.textContent = album.title;
        tag.textContent = album.year;
        tag.classList.add('visible');
        trackName.textContent = album.tracks.length + ' треков';

        if (animate) {
            requestAnimationFrame(() => {
                title.style.opacity = '1';
                title.style.transform = 'translateY(0)';
                cover.style.opacity = '1';
            });
        }
    }, animate ? 150 : 0);

    updateWheelPositions(index);
    updateWaveBlobs(index);
}

function updateWaveBlobs(index) {
    const color = albumColors[index % albumColors.length];
    const blobs = document.querySelectorAll('.wave-blob');
    if (blobs.length < 3) return;

    const r = color.r, g = color.g, b = color.b;
    blobs[0].style.background = `rgba(${r}, ${g}, ${b}, 0.35)`;
    blobs[1].style.background = `rgba(${Math.min(255, r + 60)}, ${Math.max(0, g - 40)}, ${Math.min(255, b + 30)}, 0.3)`;
    blobs[2].style.background = `rgba(${Math.max(0, r - 50)}, ${Math.min(255, g + 60)}, ${b}, 0.2)`;
}

function waveNav(dir) {
    waveSelect(waveCurrentIndex + dir);
}

function wavePlay() {
    const album = albums[waveCurrentIndex];
    if (!album || !album.tracks.length) return;

    currentAlbum = album;
    playlist = album.tracks;
    currentPlaylistIndex = 0;
    playTrack(album.tracks[0].id);
}

function waveLike() {
    const album = albums[waveCurrentIndex];
    if (!album || !album.tracks.length) return;

    const firstTrack = album.tracks[0];
    toggleLike(firstTrack.id);

    const btn = document.getElementById('waveLikeBtn');
    if (btn) {
        btn.classList.toggle('liked', likedTracks.has(firstTrack.id));
    }
}

function waveInfo() {
    const album = albums[waveCurrentIndex];
    if (!album) return;
    openAlbum(album.id);
}

function updateWheelPositions(activeIndex) {
    const items = document.querySelectorAll('.wave-wheel-item');
    const wheelEl = document.getElementById('waveWheel');
    if (!wheelEl || !items.length) return;

    const n = items.length;
    const wheelH = wheelEl.offsetHeight;
    const centerY = wheelH / 2 - 45;
    const spacing = 105;
    const maxVisible = 4;

    items.forEach((item, i) => {
        let offset = i - activeIndex;
        if (offset > n / 2) offset -= n;
        if (offset < -n / 2) offset += n;

        const absOffset = Math.abs(offset);

        if (absOffset > maxVisible) {
            item.style.opacity = '0';
            item.style.pointerEvents = 'none';
            item.style.top = `${centerY + offset * spacing}px`;
            item.style.transform = 'translateX(160px) scale(0.4)';
            return;
        }

        const y = centerY + offset * spacing;
        const xShift = absOffset * absOffset * 22;
        const scale = Math.max(0.65, 1 - absOffset * 0.08);
        const opacity = absOffset === 0 ? 1 : Math.max(0.18, 0.6 - absOffset * 0.1);
        const coverSize = absOffset === 0 ? 80 : Math.max(48, 66 - absOffset * 6);

        item.style.top = `${y}px`;
        item.style.transform = `translateX(${xShift}px) scale(${scale})`;
        item.style.opacity = `${opacity}`;
        item.style.pointerEvents = 'auto';
        item.style.zIndex = `${10 - absOffset}`;

        const cover = item.querySelector('.wave-wheel-item-cover');
        if (cover) {
            cover.style.width = `${coverSize}px`;
            cover.style.height = `${coverSize}px`;
            cover.style.borderColor = absOffset === 0
                ? 'rgba(255,255,255,0.3)'
                : 'rgba(255,255,255,0.08)';
        }

        const info = item.querySelector('.wave-wheel-item-info');
        if (info) {
            info.style.opacity = absOffset <= 2 ? '1' : '0';
        }

        const nameEl = item.querySelector('.wave-wheel-item-name');
        if (nameEl) {
            nameEl.style.fontSize = absOffset === 0 ? '16px' : '13px';
        }
    });
}

function setupWaveScroll() {
    const screen = document.getElementById('waveScreen');
    if (!screen) return;

    let scrollTimeout = null;
    screen.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (scrollTimeout) return;

        scrollTimeout = setTimeout(() => {
            scrollTimeout = null;
        }, 300);

        if (e.deltaY > 0) {
            waveNav(1);
        } else if (e.deltaY < 0) {
            waveNav(-1);
        }
    }, { passive: false });

    let touchStartY = 0;
    screen.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    screen.addEventListener('touchend', (e) => {
        const deltaY = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(deltaY) > 50) {
            waveNav(deltaY > 0 ? 1 : -1);
        }
    }, { passive: true });
}

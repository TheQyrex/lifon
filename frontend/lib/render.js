// Safe renderers for catalogue UI. All user/admin-supplied strings flow through
// textContent, never innerHTML, so a track title containing `<img onerror=…>`
// renders as plain text instead of executing.

(function () {
    const { el } = window.LifonDOM;

    function albumCard(album, onOpen) {
        return el('div', { class: 'album-card', onclick: () => onOpen(album.id) }, [
            el('img', { src: album.cover, alt: album.title }),
            el('h3', { text: album.title }),
            el('p', { text: album.year }),
        ]);
    }

    function likeIcon(liked) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '20');
        svg.setAttribute('height', '20');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', liked ? 'currentColor' : 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
        svg.appendChild(path);
        return svg;
    }

    function trackRow({ track, index, isCurrent, liked, onPlay, onToggleLike }) {
        const likeBtn = el('button', {
            class: liked ? 'btn-like liked' : 'btn-like',
            onclick: (e) => { e.stopPropagation(); onToggleLike(track.id); },
        });
        likeBtn.appendChild(likeIcon(liked));

        return el('div', {
            class: 'track-item' + (isCurrent ? ' playing' : ''),
            onclick: () => onPlay(track.id),
        }, [
            el('div', { class: 'track-number', text: String(index + 1) }),
            el('div', { class: 'track-info' }, [
                el('div', { class: 'track-title', text: track.title }),
                el('div', { class: 'track-artist', text: track.artist }),
            ]),
            el('div', { class: 'track-duration', text: track.duration }),
            likeBtn,
        ]);
    }

    function emptyState(message) {
        return el('p', {
            text: message,
            style: { textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' },
        });
    }

    window.LifonRender = { albumCard, trackRow, emptyState };
})();

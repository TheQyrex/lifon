// Улучшения для режима текста

// Таймеры для задержек
let closeLyricsTimeout = null;
let volumeSliderTimeout = null;

// Обработка наведения на кнопку закрытия текста
document.addEventListener('DOMContentLoaded', () => {
    const lyricsRight = document.querySelector('.lyrics-right');
    const closeBtn = document.querySelector('.btn-close-lyrics');

    if (lyricsRight && closeBtn) {
        lyricsRight.addEventListener('mouseenter', () => {
            clearTimeout(closeLyricsTimeout);
            closeBtn.classList.add('show');
        });

        lyricsRight.addEventListener('mouseleave', () => {
            closeLyricsTimeout = setTimeout(() => {
                closeBtn.classList.remove('show');
            }, 3000);
        });

        closeBtn.addEventListener('mouseenter', () => {
            clearTimeout(closeLyricsTimeout);
        });
    }

    // Обработка задержки для ползунка громкости
    const volumeControl = document.querySelector('.volume-control');
    const volumeSlider = document.querySelector('.volume-slider-container');

    if (volumeControl && volumeSlider) {
        volumeControl.addEventListener('mouseenter', () => {
            clearTimeout(volumeSliderTimeout);
            volumeSlider.classList.add('show');
        });

        volumeControl.addEventListener('mouseleave', () => {
            volumeSliderTimeout = setTimeout(() => {
                volumeSlider.classList.remove('show');
            }, 3000);
        });

        volumeSlider.addEventListener('mouseenter', () => {
            clearTimeout(volumeSliderTimeout);
        });

        volumeSlider.addEventListener('mouseleave', () => {
            volumeSliderTimeout = setTimeout(() => {
                volumeSlider.classList.remove('show');
            }, 3000);
        });
    }
});

// Функция переключения видимости текста
function toggleLyricsVisibility() {
    const lyricsModal = document.getElementById('lyricsModal');
    const hideLyricsBtn = document.querySelector('.btn-hide-lyrics-top');

    lyricsModal.classList.toggle('lyrics-hidden');
    hideLyricsBtn.classList.toggle('active');
}

// Добавление лоадера перед отсчетом
function showLyricsLoader() {
    const lyricsScroller = document.getElementById('lyricsText');
    if (!lyricsScroller) return;

    // Удаляем старый лоадер если есть
    const oldLoader = lyricsScroller.querySelector('.lyrics-loader');
    if (oldLoader) oldLoader.remove();

    // Создаем элемент лоадера
    const loader = document.createElement('div');
    loader.className = 'lyrics-loader';

    // Создаем 4 точки с задержками
    for (let i = 0; i < 4; i++) {
        const element = document.createElement('div');
        element.className = 'lyrics-loader-element';
        element.style.animationDelay = `${0.275 * (i + 1)}s`;
        element.style.animationDuration = '1.1s, 1.1s';
        loader.appendChild(element);
    }

    lyricsScroller.insertBefore(loader, lyricsScroller.firstChild);

    // Удаляем лоадер через 2 секунды (когда начнется отсчет)
    setTimeout(() => {
        loader.style.opacity = '0';
        loader.style.transition = 'opacity 0.3s ease';
        setTimeout(() => loader.remove(), 300);
    }, 2000);
}

// Добавление отсчета 3-2-1 перед началом текста
let countdownInterval = null;
let countdownShown = false;

function showLyricsCountdown(startTime) {
    const lyricsScroller = document.getElementById('lyricsText');
    if (!lyricsScroller) return;

    // Удаляем лоадер если он еще есть
    const oldLoader = lyricsScroller.querySelector('.lyrics-loader');
    if (oldLoader) oldLoader.remove();

    // Удаляем старый отсчет если есть
    const oldCountdown = lyricsScroller.querySelector('.lyrics-countdown');
    if (oldCountdown) oldCountdown.remove();

    // Создаем элемент отсчета
    const countdown = document.createElement('div');
    countdown.className = 'lyrics-countdown';

    lyricsScroller.appendChild(countdown);

    let count = 3;
    countdown.textContent = count;

    countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdown.textContent = count;
        } else {
            // Добавляем класс past для анимации исчезновения
            countdown.classList.add('past');
            setTimeout(() => countdown.remove(), 600);
            clearInterval(countdownInterval);
            countdownShown = true;
        }
    }, 1000);
}

// Экспортируем функции в глобальную область
window.toggleLyricsVisibility = toggleLyricsVisibility;
window.showLyricsCountdown = showLyricsCountdown;
window.showLyricsLoader = showLyricsLoader;

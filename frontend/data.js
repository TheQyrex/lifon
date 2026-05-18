// Данные альбомов и треков CUPSIZE
let albums = [
    {
        id: 1,
        title: "Еби меня, малышка",
        year: "2023",
        cover: "preview/album_1.jpg",
        tracks: [
            { id: 1, title: "ДАВАЙ ТРАХАТЬСЯ В МАШИНЕ", duration: "1:55", artist: "CUPSIZE", albumId: 1 },
            { id: 2, title: "Люби меня, алина", duration: "1:37", artist: "CUPSIZE", albumId: 1 },
            { id: 3, title: "ГИДРОПОН", duration: "2:24", artist: "CUPSIZE", albumId: 1 },
            { id: 4, title: "ПАПИК", duration: "1:58", artist: "CUPSIZE ft. 17 SEVENTEEN", albumId: 1 },
            { id: 5, title: "лиза,настя", duration: "1:47", artist: "CUPSIZE", albumId: 1 },
            { id: 6, title: "вайфуу", duration: "2:10", artist: "CUPSIZE", albumId: 1 },
            { id: 7, title: "я схавал опиат", duration: "2:18", artist: "CUPSIZE", albumId: 1 },
            { id: 8, title: "Вирус", duration: "2:29", artist: "CUPSIZE", albumId: 1 },
            { id: 9, title: "МОЯ МАМА ПЬЁТ", duration: "2:09", artist: "CUPSIZE", albumId: 1 },
            { id: 10, title: "Ты любишь травку", duration: "2:13", artist: "CUPSIZE", albumId: 1 },
            { id: 11, title: "Забуду", duration: "3:03", artist: "CUPSIZE", albumId: 1 },
            { id: 12, title: "Мне похуй", duration: "1:53", artist: "CUPSIZE", albumId: 1 }
        ]
    },
    {
        id: 2,
        title: "дели на два",
        year: "2023",
        cover: "preview/album_2.jpg",
        tracks: [
            { id: 101, title: "ты любишь танцевать", duration: "2:24", artist: "CUPSIZE", albumId: 2 },
            { id: 102, title: "пятый элемент", duration: "2:14", artist: "CUPSIZE", albumId: 2 },
            { id: 103, title: "целую тебя", duration: "2:09", artist: "CUPSIZE", albumId: 2 },
            { id: 104, title: "воздух", duration: "2:04", artist: "CUPSIZE", albumId: 2 }
        ]
    },
    {
        id: 3,
        title: "Как испортить вечеринку?",
        year: "2023",
        cover: "preview/album_3.jpg",
        tracks: [
            { id: 201, title: "Юра, Юра", duration: "2:08", artist: "CUPSIZE", albumId: 3 },
            { id: 202, title: "По улице иду я", duration: "2:32", artist: "CUPSIZE", albumId: 3 },
            { id: 203, title: "Они все дрочат на тебя в интернете", duration: "1:48", artist: "CUPSIZE", albumId: 3 },
            { id: 204, title: "Стенки моего подъезда", duration: "2:29", artist: "CUPSIZE", albumId: 3 },
            { id: 205, title: "Василий", duration: "2:26", artist: "CUPSIZE", albumId: 3 },
            { id: 206, title: "Травматика", duration: "2:40", artist: "CUPSIZE", albumId: 3 },
            { id: 207, title: "И это прекрасно", duration: "3:25", artist: "CUPSIZE", albumId: 3 },
            { id: 208, title: "Клей", duration: "2:25", artist: "CUPSIZE", albumId: 3 },
            { id: 209, title: "Целовались", duration: "2:32", artist: "CUPSIZE", albumId: 3 },
            { id: 210, title: "Пьяные", duration: "2:08", artist: "CUPSIZE", albumId: 3 },
            { id: 211, title: "Высокий градус", duration: "2:33", artist: "CUPSIZE", albumId: 3 },
            { id: 212, title: "Но им не смешно", duration: "2:23", artist: "CUPSIZE", albumId: 3 },
            { id: 213, title: "Семнадцатилетняя", duration: "2:32", artist: "CUPSIZE", albumId: 3 },
            { id: 214, title: "Я схожу с ума", duration: "3:07", artist: "CUPSIZE", albumId: 3 },
            { id: 215, title: "ДПП (Аутро)", duration: "1:48", artist: "CUPSIZE", albumId: 3 }
        ]
    },
    {
        id: 4,
        title: "кажется, в аду прикольно, но меня выгнали б утром",
        year: "2024",
        cover: "preview/album_4.jpg",
        tracks: [
            { id: 301, title: "Влечение", duration: "2:11", artist: "CUPSIZE", albumId: 4 },
            { id: 302, title: "привет, если ты мне не ответишь", duration: "2:03", artist: "CUPSIZE", albumId: 4 },
            { id: 303, title: "фура", duration: "2:14", artist: "CUPSIZE", albumId: 4 },
            { id: 304, title: "мой врач думает что у меня шизофрения", duration: "2:14", artist: "CUPSIZE", albumId: 4 },
            { id: 305, title: "маршрутка", duration: "3:10", artist: "CUPSIZE", albumId: 4 },
            { id: 306, title: "ну почему", duration: "2:52", artist: "CUPSIZE", albumId: 4 },
            { id: 307, title: "я тупая, моя жизнь тупая", duration: "3:07", artist: "CUPSIZE", albumId: 4 },
            { id: 308, title: "пока-пока", duration: "2:53", artist: "CUPSIZE", albumId: 4 },
            { id: 309, title: "нам это нравится", duration: "2:57", artist: "CUPSIZE", albumId: 4 },
            { id: 310, title: "больше, чем творчество", duration: "2:34", artist: "CUPSIZE", albumId: 4 }
        ]
    },
    {
        id: 5,
        title: "в моих легких выросли цветы",
        year: "2025",
        cover: "preview/album_5.jpg",
        tracks: [
            { id: 401, title: "107.1", duration: "1:58", artist: "CUPSIZE", albumId: 5 },
            { id: 402, title: "печаль", duration: "2:10", artist: "CUPSIZE", albumId: 5 },
            { id: 403, title: "минус,плюс", duration: "3:44", artist: "CUPSIZE", albumId: 5 },
            { id: 404, title: "переломай мои кости", duration: "2:48", artist: "CUPSIZE", albumId: 5 },
            { id: 405, title: "давай увидимся", duration: "4:00", artist: "CUPSIZE", albumId: 5 },
            { id: 406, title: "твои поцелуи", duration: "2:32", artist: "CUPSIZE", albumId: 5 },
            { id: 407, title: "кислород", duration: "2:22", artist: "CUPSIZE", albumId: 5 },
            { id: 408, title: "или хотя бы завтра...", duration: "1:45", artist: "CUPSIZE", albumId: 5 },
            { id: 409, title: "самокрутки", duration: "2:34", artist: "CUPSIZE", albumId: 5 },
            { id: 410, title: "улыбнись", duration: "4:29", artist: "CUPSIZE", albumId: 5 }
        ]
    },
    {
        id: 6,
        title: "неуравновешеннолетниепесни pt.1",
        year: "2025",
        cover: "preview/album_6.jpg",
        tracks: [
            { id: 501, title: "дьявол!", duration: "3:28", artist: "CUPSIZE", albumId: 6 },
            { id: 502, title: "оригами", duration: "2:24", artist: "CUPSIZE", albumId: 6 },
            { id: 503, title: "шАхАшАхА", duration: "2:54", artist: "CUPSIZE", albumId: 6 },
            { id: 504, title: "песня про спид", duration: "2:50", artist: "CUPSIZE", albumId: 6 },
            { id: 505, title: "конъюктивит", duration: "3:28", artist: "CUPSIZE", albumId: 6 },
            { id: 506, title: "тварьтварьтварьтварь...", duration: "3:06", artist: "CUPSIZE", albumId: 6 },
            { id: 507, title: "злой отчим", duration: "3:45", artist: "CUPSIZE", albumId: 6 }
        ]
    },
    {
        id: 7,
        title: "прыгайдуравишлист!",
        year: "2025",
        cover: "preview/album_7.jpg",
        tracks: [
            { id: 601, title: "прыгай, дура!", duration: "1:59", artist: "CUPSIZE", albumId: 7 },
            { id: 602, title: "вишлист", duration: "2:07", artist: "CUPSIZE", albumId: 7 }
        ]
    },
    {
        id: 8,
        title: "Хайперпоп",
        year: "2020 - 2022",
        cover: "preview/album_10.png",
        tracks: [
            { id: 901, title: "Цветофобия", duration: "1:49", artist: "CUPSIZE", albumId: 8, cover: "preview/colorphobia.jpg" },
            { id: 902, title: "Паранойя", duration: "1:57", artist: "CUPSIZE", albumId: 8, cover: "preview/colorphobia.jpg" },
            { id: 903, title: "Оттенки", duration: "1:37", artist: "CUPSIZE", albumId: 8, cover: "preview/colorphobia.jpg" },
            { id: 904, title: "Бред", duration: "2:11", artist: "CUPSIZE ft. drowsyy", albumId: 8, cover: "preview/colorphobia.jpg" },
            { id: 905, title: "Километры", duration: "2:22", artist: "CUPSIZE", albumId: 8, cover: "preview/colorphobia.jpg" },
            { id: 906, title: "В окно с тобой", duration: "1:59", artist: "CUPSIZE", albumId: 8, cover: "preview/twwy.jpg" },
            { id: 907, title: "алло-алло", duration: "2:19", artist: "CUPSIZE ft. Эмпи, FADE031", albumId: 8, cover: "preview/allo.jpg" },
            { id: 908, title: "скам на чувства", duration: "2:33", artist: "CUPSIZE ft. Эмпи", albumId: 8 },
            { id: 909, title: "Ошибка", duration: "1:48", artist: "CUPSIZE", albumId: 8, cover: "preview/fail.jpg" },
            { id: 910, title: "Одиночество", duration: "1:45", artist: "CUPSIZE", albumId: 8, cover: "preview/solo.jpg" },
            { id: 911, title: "Наркоша", duration: "2:21", artist: "CUPSIZE ft. SAT1VA", albumId: 8, cover: "preview/drug.jpg" },
            { id: 912, title: "LSD", duration: "1:56", artist: "CUPSIZE ft. DOESHA", albumId: 8, cover: "preview/lsd.jpg" },
            { id: 913, title: "22", duration: "1:58", artist: "CUPSIZE ft. LOLIWZ", albumId: 8, cover: "preview/22_hq.jpg" }
        ]
    },
    {
        id: 9,
        title: "Совместные релизы",
        year: "2030",
        cover: "preview/album_8.jpg",
        tracks: [
            { id: 701, title: "Сколько мы не спали", duration: "1:51", artist: "CUPSIZE ft. Рэйчи", albumId: 9 },
            { id: 702, title: "1 мая", duration: "2:07", artist: "CUPSIZE ft. madk1d", albumId: 9 },
            { id: 703, title: "Круче чем вы", duration: "1:40", artist: "CUPSIZE ft. madk1d", albumId: 9 },
            { id: 704, title: "Виолетта", duration: "1:45", artist: "CUPSIZE ft. Рэйчи", albumId: 9 },
            { id: 705, title: "Бардак", duration: "1:53", artist: "CUPSIZE ft. 17 SEVENTEEN", albumId: 9 },
            { id: 706, title: "ВШБ", duration: "1:49", artist: "CUPSIZE ft. GRILLYAZH", albumId: 9 },
            { id: 707, title: "НЕ ПО СЕБЕ", duration: "3:01", artist: "CUPSIZE ft. источник, Niño", albumId: 9 }
        ]
    },
    {
        id: 10,
        title: "UNRELEASE и прочее",
        year: "2030",
        cover: "preview/album_9.jpg",
        tracks: [
            { id: 802, title: "Компромат", duration: "2:78", artist: "CUPSIZE", albumId: 10 },
            { id: 803, title: "Я стану популярным в интернете", duration: "1:15", artist: "CUPSIZE", albumId: 10 },
            { id: 804, title: "Я проститутка", duration: "1:45", artist: "CUPSIZE", albumId: 10 },
            { id: 805, title: "Откуда ты взялась", duration: "3:41", artist: "CUPSIZE", albumId: 10 },
            { id: 806, title: "тогда мы не были вдвоем", duration: "3:59", artist: "CUPSIZE", albumId: 10 },
            { id: 807, title: "забываю", duration: "2:03", artist: "CUPSIZE", albumId: 10 },
            { id: 808, title: "девчонкам", duration: "2:54", artist: "CUPSIZE", albumId: 10 },
            { id: 809, title: "я рисую члены на помойке вместе с тобой", duration: "1:58", artist: "CUPSIZE", albumId: 10 },
            { id: 810, title: "нло украли моё тело", duration: "1:35", artist: "CUPSIZE", albumId: 10 },
            { id: 812, title: "я ещё жив", duration: "3:01", artist: "CUPSIZE", albumId: 10 },
            { id: 813, title: "В моей голове", duration: "2:36", artist: "CUPSIZE", albumId: 10 },
            { id: 814, title: "Малая", duration: "1:56", artist: "CUPSIZE", albumId: 10 },
            { id: 815, title: "это невозможно", duration: "1:14", artist: "CUPSIZE", albumId: 10 },
            { id: 816, title: "передоз", duration: "2:30", artist: "CUPSIZE", albumId: 10 },
            { id: 817, title: "кислота", duration: "1:30", artist: "CUPSIZE", albumId: 10 },
            { id: 818, title: "просто отсоси мой член", duration: "2:43", artist: "CUPSIZE", albumId: 10 },
            { id: 819, title: "в прокуренной квартире", duration: "2:23", artist: "CUPSIZE", albumId: 10 },
            { id: 820, title: "день рождения", duration: "1:40", artist: "CUPSIZE", albumId: 10 },
            { id: 821, title: "мой номер недоступен", duration: "1:29", artist: "CUPSIZE", albumId: 10 },
            { id: 822, title: "палата 136", duration: "1:58", artist: "CUPSIZE", albumId: 10 },
            { id: 823, title: "почему твоя любовь делает мне больно", duration: "1:39", artist: "CUPSIZE", albumId: 10 },
            { id: 824, title: "Тейлор Свифт", duration: "1:05", artist: "CUPSIZE", albumId: 10 }
        ]
    }
];

// Функция для загрузки текстов песен из LRC файлов
async function loadLyrics(trackId) {
    try {
        const response = await fetch(`${API_BASE}/albums/tracks/${trackId}/lyrics`);
        if (response.ok) {
            const data = await response.json();
            if (data?.lrc) {
                return parseLyricsText(data.lrc);
            }
        }
    } catch {
        // Local bundled lyrics remain the fallback when the API is unreachable.
    }

    try {
        const response = await fetch(`lyrics/${trackId}.lrc?v=${Date.now()}`);
        if (!response.ok) {
            console.error(`Lyrics not found for track ${trackId}`);
            return null;
        }
        return parseLyricsText(await response.text());
    } catch (error) {
        console.error('Failed to load lyrics:', error);
        return null;
    }
}

function parseLyricsText(text) {
    const lines = text.split('\n');
    let lyricsText = '';
    let metadata = {};

    for (const line of lines) {
        const metaMatch = line.match(/\[(\w+):\s*(.+)\]/);
        if (metaMatch && !line.match(/\[\d+:\d+/)) {
            metadata[metaMatch[1]] = metaMatch[2];
            continue;
        }
        if (line.match(/\[\d+:\d+\.\d+\]/)) {
            const textMatch = line.match(/\[\d+:\d+\.\d+\](.+)/);
            if (textMatch && textMatch[1].trim()) {
                lyricsText += textMatch[1].trim() + '\n';
            }
        }
    }

    return {
        text: lyricsText.trim(),
        metadata: metadata,
        raw: text
    };
}

// Функция для получения пути к аудио файлу
function getAudioPath(track) {
    if (track.audioUrl || track.audio_url || track.audio) {
        return track.audioUrl || track.audio_url || track.audio;
    }

    const trackId = track.id;

    // Альбом 1: fuck_1.opus - fuck_12.opus
    if (trackId >= 1 && trackId <= 12) {
        return `audio/fuck_${trackId}.opus`;
    }

    // Альбом 2: album2_track1.opus - album2_track4.opus
    if (trackId >= 101 && trackId <= 104) {
        return `audio/album2_track${trackId - 100}.opus`;
    }

    // Альбом 3: album3_track1.opus - album3_track15.opus
    if (trackId >= 201 && trackId <= 215) {
        return `audio/album3_track${trackId - 200}.opus`;
    }

    // Альбом 4: album4_track1.opus - album4_track10.opus
    if (trackId >= 301 && trackId <= 310) {
        return `audio/album4_track${trackId - 300}.opus`;
    }

    // Альбом 5: album5_track1.opus - album5_track10.opus
    if (trackId >= 401 && trackId <= 410) {
        return `audio/album5_track${trackId - 400}.opus`;
    }

    // Альбом 6: album6_track1.opus - album6_track7.opus
    if (trackId >= 501 && trackId <= 507) {
        return `audio/album6_track${trackId - 500}.opus`;
    }

    // Альбом 7: album7_track1.opus - album7_track2.opus
    if (trackId >= 601 && trackId <= 602) {
        return `audio/album7_track${trackId - 600}.opus`;
    }

    // Альбом 8: album8_track1.opus - album8_track7.opus
    if (trackId >= 701 && trackId <= 707) {
        return `audio/album8_track${trackId - 700}.opus`;
    }

    // Альбом 9: album9_track2.opus - album9_track23.opus (пропуск track1, track11)
    if (trackId >= 802 && trackId <= 824) {
        const trackNum = trackId === 802 ? 2 :
                        trackId === 803 ? 3 :
                        trackId === 804 ? 4 :
                        trackId === 805 ? 5 :
                        trackId === 806 ? 6 :
                        trackId === 807 ? 7 :
                        trackId === 808 ? 8 :
                        trackId === 809 ? 9 :
                        trackId === 810 ? 10 :
                        trackId === 812 ? 11 :
                        trackId === 813 ? 12 :
                        trackId === 814 ? 13 :
                        trackId === 815 ? 14 :
                        trackId === 816 ? 15 :
                        trackId === 817 ? 16 :
                        trackId === 818 ? 17 :
                        trackId === 819 ? 18 :
                        trackId === 820 ? 19 :
                        trackId === 821 ? 20 :
                        trackId === 822 ? 21 :
                        trackId === 823 ? 22 :
                        trackId === 824 ? 23 : 0;
        return `audio/album9_track${trackNum}.opus`;
    }

    // Альбом 10: album10_track1.opus - album10_track13.opus
    if (trackId >= 901 && trackId <= 913) {
        return `audio/album10_track${trackId - 900}.opus`;
    }

    return null;
}

// API endpoint (configured via frontend/config.js — override window.__LIFON_API__
// at the top of index.html to point at a different environment).
const API_BASE = window.LIFON_CONFIG.API_BASE;
let maintenanceState = null;

async function loadCatalogFromServer() {
    try {
        maintenanceState = null;
        const headers = {};
        const token = localStorage.getItem('auth_token');
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${API_BASE}/albums`, { headers });
        if (!response.ok) {
            if (response.status === 503) {
                const data = await response.json().catch(() => null);
                if (data?.error === 'maintenance') {
                    maintenanceState = {
                        enabled: true,
                        message: data.message || 'Сайт находится на технических работах',
                    };
                }
            }
            return false;
        }
        const data = await response.json();
        if (!Array.isArray(data.albums) || data.albums.length === 0) return false;
        albums = normalizeAlbums(data.albums);
        return true;
    } catch (error) {
        console.error('Failed to fetch catalog:', error);
        return false;
    }
}

function normalizeAlbums(inputAlbums) {
    return inputAlbums.map(album => {
        const normalized = {
            ...album,
            cover: album.cover || album.cover_url || '',
        };
        normalized.tracks = (album.tracks || []).map(track => ({
            ...track,
            albumId: track.albumId || track.album_id || album.id,
            cover: track.cover || track.cover_url || null,
            audioUrl: track.audioUrl || track.audio_url || track.audio || null,
        }));
        return normalized;
    });
}

window.LifonCatalog = {
    get albums() {
        return albums;
    },
    loadCatalogFromServer,
    getAudioPath,
    getMaintenanceState: () => maintenanceState,
};

// API функции для статистики
async function recordListen(token, trackId, durationMs) {
    if (!token || token === 'guest') return false;

    try {
        const response = await fetch(`${API_BASE}/listens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                track_id: trackId,
                duration_ms: durationMs
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Failed to record listen:', error);
        return false;
    }
}

async function fetchStats(token) {
    if (!token) {
        console.log('fetchStats: no valid token');
        return null;
    }

    console.log('fetchStats: fetching with token', token.substring(0, 10) + '...');

    try {
        const response = await fetch(`${API_BASE}/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('fetchStats: response status', response.status);

        if (!response.ok) {
            console.log('fetchStats: response not ok');
            return null;
        }

        const data = await response.json();
        console.log('fetchStats: raw data', data);

        return {
            topTracks: (data.top_tracks || []).map(t => ({
                trackId: t.track_id,
                playCount: t.play_count
            })),
            totalMs: data.total_ms || 0,
            totalListens: data.total_listens || 0
        };
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        return null;
    }
}

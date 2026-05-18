-- Seed: all CUPSIZE albums and tracks from data.js
-- Run: sqlite3 /var/www/lifonmusic/backend/data/db.sqlite < seed.sql

INSERT OR IGNORE INTO albums (id, title, year, cover_key, sort_order) VALUES
(1,  'Еби меня, малышка',                                        '2023',      'preview/album_1.jpg',  1),
(2,  'дели на два',                                              '2023',      'preview/album_2.jpg',  2),
(3,  'Как испортить вечеринку?',                                 '2023',      'preview/album_3.jpg',  3),
(4,  'кажется, в аду прикольно, но меня выгнали б утром',        '2024',      'preview/album_4.jpg',  4),
(5,  'в моих легких выросли цветы',                              '2025',      'preview/album_5.jpg',  5),
(6,  'неуравновешеннолетниепесни pt.1',                          '2025',      'preview/album_6.jpg',  6),
(7,  'прыгайдуравишлист!',                                       '2025',      'preview/album_7.jpg',  7),
(8,  'Хайперпоп',                                                '2020 - 2022','preview/album_10.png', 8),
(9,  'Совместные релизы',                                        '2030',      'preview/album_8.jpg',  9),
(10, 'UNRELEASE и прочее',                                       '2030',      'preview/album_9.jpg',  10);

-- Album 1
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(1,  1, 'ДАВАЙ ТРАХАТЬСЯ В МАШИНЕ',  'CUPSIZE',                  '1:55', 'audio/fuck_1.opus',  1),
(2,  1, 'Люби меня, алина',          'CUPSIZE',                  '1:37', 'audio/fuck_2.opus',  2),
(3,  1, 'ГИДРОПОН',                  'CUPSIZE',                  '2:24', 'audio/fuck_3.opus',  3),
(4,  1, 'ПАПИК',                     'CUPSIZE ft. 17 SEVENTEEN', '1:58', 'audio/fuck_4.opus',  4),
(5,  1, 'лиза,настя',                'CUPSIZE',                  '1:47', 'audio/fuck_5.opus',  5),
(6,  1, 'вайфуу',                    'CUPSIZE',                  '2:10', 'audio/fuck_6.opus',  6),
(7,  1, 'я схавал опиат',            'CUPSIZE',                  '2:18', 'audio/fuck_7.opus',  7),
(8,  1, 'Вирус',                     'CUPSIZE',                  '2:29', 'audio/fuck_8.opus',  8),
(9,  1, 'МОЯ МАМА ПЬЁТ',            'CUPSIZE',                  '2:09', 'audio/fuck_9.opus',  9),
(10, 1, 'Ты любишь травку',          'CUPSIZE',                  '2:13', 'audio/fuck_10.opus', 10),
(11, 1, 'Забуду',                    'CUPSIZE',                  '3:03', 'audio/fuck_11.opus', 11),
(12, 1, 'Мне похуй',                 'CUPSIZE',                  '1:53', 'audio/fuck_12.opus', 12);

-- Album 2
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(101, 2, 'ты любишь танцевать', 'CUPSIZE', '2:24', 'audio/album2_track1.opus', 1),
(102, 2, 'пятый элемент',       'CUPSIZE', '2:14', 'audio/album2_track2.opus', 2),
(103, 2, 'целую тебя',          'CUPSIZE', '2:09', 'audio/album2_track3.opus', 3),
(104, 2, 'воздух',              'CUPSIZE', '2:04', 'audio/album2_track4.opus', 4);

-- Album 3
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(201, 3, 'Юра, Юра',                                   'CUPSIZE', '2:08', 'audio/album3_track1.opus',  1),
(202, 3, 'По улице иду я',                             'CUPSIZE', '2:32', 'audio/album3_track2.opus',  2),
(203, 3, 'Они все дрочат на тебя в интернете',         'CUPSIZE', '1:48', 'audio/album3_track3.opus',  3),
(204, 3, 'Стенки моего подъезда',                      'CUPSIZE', '2:29', 'audio/album3_track4.opus',  4),
(205, 3, 'Василий',                                    'CUPSIZE', '2:26', 'audio/album3_track5.opus',  5),
(206, 3, 'Травматика',                                 'CUPSIZE', '2:40', 'audio/album3_track6.opus',  6),
(207, 3, 'И это прекрасно',                            'CUPSIZE', '3:25', 'audio/album3_track7.opus',  7),
(208, 3, 'Клей',                                       'CUPSIZE', '2:25', 'audio/album3_track8.opus',  8),
(209, 3, 'Целовались',                                 'CUPSIZE', '2:32', 'audio/album3_track9.opus',  9),
(210, 3, 'Пьяные',                                     'CUPSIZE', '2:08', 'audio/album3_track10.opus', 10),
(211, 3, 'Высокий градус',                             'CUPSIZE', '2:33', 'audio/album3_track11.opus', 11),
(212, 3, 'Но им не смешно',                            'CUPSIZE', '2:23', 'audio/album3_track12.opus', 12),
(213, 3, 'Семнадцатилетняя',                           'CUPSIZE', '2:32', 'audio/album3_track13.opus', 13),
(214, 3, 'Я схожу с ума',                              'CUPSIZE', '3:07', 'audio/album3_track14.opus', 14),
(215, 3, 'ДПП (Аутро)',                                'CUPSIZE', '1:48', 'audio/album3_track15.opus', 15);

-- Album 4
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(301, 4, 'Влечение',                                   'CUPSIZE', '2:11', 'audio/album4_track1.opus',  1),
(302, 4, 'привет, если ты мне не ответишь',            'CUPSIZE', '2:03', 'audio/album4_track2.opus',  2),
(303, 4, 'фура',                                       'CUPSIZE', '2:14', 'audio/album4_track3.opus',  3),
(304, 4, 'мой врач думает что у меня шизофрения',      'CUPSIZE', '2:14', 'audio/album4_track4.opus',  4),
(305, 4, 'маршрутка',                                  'CUPSIZE', '3:10', 'audio/album4_track5.opus',  5),
(306, 4, 'ну почему',                                  'CUPSIZE', '2:52', 'audio/album4_track6.opus',  6),
(307, 4, 'я тупая, моя жизнь тупая',                  'CUPSIZE', '3:07', 'audio/album4_track7.opus',  7),
(308, 4, 'пока-пока',                                  'CUPSIZE', '2:53', 'audio/album4_track8.opus',  8),
(309, 4, 'нам это нравится',                           'CUPSIZE', '2:57', 'audio/album4_track9.opus',  9),
(310, 4, 'больше, чем творчество',                     'CUPSIZE', '2:34', 'audio/album4_track10.opus', 10);

-- Album 5
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(401, 5, '107.1',                       'CUPSIZE', '1:58', 'audio/album5_track1.opus',  1),
(402, 5, 'печаль',                      'CUPSIZE', '2:10', 'audio/album5_track2.opus',  2),
(403, 5, 'минус,плюс',                  'CUPSIZE', '3:44', 'audio/album5_track3.opus',  3),
(404, 5, 'переломай мои кости',         'CUPSIZE', '2:48', 'audio/album5_track4.opus',  4),
(405, 5, 'давай увидимся',              'CUPSIZE', '4:00', 'audio/album5_track5.opus',  5),
(406, 5, 'твои поцелуи',                'CUPSIZE', '2:32', 'audio/album5_track6.opus',  6),
(407, 5, 'кислород',                    'CUPSIZE', '2:22', 'audio/album5_track7.opus',  7),
(408, 5, 'или хотя бы завтра...',       'CUPSIZE', '1:45', 'audio/album5_track8.opus',  8),
(409, 5, 'самокрутки',                  'CUPSIZE', '2:34', 'audio/album5_track9.opus',  9),
(410, 5, 'улыбнись',                    'CUPSIZE', '4:29', 'audio/album5_track10.opus', 10);

-- Album 6
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(501, 6, 'дьявол!',                           'CUPSIZE', '3:28', 'audio/album6_track1.opus', 1),
(502, 6, 'оригами',                            'CUPSIZE', '2:24', 'audio/album6_track2.opus', 2),
(503, 6, 'шАхАшАхА',                           'CUPSIZE', '2:54', 'audio/album6_track3.opus', 3),
(504, 6, 'песня про спид',                     'CUPSIZE', '2:50', 'audio/album6_track4.opus', 4),
(505, 6, 'конъюктивит',                        'CUPSIZE', '3:28', 'audio/album6_track5.opus', 5),
(506, 6, 'тварьтварьтварьтварь...',            'CUPSIZE', '3:06', 'audio/album6_track6.opus', 6),
(507, 6, 'злой отчим',                         'CUPSIZE', '3:45', 'audio/album6_track7.opus', 7);

-- Album 7
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(601, 7, 'прыгай, дура!', 'CUPSIZE', '1:59', 'audio/album7_track1.opus', 1),
(602, 7, 'вишлист',       'CUPSIZE', '2:07', 'audio/album7_track2.opus', 2);

-- Album 8 (Хайперпоп) — audio files: album10_track{n}.opus
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(901, 8, 'Цветофобия',       'CUPSIZE',                        '1:49', 'audio/album10_track1.opus',  1),
(902, 8, 'Паранойя',         'CUPSIZE',                        '1:57', 'audio/album10_track2.opus',  2),
(903, 8, 'Оттенки',          'CUPSIZE',                        '1:37', 'audio/album10_track3.opus',  3),
(904, 8, 'Бред',             'CUPSIZE ft. drowsyy',            '2:11', 'audio/album10_track4.opus',  4),
(905, 8, 'Километры',        'CUPSIZE',                        '2:22', 'audio/album10_track5.opus',  5),
(906, 8, 'В окно с тобой',   'CUPSIZE',                        '1:59', 'audio/album10_track6.opus',  6),
(907, 8, 'алло-алло',        'CUPSIZE ft. Эмпи, FADE031',      '2:19', 'audio/album10_track7.opus',  7),
(908, 8, 'скам на чувства',  'CUPSIZE ft. Эмпи',               '2:33', 'audio/album10_track8.opus',  8),
(909, 8, 'Ошибка',           'CUPSIZE',                        '1:48', 'audio/album10_track9.opus',  9),
(910, 8, 'Одиночество',      'CUPSIZE',                        '1:45', 'audio/album10_track10.opus', 10),
(911, 8, 'Наркоша',          'CUPSIZE ft. SAT1VA',             '2:21', 'audio/album10_track11.opus', 11),
(912, 8, 'LSD',              'CUPSIZE ft. DOESHA',             '1:56', 'audio/album10_track12.opus', 12),
(913, 8, '22',               'CUPSIZE ft. LOLIWZ',             '1:58', 'audio/album10_track13.opus', 13);

-- Album 9 (Совместные релизы) — audio files: album8_track{n}.opus
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(701, 9, 'Сколько мы не спали', 'CUPSIZE ft. Рэйчи',              '1:51', 'audio/album8_track1.opus', 1),
(702, 9, '1 мая',               'CUPSIZE ft. madk1d',             '2:07', 'audio/album8_track2.opus', 2),
(703, 9, 'Круче чем вы',        'CUPSIZE ft. madk1d',             '1:40', 'audio/album8_track3.opus', 3),
(704, 9, 'Виолетта',            'CUPSIZE ft. Рэйчи',              '1:45', 'audio/album8_track4.opus', 4),
(705, 9, 'Бардак',              'CUPSIZE ft. 17 SEVENTEEN',       '1:53', 'audio/album8_track5.opus', 5),
(706, 9, 'ВШБ',                 'CUPSIZE ft. GRILLYAZH',          '1:49', 'audio/album8_track6.opus', 6),
(707, 9, 'НЕ ПО СЕБЕ',         'CUPSIZE ft. источник, Niño',     '3:01', 'audio/album8_track7.opus', 7);

-- Album 10 (UNRELEASE) — audio files: album9_track{n}.opus
INSERT OR IGNORE INTO tracks (id, album_id, title, artist, duration, audio_key, sort_order) VALUES
(802, 10, 'Компромат',                                     'CUPSIZE', '2:78', 'audio/album9_track2.opus',  1),
(803, 10, 'Я стану популярным в интернете',                'CUPSIZE', '1:15', 'audio/album9_track3.opus',  2),
(804, 10, 'Я проститутка',                                 'CUPSIZE', '1:45', 'audio/album9_track4.opus',  3),
(805, 10, 'Откуда ты взялась',                             'CUPSIZE', '3:41', 'audio/album9_track5.opus',  4),
(806, 10, 'тогда мы не были вдвоем',                       'CUPSIZE', '3:59', 'audio/album9_track6.opus',  5),
(807, 10, 'забываю',                                       'CUPSIZE', '2:03', 'audio/album9_track7.opus',  6),
(808, 10, 'девчонкам',                                     'CUPSIZE', '2:54', 'audio/album9_track8.opus',  7),
(809, 10, 'я рисую члены на помойке вместе с тобой',       'CUPSIZE', '1:58', 'audio/album9_track9.opus',  8),
(810, 10, 'нло украли моё тело',                           'CUPSIZE', '1:35', 'audio/album9_track10.opus', 9),
(812, 10, 'я ещё жив',                                     'CUPSIZE', '3:01', 'audio/album9_track11.opus', 10),
(813, 10, 'В моей голове',                                 'CUPSIZE', '2:36', 'audio/album9_track12.opus', 11),
(814, 10, 'Малая',                                         'CUPSIZE', '1:56', 'audio/album9_track13.opus', 12),
(815, 10, 'это невозможно',                                'CUPSIZE', '1:14', 'audio/album9_track14.opus', 13),
(816, 10, 'передоз',                                       'CUPSIZE', '2:30', 'audio/album9_track15.opus', 14),
(817, 10, 'кислота',                                       'CUPSIZE', '1:30', 'audio/album9_track16.opus', 15),
(818, 10, 'просто отсоси мой член',                        'CUPSIZE', '2:43', 'audio/album9_track17.opus', 16),
(819, 10, 'в прокуренной квартире',                        'CUPSIZE', '2:23', 'audio/album9_track18.opus', 17),
(820, 10, 'день рождения',                                 'CUPSIZE', '1:40', 'audio/album9_track19.opus', 18),
(821, 10, 'мой номер недоступен',                          'CUPSIZE', '1:29', 'audio/album9_track20.opus', 19),
(822, 10, 'палата 136',                                    'CUPSIZE', '1:58', 'audio/album9_track21.opus', 20),
(823, 10, 'почему твоя любовь делает мне больно',          'CUPSIZE', '1:39', 'audio/album9_track22.opus', 21),
(824, 10, 'Тейлор Свифт',                                  'CUPSIZE', '1:05', 'audio/album9_track23.opus', 22);

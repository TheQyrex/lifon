import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { LibraryScreen } from '@/screens/LibraryScreen';
import { FavoritesScreen } from '@/screens/FavoritesScreen';
import { AboutScreen } from '@/screens/AboutScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { AuthScreen } from '@/screens/AuthScreen';
import { AlbumScreen } from '@/screens/AlbumScreen';
import { DisclaimerScreen } from '@/screens/DisclaimerScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
import { MaintenanceScreen } from '@/screens/MaintenanceScreen';
import { NotFoundScreen } from '@/screens/NotFoundScreen';
import { AudioRoot } from '@/components/AudioRoot';
import { Player } from '@/components/Player';
import { LyricsModal } from '@/components/LyricsModal';
import { Broadcasts } from '@/components/Broadcasts';
import { Snow } from '@/components/Snow';
import { AchievementPopup } from '@/components/AchievementPopup';
import { LinkTelegramScreen } from '@/screens/LinkTelegramScreen';
import { AdminGuard } from '@/admin/AdminGuard';
import { AdminShell } from '@/admin/AdminShell';
import { StatsPage } from '@/admin/pages/StatsPage';
import { UsersPage } from '@/admin/pages/UsersPage';
import { UserDetailPage } from '@/admin/pages/UserDetailPage';
import { MaintenancePage } from '@/admin/pages/MaintenancePage';
import { BroadcastsPage } from '@/admin/pages/BroadcastsPage';
import { AlbumsPage } from '@/admin/pages/AlbumsPage';
import { UploadsPage } from '@/admin/pages/UploadsPage';
import { SupportersPage } from '@/admin/pages/SupportersPage';
import { AchievementsPage } from '@/admin/pages/AchievementsPage';
import { useAuth } from '@/store/auth';
import { useLikes } from '@/store/likes';
import { usePlayer } from '@/store/player';
import { useLyrics } from '@/store/lyrics';
import { useBroadcasts } from '@/store/broadcasts';
import { useCatalog } from '@/store/catalog';
import { useUi } from '@/store/ui';
import { useLive } from '@/store/live';
import { useAchievements } from '@/store/achievements';

export default function App() {
    const { user, ready, bootstrap } = useAuth();
    const loadLikes = useLikes((s) => s.load);
    const resetLikes = useLikes((s) => s.reset);
    const currentTrack = usePlayer((s) => s.currentTrack);
    const currentTrackId = currentTrack?.id ?? null;
    const isPlaying = usePlayer((s) => s.isPlaying);
    const albumEnded = usePlayer((s) => s.albumEnded);
    const clearAlbumEnded = usePlayer((s) => s._clearAlbumEnded);
    const playFn = usePlayer((s) => s.play);
    const loadLyricsFor = useLyrics((s) => s.loadFor);
    const loadBroadcasts = useBroadcasts((s) => s.load);
    const loadCatalog = useCatalog((s) => s.load);
    const albums = useCatalog((s) => s.albums);
    const maintenance = useCatalog((s) => s.maintenance);
    const disclaimerAccepted = useUi((s) => s.disclaimerAccepted);
    const showAuth = useUi((s) => s.showAuth);
    const sendHeartbeat = useLive((s) => s.sendHeartbeat);
    const fetchLive = useLive((s) => s.fetchAll);
    const loadAchievements = useAchievements((s) => s.load);

    useEffect(() => {
        bootstrap();
    }, [bootstrap]);

    useEffect(() => {
        if (ready) loadCatalog();
    }, [ready, user, loadCatalog]);

    useEffect(() => {
        if (user) loadLikes();
        else resetLikes();
    }, [user, loadLikes, resetLikes]);

    useEffect(() => {
        if (user) loadBroadcasts();
    }, [user, loadBroadcasts]);

    useEffect(() => {
        if (currentTrackId != null) loadLyricsFor(currentTrackId);
    }, [currentTrackId, loadLyricsFor]);

    // Heartbeat: пока что-то играет — каждые 30 секунд отмечаемся в БД для счётчика «слушают сейчас»
    useEffect(() => {
        if (!user || !isPlaying || currentTrackId == null) return;
        sendHeartbeat(currentTrackId);
        const id = setInterval(() => sendHeartbeat(currentTrackId), 30_000);
        return () => clearInterval(id);
    }, [user, isPlaying, currentTrackId, sendHeartbeat]);

    // Опрашиваем полную карту слушателей каждые 20 секунд (один запрос — для всех беджей сразу)
    useEffect(() => {
        if (!user) return;
        fetchLive();
        const id = setInterval(fetchLive, 20_000);
        return () => clearInterval(id);
    }, [user, fetchLive]);

    // Album auto-advance: when the last track ends naturally, start the next album (circular)
    useEffect(() => {
        if (!albumEnded || !currentTrack || albums.length === 0) return;
        clearAlbumEnded();
        const albumIdx = albums.findIndex((a) => a.id === currentTrack.album_id);
        if (albumIdx < 0) return;
        const nextAlbum = albums[(albumIdx + 1) % albums.length];
        if (!nextAlbum || nextAlbum.tracks.length === 0) return;
        playFn(nextAlbum.tracks[0], nextAlbum.tracks, nextAlbum.cover ?? null);
    }, [albumEnded, currentTrack, albums, clearAlbumEnded, playFn]);

    // Load achievement notifications on login and periodically
    useEffect(() => {
        if (!user) return;
        void loadAchievements();
        const id = setInterval(() => void loadAchievements(), 60_000);
        return () => clearInterval(id);
    }, [user, loadAchievements]);

    if (!ready) {
        return <div className="app" />;
    }

    if (!disclaimerAccepted) {
        return <div className="app"><DisclaimerScreen /></div>;
    }

    if (maintenance?.enabled && !user?.is_admin) {
        if (showAuth) {
            return <div className="app"><AuthScreen /></div>;
        }
        return <div className="app"><MaintenanceScreen message={maintenance.message} /></div>;
    }

    if (!user) {
        return (
            <div className="app">
                {showAuth ? <AuthScreen /> : <WelcomeScreen />}
            </div>
        );
    }

    // Мигрированные пользователи без TG обязаны привязать аккаунт перед входом
    if (!user.is_admin && user.require_telegram && !user.telegram_id) {
        return <div className="app"><LinkTelegramScreen /></div>;
    }

    return (
        <Routes>
            <Route
                path="/admin"
                element={
                    <AdminGuard>
                        <AdminShell />
                    </AdminGuard>
                }
            >
                <Route index element={<StatsPage />} />
                <Route path="users"        element={<UsersPage />} />
                <Route path="users/:id"    element={<UserDetailPage />} />
                <Route path="maintenance"  element={<MaintenancePage />} />
                <Route path="broadcasts"   element={<BroadcastsPage />} />
                <Route path="albums"       element={<AlbumsPage />} />
                <Route path="uploads"      element={<UploadsPage />} />
                <Route path="supporters"   element={<SupportersPage />} />
                <Route path="achievements" element={<AchievementsPage />} />
                <Route path="*"            element={<AdminNotFound />} />
            </Route>

            <Route path="*" element={<MainShell />} />
        </Routes>
    );
}

function AdminNotFound() {
    return (
        <div className="space-y-3 text-center pt-16">
            <h1 className="text-6xl font-black text-accent tracking-tight">404</h1>
            <p className="text-white/50">Такой страницы в админке нет.</p>
        </div>
    );
}

function MainShell() {
    return (
        <div className="app">
            <Sidebar />
            <div className="main-app">
                <div className="app-container">
                    <div className="main-content">
                        <Routes>
                            <Route path="/" element={<LibraryScreen />} />
                            <Route path="/album/:id" element={<AlbumScreen />} />
                            <Route path="/favorites" element={<FavoritesScreen />} />
                            <Route path="/about" element={<AboutScreen />} />
                            <Route path="/profile" element={<ProfileScreen />} />
                            <Route path="*" element={<NotFoundScreen />} />
                        </Routes>
                    </div>
                    <Player />
                </div>
            </div>
            <LyricsModal />
            <Broadcasts />
            <Snow />
            <AchievementPopup />
            <AudioRoot />
        </div>
    );
}

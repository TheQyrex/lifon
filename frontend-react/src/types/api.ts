export interface User {
    id: number;
    username: string;
    is_admin: boolean;
    avatar_url?: string | null;
    telegram_id?: number | null;
    require_telegram?: boolean;
}

export interface Track {
    id: number;
    album_id: number;
    title: string;
    artist: string;
    duration: string;
    audio_key: string | null;
    audio_url: string | null;
    cover_key?: string | null;
    cover_url?: string | null;
    lrc?: string | null;
    sort_order: number;
}

export interface Album {
    id: number;
    title: string;
    year: string;
    cover: string | null;
    cover_url: string | null;
    cover_key: string | null;
    sort_order: number;
    glow_color: string | null;
    glow_opacity: number | null;
    glow_radius: number | null;
    tracks: Track[];
}

export interface Achievement {
    id: number;
    name: string;
    description: string;
    icon_key: string | null;
    icon_url: string | null;
    condition_type: 'listens_total' | 'unique_tracks' | 'likes_total' | 'manual';
    condition_value: number;
    earned_at?: number;
}

export interface AchievementNotification {
    id: number;
    achievement_id: number;
    name: string;
    description: string;
    icon_key: string | null;
    icon_url: string | null;
    earned_at: number;
    created_at: number;
}

export interface Supporter {
    id: number;
    name: string;
    handle: string;
    color: string;
    sort_order: number;
}

export interface MaintenanceState {
    enabled: boolean;
    message: string;
}

export interface AuthResponse {
    ok: true;
    token: string;
    user: User;
}

export interface TelegramAuthData {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
}

export type TelegramAuthResponse =
    | (AuthResponse & { pending: false })
    | { ok: true; pending: true; suggested_username: string };

export interface ApiError {
    ok: false;
    error: string;
    message?: string;
    field?: string;
}

export type ApiResponse<T> = ({ ok: true } & T) | ApiError;

export interface User {
    id: number;
    username: string;
    is_admin: boolean;
}

export interface Track {
    id: number;
    album_id: number;
    title: string;
    artist: string;
    duration: string;
    audio_key: string | null;
    audio_url: string | null;
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
    tracks: Track[];
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

export interface ApiError {
    ok: false;
    error: string;
    message?: string;
    field?: string;
}

export type ApiResponse<T> = ({ ok: true } & T) | ApiError;

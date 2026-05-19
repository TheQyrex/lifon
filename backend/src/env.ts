export interface Env {
    DB: D1Database;
    MEDIA: R2Bucket;
    RATELIMIT: KVNamespace;
    NOTIFICATIONS: KVNamespace;

    JWT_SECRET: string;
    ALLOWED_ORIGINS: string;
    MEDIA_PUBLIC_BASE: string;
    ASSETS_BASE?: string; // префикс для бандленых ассетов (preview/, audio/, lyrics/) — задаётся в проде
    ADMIN_BOOTSTRAP?: string;
    TELEGRAM_BOT_TOKEN?: string;
}

export interface AuthedUser {
    id: number;
    username: string;
    isAdmin: boolean;
}

export type AppEnv = {
    Bindings: Env;
    Variables: {
        user?: AuthedUser;
    };
};

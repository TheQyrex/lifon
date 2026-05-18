import { API_BASE } from './config';
import type { ApiError } from '@/types/api';

const TOKEN_KEY = 'auth_token';

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

export class ApiException extends Error {
    constructor(
        public readonly status: number,
        public readonly error: string,
        message: string,
        public readonly field?: string,
    ) {
        super(message);
        this.name = 'ApiException';
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers = new Headers(init.headers);
    if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : null;

    if (!res.ok || (data && data.ok === false)) {
        const err = (data as ApiError) || { error: 'network', message: res.statusText };
        throw new ApiException(res.status, err.error || 'error', err.message || res.statusText, err.field);
    }
    return data as T;
}

export const api = {
    get:    <T>(path: string) => request<T>(path),
    post:   <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST',   body: body ? JSON.stringify(body) : undefined }),
    put:    <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT',    body: body ? JSON.stringify(body) : undefined }),
    patch:  <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH',  body: body ? JSON.stringify(body) : undefined }),
    delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
    upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', body: form }),
};

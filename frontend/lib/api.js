// Thin wrapper around fetch that injects the auth header and parses JSON.
// All network errors and non-2xx responses surface as `ApiError` so callers
// can branch on `.status` / `.code` without juggling response objects.

(function () {
    const API_BASE = window.LIFON_CONFIG.API_BASE;

    class ApiError extends Error {
        constructor(message, { status = 0, code = '', data = null } = {}) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = code;
            this.data = data;
        }
    }

    function getToken() {
        return localStorage.getItem('auth_token');
    }

    function setToken(token) {
        if (token) localStorage.setItem('auth_token', token);
        else localStorage.removeItem('auth_token');
    }

    async function request(path, { method = 'GET', body, headers, raw = false, signal } = {}) {
        const finalHeaders = { ...(headers || {}) };
        const token = getToken();
        if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

        let payload;
        if (body instanceof FormData) {
            payload = body;
        } else if (body !== undefined) {
            finalHeaders['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, { method, headers: finalHeaders, body: payload, signal });
        } catch (err) {
            throw new ApiError('Нет соединения с сервером', { status: 0, code: 'network', data: err });
        }

        if (raw) return response;

        let data = null;
        const text = await response.text();
        if (text) {
            try { data = JSON.parse(text); } catch { /* leave as null */ }
        }

        if (!response.ok || (data && data.ok === false)) {
            const message = (data && (data.message || data.error)) || `Ошибка ${response.status}`;
            throw new ApiError(message, {
                status: response.status,
                code: data?.error || '',
                data,
            });
        }

        return data;
    }

    window.LifonAPI = {
        ApiError,
        getToken,
        setToken,
        get: (path, opts) => request(path, { ...opts, method: 'GET' }),
        post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
        put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
        patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
        delete: (path, body, opts) => request(path, { ...opts, method: 'DELETE', body }),
        upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData }),
    };
})();

// In-memory KV store that matches the KVNamespace interface used by ratelimit.ts.
// Data resets on process restart — acceptable for rate-limiting use case.

interface Entry {
    value: string;
    expiresAt: number; // ms timestamp, 0 = never
}

export class MemoryKV {
    private readonly store = new Map<string, Entry>();

    async get(key: string): Promise<string | null> {
        const entry = this.store.get(key);
        if (!entry) return null;
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return entry.value;
    }

    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
        const expiresAt = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : 0;
        this.store.set(key, { value, expiresAt });
    }

    async delete(key: string): Promise<void> {
        this.store.delete(key);
    }

    // Periodically prune expired entries to avoid unbounded memory growth.
    prune(): void {
        const now = Date.now();
        for (const [k, v] of this.store) {
            if (v.expiresAt && now > v.expiresAt) this.store.delete(k);
        }
    }
}

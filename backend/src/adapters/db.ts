import Database from 'better-sqlite3';

// D1-compatible SQLite adapter. Wraps better-sqlite3 in a Promise-based API
// that matches the D1Database interface used throughout the routes.

type Row = Record<string, unknown>;

class PreparedAdapter {
    constructor(
        private readonly db: Database.Database,
        private readonly sql: string,
        private readonly args: unknown[] = [],
    ) {}

    bind(...args: unknown[]): PreparedAdapter {
        return new PreparedAdapter(this.db, this.sql, args);
    }

    async first<T = Row>(colName?: string): Promise<T | null> {
        const stmt = this.db.prepare(this.sql);
        const row = stmt.get(...this.args) as Row | undefined;
        if (row === undefined || row === null) return null;
        if (colName !== undefined) return (row[colName] ?? null) as T;
        return row as T;
    }

    async all<T = Row>(): Promise<{ results: T[]; success: boolean }> {
        const stmt = this.db.prepare(this.sql);
        const results = stmt.all(...this.args) as T[];
        return { results, success: true };
    }

    async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number | null } }> {
        const stmt = this.db.prepare(this.sql);
        const info = stmt.run(...this.args);
        return {
            success: true,
            meta: {
                changes: info.changes,
                last_row_id: typeof info.lastInsertRowid === 'bigint'
                    ? Number(info.lastInsertRowid)
                    : info.lastInsertRowid,
            },
        };
    }

    // Used internally by batch()
    _runSync(): void {
        this.db.prepare(this.sql).run(...this.args);
    }
}

export class D1Adapter {
    constructor(private readonly db: Database.Database) {}

    prepare(sql: string): PreparedAdapter {
        return new PreparedAdapter(this.db, sql);
    }

    async batch(statements: PreparedAdapter[]): Promise<{ success: boolean }[]> {
        const run = this.db.transaction(() => {
            for (const stmt of statements) stmt._runSync();
        });
        run();
        return statements.map(() => ({ success: true }));
    }

    async exec(query: string): Promise<{ count: number; duration: number }> {
        this.db.exec(query);
        return { count: 0, duration: 0 };
    }
}

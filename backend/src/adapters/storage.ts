import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

// Filesystem R2 adapter. Stores files under baseDir/{key} with a sidecar
// {key}.meta.json for content-type. Falls back to extension-based MIME guessing
// when no sidecar exists (e.g., files uploaded by the user directly).

const MIME_BY_EXT: Record<string, string> = {
    '.mp3': 'audio/mpeg', '.opus': 'audio/opus', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif',
    '.mp4': 'video/mp4', '.webm': 'video/webm',
    '.lrc': 'text/plain',
};

function guessMime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

async function readMeta(metaPath: string): Promise<{ contentType?: string }> {
    try {
        const raw = await fs.promises.readFile(metaPath, 'utf8');
        return JSON.parse(raw) as { contentType?: string };
    } catch {
        return {};
    }
}

export interface HeadResult {
    size: number;
    etag: string;
    httpMetadata: { contentType?: string };
}

export interface GetResult {
    body: ReadableStream;
    size: number;
    etag: string;
    httpMetadata: { contentType?: string };
}

export class FSStorage {
    constructor(private readonly baseDir: string) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    private resolve(key: string): string {
        // Prevent path traversal
        const rel = path.normalize(key).replace(/^(\.\.[/\\])+/, '');
        return path.join(this.baseDir, rel);
    }

    async head(key: string): Promise<HeadResult | null> {
        const filePath = this.resolve(key);
        try {
            const stat = await fs.promises.stat(filePath);
            const meta = await readMeta(filePath + '.meta.json');
            const contentType = meta.contentType ?? guessMime(filePath);
            const etag = `"${stat.size}-${stat.mtimeMs}"`;
            return { size: stat.size, etag, httpMetadata: { contentType } };
        } catch {
            return null;
        }
    }

    async get(
        key: string,
        options?: { range?: { offset: number; length: number } },
    ): Promise<GetResult | null> {
        const filePath = this.resolve(key);
        try {
            const stat = await fs.promises.stat(filePath);
            const meta = await readMeta(filePath + '.meta.json');
            const contentType = meta.contentType ?? guessMime(filePath);
            const etag = `"${stat.size}-${stat.mtimeMs}"`;

            const streamOpts = options?.range
                ? { start: options.range.offset, end: options.range.offset + options.range.length - 1 }
                : undefined;

            const nodeStream = fs.createReadStream(filePath, streamOpts);
            const body = Readable.toWeb(nodeStream) as ReadableStream;

            return { body, size: stat.size, etag, httpMetadata: { contentType } };
        } catch {
            return null;
        }
    }

    async put(
        key: string,
        body: ReadableStream | ArrayBuffer | ArrayBufferView | string,
        options?: { httpMetadata?: { contentType?: string } },
    ): Promise<void> {
        const filePath = this.resolve(key);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

        if (body instanceof ReadableStream) {
            const chunks: Buffer[] = [];
            const reader = body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(Buffer.from(value));
            }
            await fs.promises.writeFile(filePath, Buffer.concat(chunks));
        } else if (typeof body === 'string') {
            await fs.promises.writeFile(filePath, body, 'utf8');
        } else {
            await fs.promises.writeFile(filePath, Buffer.from(body as ArrayBuffer));
        }

        if (options?.httpMetadata?.contentType) {
            await fs.promises.writeFile(
                filePath + '.meta.json',
                JSON.stringify({ contentType: options.httpMetadata.contentType }),
            );
        }
    }

    async delete(key: string): Promise<void> {
        const filePath = this.resolve(key);
        await fs.promises.unlink(filePath).catch(() => {});
        await fs.promises.unlink(filePath + '.meta.json').catch(() => {});
    }
}

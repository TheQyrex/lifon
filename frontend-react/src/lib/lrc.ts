export interface LrcLine {
    time: number;  // секунды от начала
    text: string;
}

/**
 * Парсит LRC-текст. Поддерживает 2-значные и 3-значные доли секунды.
 * Метаданные ([ar:..], [ti:..]) игнорируются — оставляем только строки с таймстампами.
 */
export function parseLrc(text: string): LrcLine[] {
    const out: LrcLine[] = [];
    for (const raw of text.split('\n')) {
        const m = raw.match(/\[(\d+):(\d+)[.:](\d+)\](.+)/);
        if (!m) continue;
        const minutes = Number(m[1]);
        const seconds = Number(m[2]);
        const frac = m[3];
        const fracVal = Number(frac) / Math.pow(10, frac.length);
        const time = minutes * 60 + seconds + fracVal;
        const lineText = m[4].trim();
        if (!lineText) continue;
        out.push({ time, text: lineText });
    }
    return out.sort((a, b) => a.time - b.time);
}

/**
 * Индекс активной строки для заданного currentTime. -1 если ещё не началась.
 */
export function findActiveLine(lines: LrcLine[], currentTime: number): number {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (currentTime >= lines[i].time) idx = i;
        else break;
    }
    return idx;
}

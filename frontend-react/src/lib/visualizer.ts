// Анализатор баса для пульсации фона в LyricsModal. WebAudio-граф создаётся один раз
// (источник = audio-элемент), при паузе/возобновлении сам AudioContext не пересоздаём.

interface RGB { r: number; g: number; b: number }

let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArr: Uint8Array | null = null;
let initFailed = false;

export function ensureAnalyser(audio: HTMLAudioElement): AnalyserNode | null {
    if (analyser) return analyser;
    if (initFailed) return null;
    try {
        const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        audioCtx = new Ctx();
        const source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        dataArr = new Uint8Array(analyser.frequencyBinCount);
        return analyser;
    } catch {
        initFailed = true;
        return null;
    }
}

export function resumeAudioContext(): void {
    if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
}

export function readFrequencyData(): Uint8Array | null {
    if (!analyser || !dataArr) return null;
    // TS-lib бьётся на различиях ArrayBuffer/SharedArrayBuffer внутри Uint8Array.
    // В нашем случае это всегда обычный ArrayBuffer (мы сами создали выше).
    analyser.getByteFrequencyData(dataArr as Uint8Array<ArrayBuffer>);
    return dataArr;
}

// ----- Доминантный цвет обложки -----

const DEFAULT_COLOR: RGB = { r: 138, g: 43, b: 226 };

export async function extractDominantColor(imageUrl: string): Promise<RGB> {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(DEFAULT_COLOR);
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 40) {
                    r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
                }
                r = Math.floor(r / count);
                g = Math.floor(g / count);
                b = Math.floor(b / count);

                // Подбустим насыщенность для слишком серых обложек
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const sat = max === 0 ? 0 : (max - min) / max;
                if (sat < 0.3) {
                    const boost = 1.5;
                    r = Math.min(255, Math.round(r * boost));
                    g = Math.min(255, Math.round(g * boost));
                    b = Math.min(255, Math.round(b * boost));
                }
                resolve({ r, g, b });
            } catch {
                resolve(DEFAULT_COLOR);
            }
        };
        img.onerror = () => resolve(DEFAULT_COLOR);
        img.src = imageUrl;
    });
}

export function adjustHue(color: RGB, hueShift: number): RGB {
    const r = color.r / 255, g = color.g / 255, b = color.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) { s = 0; } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    h = (h * 360 + hueShift) % 360 / 360;
    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    let nr: number, ng: number, nb: number;
    if (s === 0) {
        nr = ng = nb = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        nr = hue2rgb(p, q, h + 1 / 3);
        ng = hue2rgb(p, q, h);
        nb = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(nr * 255), g: Math.round(ng * 255), b: Math.round(nb * 255) };
}

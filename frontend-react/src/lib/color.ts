/** Extract average dominant color from an image URL. Returns [r, g, b]. */
export function extractDominantColor(src: string): Promise<[number, number, number]> {
    return new Promise((resolve) => {
        const fallback: [number, number, number] = [26, 26, 31];
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 40;
                canvas.height = 40;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(fallback); return; }
                ctx.drawImage(img, 0, 0, 40, 40);
                const data = ctx.getImageData(0, 0, 40, 40).data;
                let r = 0, g = 0, b = 0, n = 0;
                for (let i = 0; i < data.length; i += 4) {
                    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    if (brightness > 15 && brightness < 240) {
                        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
                    }
                }
                resolve(n > 0 ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : fallback);
            } catch {
                resolve(fallback);
            }
        };
        img.onerror = () => resolve(fallback);
        img.src = src;
    });
}

import { useEffect, useRef } from 'react';
import { useUi } from '@/store/ui';

interface Flake {
    x: number; y: number;
    r: number;        // радиус
    vy: number;       // вертикальная скорость
    drift: number;    // амплитуда горизонтального покачивания
    phase: number;    // фаза синусоиды
    speed: number;    // скорость покачивания
}

const COUNT = 70;

export function Snow() {
    const snowOn = useUi((s) => s.snowOn);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!snowOn) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = 0, h = 0;
        const dpr = window.devicePixelRatio || 1;

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            canvas!.width  = w * dpr;
            canvas!.height = h * dpr;
            canvas!.style.width  = `${w}px`;
            canvas!.style.height = `${h}px`;
            ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener('resize', resize);

        const flakes: Flake[] = [];
        for (let i = 0; i < COUNT; i++) {
            flakes.push(createFlake(w, h, true));
        }

        let raf = 0;
        function tick() {
            ctx!.clearRect(0, 0, w, h);
            for (const f of flakes) {
                f.y += f.vy;
                f.phase += f.speed;
                const x = f.x + Math.sin(f.phase) * f.drift;

                ctx!.beginPath();
                ctx!.arc(x, f.y, f.r, 0, Math.PI * 2);
                ctx!.fillStyle = `rgba(255, 255, 255, ${0.35 + f.r * 0.15})`;
                ctx!.fill();

                if (f.y - f.r > h) {
                    Object.assign(f, createFlake(w, h, false));
                    f.y = -f.r;
                }
            }
            raf = requestAnimationFrame(tick);
        }
        tick();

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            ctx!.clearRect(0, 0, w, h);
        };
    }, [snowOn]);

    if (!snowOn) return null;

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2000,
            }}
        />
    );
}

function createFlake(w: number, h: number, scattered: boolean): Flake {
    const r = Math.random() * 1.8 + 0.4;
    return {
        x: Math.random() * w,
        y: scattered ? Math.random() * h : -r,
        r,
        vy: 0.2 + Math.random() * 0.7 + r * 0.2,
        drift: 8 + Math.random() * 24,
        phase: Math.random() * Math.PI * 2,
        speed: 0.005 + Math.random() * 0.015,
    };
}

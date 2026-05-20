import { useEffect, useState } from 'react';
import { useLikes } from '@/store/likes';
import { extractDominantColor } from '@/lib/color';
import type { Track } from '@/types/api';

interface Props {
    track: Track;
    cover: string | null;
    isCurrent?: boolean;
    onPlay?: (id: number) => void;
}

export function FavoriteRow({ track, cover, isCurrent, onPlay }: Props) {
    const liked = useLikes((s) => s.liked.has(track.id));
    const toggle = useLikes((s) => s.toggle);
    const [color, setColor] = useState<[number, number, number] | null>(null);

    useEffect(() => {
        if (cover) extractDominantColor(cover).then(setColor);
    }, [cover]);

    const bgStyle = color
        ? {
            backgroundColor: `rgba(${color[0]},${color[1]},${color[2]},${isCurrent ? 0.22 : 0.13})`,
            borderRadius: '12px',
            border: `1px solid rgba(${color[0]},${color[1]},${color[2]},0.25)`,
        }
        : { borderRadius: '12px' };

    return (
        <div
            className={`track-item favorite-row${isCurrent ? ' playing' : ''}`}
            style={bgStyle}
            onClick={() => onPlay?.(track.id)}
        >
            {cover ? (
                <img src={cover} alt="" className="favorite-cover" />
            ) : (
                <div className="favorite-cover favorite-cover-placeholder">♪</div>
            )}
            <div className="track-info">
                <div className="track-title">{track.title}</div>
                <div className="track-artist">{track.artist}</div>
            </div>
            <div className="track-duration">{track.duration}</div>
            <button
                className={`btn-like${liked ? ' liked' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggle(track.id); }}
                type="button"
                aria-label="Лайк"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
            </button>
        </div>
    );
}

import { useLikes } from '@/store/likes';
import { useLive } from '@/store/live';
import type { Track } from '@/types/api';

interface Props {
    track: Track;
    index: number;
    isCurrent?: boolean;
    onPlay?: (id: number) => void;
}

export function TrackRow({ track, index, isCurrent, onPlay }: Props) {
    const liked = useLikes((s) => s.liked.has(track.id));
    const toggle = useLikes((s) => s.toggle);
    const liveCount = useLive((s) => s.tracks[track.id] ?? 0);

    return (
        <div
            className={`track-item${isCurrent ? ' playing' : ''}`}
            onClick={() => onPlay?.(track.id)}
        >
            <div className="track-number">{index + 1}</div>
            <div className="track-info">
                <div className="track-title">
                    {track.title}
                    {liveCount > 1 && (
                        <span className="track-live" title={`${liveCount} слушают сейчас`}>
                            <span className="track-live-dot" />
                            {liveCount}
                        </span>
                    )}
                </div>
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

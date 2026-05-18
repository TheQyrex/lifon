import { useEffect } from 'react';
import { useBroadcasts, parseMeta, type BroadcastItem } from '@/store/broadcasts';
import { useAuth } from '@/store/auth';
import { Formatted } from '@/lib/markdown';
import { toAbsoluteAsset } from '@/lib/assets';

export function Broadcasts() {
    const { notification, banner, dismissed, dismiss } = useBroadcasts();
    const user = useAuth((s) => s.user);

    // body-класс для сдвига контента вниз
    useEffect(() => {
        const visibleNotif = notification && !dismissed.has(`n:${notification.id}`);
        document.body.classList.toggle('app-has-notification', !!visibleNotif);
        return () => { document.body.classList.remove('app-has-notification'); };
    }, [notification, dismissed]);

    const showNotif  = notification && !dismissed.has(`n:${notification.id}`);
    const showBanner = banner       && !dismissed.has(`b:${banner.id}`);

    return (
        <div id="broadcastRoot">
            {showNotif && (
                <NotificationBar
                    item={notification}
                    noSidebar={!user}
                    onClose={() => dismiss(`n:${notification.id}`)}
                />
            )}

            {showBanner && (
                <BannerModal
                    item={banner}
                    onClose={() => dismiss(`b:${banner.id}`)}
                />
            )}
        </div>
    );
}

function NotificationBar({ item, noSidebar, onClose }: { item: BroadcastItem; noSidebar: boolean; onClose: () => void }) {
    const meta = parseMeta(item.meta);
    const style: React.CSSProperties = {};
    if (meta.bg)         style.background = meta.bg;
    if (meta.color)      style.color      = meta.color;
    if (meta.title_size) style.fontSize   = `${meta.title_size}px`;

    return (
        <div className={`broadcast-bar${noSidebar ? ' no-sidebar' : ''}`} role="status" style={style}>
            <span className="broadcast-bar-title">{item.title}</span>
            <button
                className="broadcast-bar-close"
                aria-label="Закрыть"
                onClick={onClose}
                type="button"
                style={{ color: meta.color }}
            >
                ×
            </button>
        </div>
    );
}

function BannerModal({ item, onClose }: { item: BroadcastItem; onClose: () => void }) {
    const meta = parseMeta(item.meta);
    const cardStyle: React.CSSProperties = {};
    if (meta.bg)    cardStyle.background = meta.bg;
    if (meta.color) cardStyle.color      = meta.color;

    const videoUrl = meta.video_url ? toAbsoluteAsset(meta.video_url) : null;

    return (
        <div className="broadcast-modal" role="dialog" aria-modal="true">
            <div className="broadcast-modal-backdrop" onClick={onClose} />
            <div className="broadcast-card" style={cardStyle}>
                {videoUrl && (
                    <video className="broadcast-card-video" controls playsInline src={videoUrl} />
                )}
                {!videoUrl && item.image_url && (
                    <img src={item.image_url} className="broadcast-card-image" alt="" />
                )}
                <h2 className="broadcast-card-title" style={meta.title_size ? { fontSize: meta.title_size } : undefined}>
                    {item.title}
                </h2>
                {item.body && (
                    <div className="broadcast-card-body" style={meta.body_size ? { fontSize: meta.body_size } : undefined}>
                        <Formatted text={item.body} />
                    </div>
                )}

                {meta.buttonRows?.map((row, ri) => (
                    <div className="broadcast-card-button-row" key={ri}>
                        {row.map((b, bi) => (
                            <a
                                key={bi}
                                href={b.url}
                                target="_blank"
                                rel="noopener"
                                className="broadcast-card-btn"
                                style={{ background: b.color, color: b.text_color || '#fff' }}
                            >
                                {b.label}
                            </a>
                        ))}
                    </div>
                ))}

                <button className="broadcast-card-ok" type="button" onClick={onClose}>
                    Понятно
                </button>
            </div>
        </div>
    );
}

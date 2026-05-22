import { useEffect, useRef } from 'react';
import { useAchievements } from '@/store/achievements';
import { toAbsoluteAsset } from '@/lib/assets';

export function AchievementPopup() {
    const popup = useAchievements((s) => s.currentPopup);
    const dismiss = useAchievements((s) => s.dismissPopup);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!popup) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(dismiss, 6000);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [popup, dismiss]);

    if (!popup) return null;

    const iconUrl = popup.icon_url ? toAbsoluteAsset(popup.icon_url) : null;

    return (
        <div className="achievement-popup" onClick={dismiss} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && dismiss()}>
            <div className="achievement-popup-inner">
                <div className="achievement-popup-icon">
                    {iconUrl ? (
                        <img src={iconUrl} alt="" className="achievement-popup-img" />
                    ) : (
                        <span className="achievement-popup-emoji">🏆</span>
                    )}
                </div>
                <div className="achievement-popup-text">
                    <div className="achievement-popup-label">Новая ачивка!</div>
                    <div className="achievement-popup-name">{popup.name}</div>
                    {popup.description && (
                        <div className="achievement-popup-desc">{popup.description}</div>
                    )}
                </div>
                <button className="achievement-popup-close" onClick={dismiss} type="button" aria-label="Закрыть">×</button>
            </div>
        </div>
    );
}

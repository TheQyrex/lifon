import { useUi } from '@/store/ui';

export function WelcomeScreen() {
    const goToAuth = useUi((s) => s.goToAuth);
    return (
        <div className="welcome-screen">
            <div className="welcome-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="welcome-logo" />
                <p className="welcome-subtitle">Полная дискография CUPSIZE в одном месте</p>

                <div className="welcome-features">
                    <div className="feature-item">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                        </svg>
                        <div className="feature-item-text">
                            <h3>Синхронизированные тексты</h3>
                            <p>Следите за текстами песен в реальном времени</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
                        </svg>
                        <div className="feature-item-text">
                            <h3>Вся дискография</h3>
                            <p>106 треков из 10 альбомов</p>
                        </div>
                    </div>
                    <div className="feature-item">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <div className="feature-item-text">
                            <h3>Избранное</h3>
                            <p>Сохраняйте любимые треки</p>
                        </div>
                    </div>
                </div>

                <button className="btn-welcome" type="button" onClick={goToAuth}>
                    Войти
                </button>

                <p className="welcome-credits">by videlsvet &amp; dangershark</p>
            </div>
        </div>
    );
}

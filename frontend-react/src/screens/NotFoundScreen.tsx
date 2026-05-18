import { Link } from 'react-router-dom';

export function NotFoundScreen() {
    return (
        <div id="notFoundScreen" className="screen active" style={{ textAlign: 'center', paddingTop: '15vh' }}>
            <h1 style={{ fontSize: 96, fontWeight: 900, color: '#E8D5FF', marginBottom: 16, letterSpacing: '-2px' }}>404</h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 32 }}>
                Такой страницы нет.
            </p>
            <Link
                to="/"
                style={{
                    display: 'inline-block',
                    padding: '14px 32px',
                    background: '#fff',
                    color: '#000',
                    borderRadius: 18,
                    fontWeight: 700,
                    fontSize: 16,
                    textDecoration: 'none',
                }}
            >
                Вернуться в плеер
            </Link>
        </div>
    );
}

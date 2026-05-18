import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Supporter } from '@/types/api';

export function AboutScreen() {
    const [supporters, setSupporters] = useState<Supporter[] | null>(null);

    useEffect(() => {
        api.get<{ ok: true; supporters: Supporter[] }>('/supporters')
            .then((res) => setSupporters(res.supporters))
            .catch(() => setSupporters([]));
    }, []);

    return (
        <div id="aboutScreen" className="screen active">
            <div className="about-content">
                <div className="screen-header">
                    <h1>О LifonMUSIC</h1>
                </div>

                <div className="about-card">
                    <p className="about-text">
                        LifonMUSIC — независимый проект и не имеет отношения к официальным
                        представителям группы CUPSIZE. Если вам нравится их творчество,
                        поддержите артистов: купите мерч или сходите на концерт!
                    </p>
                    <div className="about-authors">
                        <p className="about-by">by</p>
                        <div className="authors-list">
                            <div className="author-item">
                                <img src="/videlsvet.png" alt="videlsvet" className="author-avatar" />
                                <span>videlsvet</span>
                            </div>
                            <span className="author-separator">&</span>
                            <div className="author-item">
                                <img src="/dangershark.png" alt="dangershark" className="author-avatar" />
                                <span>dangershark</span>
                            </div>
                            <span className="author-separator">&</span>
                            <div className="author-item">
                                <img src="https://i.imgur.com/2nfkuwH.jpeg" alt="qyrex" className="author-avatar" />
                                <span>qyrex</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="about-card" style={{ marginTop: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#E8D5FF', textAlign: 'center' }}>
                        Спасибо за поддержку
                    </h3>
                    <div className="supporters-list">
                        {supporters === null ? (
                            <div style={{ textAlign: 'center', padding: '8px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                                Загружаем…
                            </div>
                        ) : (
                            supporters.map((s) => <SupporterItem key={s.id} supporter={s} />)
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SupporterItem({ supporter: s }: { supporter: Supporter }) {
    const initial = (s.name || '?').charAt(0).toUpperCase();
    return (
        <div
            className="supporter-item"
            style={{ background: `${s.color}18`, borderColor: `${s.color}40` }}
        >
            <div className="supporter-left">
                <div
                    className="supporter-avatar"
                    style={{ background: `${s.color}33`, borderColor: `${s.color}66`, color: s.color }}
                >
                    {initial}
                </div>
                <div className="supporter-name">{s.name}</div>
            </div>
            <div className="supporter-handle">{s.handle}</div>
        </div>
    );
}

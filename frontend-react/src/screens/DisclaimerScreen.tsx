import { useUi } from '@/store/ui';

export function DisclaimerScreen() {
    const acceptDisclaimer = useUi((s) => s.acceptDisclaimer);
    return (
        <div className="disclaimer">
            <div className="disclaimer-content">
                <h1>⚠️ Дисклеймер</h1>
                <p>LifonMUSIC — это независимый фан-проект, не связанный с официальными представителями CUPSIZE.</p>
                <p>Все используемые материалы (музыка, обложки) принадлежат группе CUPSIZE.</p>
                <p>Приложение создано с любовью к творчеству группы и предназначено исключительно для фанатов.</p>
                <button className="btn-primary" type="button" onClick={acceptDisclaimer}>
                    Понятно, продолжить
                </button>
            </div>
        </div>
    );
}

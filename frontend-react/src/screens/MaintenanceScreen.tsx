import { useUi } from '@/store/ui';

interface Props {
    message: string;
}

export function MaintenanceScreen({ message }: Props) {
    const goToAuth = useUi((s) => s.goToAuth);
    return (
        <div className="maintenance-screen">
            <div className="maintenance-content">
                <img src="/Logo.png" alt="LifonMUSIC" className="maintenance-logo" />
                <h1>Технические работы</h1>
                <p>{message}</p>
                <button className="btn-primary" type="button" onClick={goToAuth}>
                    Войти как админ
                </button>
            </div>
        </div>
    );
}

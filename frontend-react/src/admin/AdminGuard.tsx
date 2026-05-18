import { Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';

interface Props {
    children: React.ReactNode;
}

export function AdminGuard({ children }: Props) {
    const { user, ready } = useAuth();

    if (!ready) return null;
    if (!user) return <Navigate to="/" replace />;
    if (!user.is_admin) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-white">
                <div className="max-w-sm text-center space-y-3">
                    <h1 className="text-2xl font-bold text-accent">Доступ закрыт</h1>
                    <p className="text-white/60">У вас нет прав администратора.</p>
                    <a href="/" className="inline-block mt-4 text-accent hover:underline">← К плееру</a>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

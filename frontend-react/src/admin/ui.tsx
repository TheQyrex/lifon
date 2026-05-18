// Минимальный набор UI-примитивов для админки. Tailwind, без оригинального CSS.

import { forwardRef, type ComponentProps, type ReactNode } from 'react';

// --- Card -------------------------------------------------------------

interface CardProps {
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
    className?: string;
}

export function Card({ title, description, actions, children, className = '' }: CardProps) {
    return (
        <section className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 ${className}`}>
            {(title || actions) && (
                <header className="mb-4 flex items-start justify-between gap-4">
                    <div>
                        {title && <h2 className="text-lg font-bold text-white">{title}</h2>}
                        {description && <p className="mt-1 text-sm text-white/50">{description}</p>}
                    </div>
                    {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
                </header>
            )}
            {children}
        </section>
    );
}

// --- Button -----------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ComponentProps<'button'> {
    variant?: ButtonVariant;
    size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary:   'bg-accent text-bg-bot hover:opacity-90',
    secondary: 'bg-white/10 text-white hover:bg-white/15',
    danger:    'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30',
    ghost:     'bg-transparent text-white/60 hover:text-white hover:bg-white/5',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
};

// Preflight у Tailwind отключён (чтобы не ломать плеер), поэтому <button> приходит с нативной
// chrome — на macOS это серый 3D-стиль. Приходится сбрасывать руками.
const BUTTON_RESET = 'appearance-none border-0 outline-none cursor-pointer font-sans focus-visible:ring-2 focus-visible:ring-accent/50';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', className = '', type = 'button', ...rest },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={`${BUTTON_RESET} inline-flex items-center justify-center font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
            {...rest}
        />
    );
});

// --- Input / Field -----------------------------------------------------

interface FieldProps {
    label?: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function Field({ label, hint, error, children, className = '' }: FieldProps) {
    return (
        <label className={`block ${className}`}>
            {label && <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{label}</span>}
            {children}
            {hint && !error && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
            {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
        </label>
    );
}

const INPUT_BASE = 'appearance-none w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-accent/40 focus:outline-none transition font-sans';

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input(
    { className = '', ...rest },
    ref,
) {
    return <input ref={ref} className={`${INPUT_BASE} ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(function Textarea(
    { className = '', ...rest },
    ref,
) {
    return <textarea ref={ref} className={`${INPUT_BASE} min-h-[80px] resize-y ${className}`} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, ComponentProps<'select'>>(function Select(
    { className = '', children, ...rest },
    ref,
) {
    return <select ref={ref} className={`${INPUT_BASE} ${className}`} {...rest}>{children}</select>;
});

// --- Flash (toast inline) ---------------------------------------------

interface FlashProps {
    children: ReactNode;
    kind?: 'info' | 'success' | 'error';
}

export function Flash({ children, kind = 'info' }: FlashProps) {
    const styles: Record<string, string> = {
        info:    'bg-white/5 text-white/70 border-white/10',
        success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        error:   'bg-red-500/15 text-red-300 border-red-500/30',
    };
    return (
        <div className={`rounded-lg border px-3 py-2 text-sm ${styles[kind]}`}>{children}</div>
    );
}

// --- Stat box ---------------------------------------------------------

export function StatBox({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
            <div className="mt-1 text-2xl font-bold text-accent">{value}</div>
        </div>
    );
}

// --- Table ------------------------------------------------------------

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`overflow-x-auto rounded-xl border border-white/[0.06] ${className}`}>
            <table className="min-w-full text-left text-sm">
                {children}
            </table>
        </div>
    );
}

export function Th({ children }: { children: ReactNode }) {
    return <th className="px-4 py-2.5 text-xs uppercase tracking-wide text-white/40 bg-white/[0.02] font-medium">{children}</th>;
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <td className={`px-4 py-2.5 border-t border-white/[0.04] ${className}`}>{children}</td>;
}

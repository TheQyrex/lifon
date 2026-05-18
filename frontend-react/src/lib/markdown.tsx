import { Fragment } from 'react';

/**
 * Лёгкий markdown-ish рендерер для текста рассылок. Поддерживает:
 *   **жирный**, *курсив*, `моноширинный`, \n как <br>, \n\n как новый параграф.
 * Текст вне токенов выводится как обычный textNode — XSS-безопасно.
 */
export function Formatted({ text }: { text: string }) {
    const paragraphs = String(text || '').split(/\n{2,}/).filter((p) => p.trim());
    return (
        <>
            {paragraphs.map((p, i) => (
                <p key={i}>{renderInline(p)}</p>
            ))}
        </>
    );
}

function renderInline(source: string): React.ReactNode[] {
    const pattern = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\n)/g;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = pattern.exec(source)) !== null) {
        if (m.index > last) out.push(<Fragment key={key++}>{source.slice(last, m.index)}</Fragment>);
        const tok = m[0];
        if (tok === '\n') {
            out.push(<br key={key++} />);
        } else if (tok.startsWith('**')) {
            out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
        } else if (tok.startsWith('*')) {
            out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
        } else if (tok.startsWith('`')) {
            out.push(<code key={key++}>{tok.slice(1, -1)}</code>);
        }
        last = m.index + tok.length;
    }
    if (last < source.length) out.push(<Fragment key={key++}>{source.slice(last)}</Fragment>);
    return out;
}

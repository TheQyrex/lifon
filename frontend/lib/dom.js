// DOM construction helper. Prefer this over innerHTML when the content
// contains any user-supplied data — `textContent` is safe from XSS while
// `innerHTML` is not.

(function () {
    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);

        for (const [key, value] of Object.entries(attrs || {})) {
            if (value == null || value === false) continue;
            if (key === 'class') {
                node.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(node.style, value);
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(node.dataset, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                node.addEventListener(key.slice(2).toLowerCase(), value);
            } else if (key === 'text') {
                node.textContent = value;
            } else if (key === 'html') {
                // Caller has explicitly opted in to HTML insertion — only used for
                // pre-sanitised content. Keep separate from `text` so reviews catch it.
                node.innerHTML = value;
            } else if (typeof value === 'boolean') {
                if (value) node.setAttribute(key, '');
            } else {
                node.setAttribute(key, String(value));
            }
        }

        const list = Array.isArray(children) ? children : [children];
        for (const child of list) {
            if (child == null || child === false) continue;
            node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        }

        return node;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    // Minimal allowlist-based renderer for broadcast banner bodies.
    // Supports inline formatting: *italic*, `mono`, **bold**, plus paragraph breaks
    // on blank lines. Everything else is escaped via textContent.
    function renderFormatted(text) {
        const fragment = document.createDocumentFragment();
        const paragraphs = String(text || '').split(/\n{2,}/);
        for (const paragraph of paragraphs) {
            if (!paragraph.trim()) continue;
            const p = document.createElement('p');
            appendInline(p, paragraph);
            fragment.appendChild(p);
        }
        return fragment;
    }

    function appendInline(parent, source) {
        const pattern = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\n)/g;
        let last = 0;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            if (match.index > last) parent.appendChild(document.createTextNode(source.slice(last, match.index)));
            const token = match[0];
            if (token === '\n') {
                parent.appendChild(document.createElement('br'));
            } else if (token.startsWith('**')) {
                parent.appendChild(el('strong', { text: token.slice(2, -2) }));
            } else if (token.startsWith('*')) {
                parent.appendChild(el('em', { text: token.slice(1, -1) }));
            } else if (token.startsWith('`')) {
                parent.appendChild(el('code', { text: token.slice(1, -1) }));
            }
            last = match.index + token.length;
        }
        if (last < source.length) parent.appendChild(document.createTextNode(source.slice(last)));
    }

    window.LifonDOM = { el, clear, renderFormatted };
})();

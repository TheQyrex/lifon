// Runtime configuration. Set window.__LIFON_API__ from index.html (or via
// the deployment platform) to override per-environment.
window.LIFON_CONFIG = Object.freeze({
    API_BASE: window.__LIFON_API__ || 'https://test.lifonmusic.lol/api',
});

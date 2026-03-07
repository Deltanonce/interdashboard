// dom-cache.js — lightweight DOM lookup cache for hot paths
(function () {
    'use strict';

    const cache = new Map();

    const HOT_IDS = [
        'clock-display', 'date-display', 'utc-clock',
        'recv-rate', 'send-rate',
        'countdown-display',
        'loading-overlay', 'loading-text', 'loading-steps',
        'refresh-btn',
        'live-adsb-count', 'live-ais-count',
        'toolbar-adsb-count', 'toolbar-ais-count',
        'ais-status-dot', 'toolbar-ais-dot',
        'ais-key-dot', 'ais-key-text'
    ];

    function init() {
        HOT_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (el) cache.set(id, el);
        });
    }

    function get(id) {
        const cached = cache.get(id);
        if (cached && cached.isConnected) return cached;

        const el = document.getElementById(id);
        if (el) cache.set(id, el);
        else cache.delete(id);
        return el;
    }

    function invalidate(id) {
        cache.delete(id);
    }

    function invalidateAll() {
        cache.clear();
    }

    window.DOMCache = { init, get, invalidate, invalidateAll };
})();

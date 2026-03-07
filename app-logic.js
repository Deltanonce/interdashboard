
// ===== STATE =====
let scenarios = (typeof SCENARIOS !== 'undefined') ? SCENARIOS.map(s => ({ ...s })) : [];
let currentThreatLevel = 4, refreshCount = 0, countdownSeconds = 300;
let countdownTimer = null, isLoading = false;
let _sparkCache = new Map(), _sparkCacheLen = 0;
let radarChart = null, currentPerspective = 'iran';
let activeFeedFilter = 'all', credFilterOn = false, uvVisible = false;
let lastRedPhoneTime = 0;


function getEl(id) {
    if (typeof window !== 'undefined' && window.DOMCache && typeof window.DOMCache.get === 'function') {
        return window.DOMCache.get(id);
    }
    return document.getElementById(id);
}


// Panel collapse state
const PANEL_STATES = {
    'gap-card': { collapsed: false },
    'assumptions-card': { collapsed: false },
    'snapshot-card': { collapsed: true }
};

function togglePanel(cardId) {
    const state = PANEL_STATES[cardId];
    if (!state) return;
    state.collapsed = !state.collapsed;
    const content = document.getElementById(cardId + '-content');
    const chevron = document.getElementById(cardId + '-chevron');
    if (content) {
        content.style.maxHeight = state.collapsed ? '0px' : '2000px';
        content.style.overflow = state.collapsed ? 'hidden' : 'visible';
        content.style.transition = 'max-height 0.3s ease';
        content.style.marginTop = state.collapsed ? '0' : '';
    }
    if (chevron) chevron.textContent = state.collapsed ? '▶' : '▼';
}

function initPanelStates() {
    Object.keys(PANEL_STATES).forEach(cardId => {
        if (PANEL_STATES[cardId].collapsed) {
            const content = document.getElementById(cardId + '-content');
            const chevron = document.getElementById(cardId + '-chevron');
            if (content) {
                content.style.maxHeight = '0px';
                content.style.overflow = 'hidden';
            }
            if (chevron) chevron.textContent = '▶';
        }
    });
}

function toggleAccordionSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return false;
    section.open = !section.open;
    return true;
}

// Timers
let masterClockTimer = null;
let liveNewsTimer = null;
let newsInjectTimer = null;
let bootFailsafeTimer = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    if (typeof scenarios !== 'undefined' && Array.isArray(scenarios)) {
        scenarios = scenarios.map(s => ({ ...s, base: s.base ?? s.current }));
        if (typeof recomputeAllCurrents === 'function') recomputeAllCurrents();
    } else {
        console.error('[INIT] FATAL: scenarios not defined');
    }

    runBootSequence().catch(e => { });

    const fontLink = document.getElementById('font-link');
    if (fontLink) fontLink.media = 'all';

    if (bootFailsafeTimer) clearTimeout(bootFailsafeTimer);
    bootFailsafeTimer = setTimeout(() => {
        hideLoadingOverlay();
        const bs = document.getElementById('boot-sequence');
        if (bs) bs.classList.add('hidden');
    }, 15000);
});

async function runBootSequence() {
    const lines = [
        'INITIALIZING STRATEGIC COMMAND NETWORK...',
        'ESTABLISHING SECURE HANDSHAKE [RSA-4096]...',
        'BYPASSING PROXY FIREWALLS...',
        'CONNECTING TO SATELLITE FEED (VANDENBERG AFB)...',
        'LINK SUCCESSFUL.',
        'LOADING INTEL DASHBOARD v4.0...'
    ];
    const logEl = document.getElementById('boot-log');
    const barEl = document.getElementById('boot-bar');

    for (let i = 0; i < lines.length; i++) {
        if (!logEl || !barEl) break;
        const line = document.createElement('div');
        line.textContent = '> ' + lines[i];
        logEl.appendChild(line);
        barEl.style.width = ((i + 1) / lines.length * 100) + '%';
        await sleep(300 + Math.random() * 400);
    }

    await sleep(400);
    const seq = getEl('boot-sequence');
    if (seq) seq.classList.add('hidden');
    try { if (window.DOMCache && typeof window.DOMCache.init === 'function') window.DOMCache.init(); } catch (e) { }

    // FIX 1: initTabs() was undefined — removed call, initTabEvents() handles this at bottom
    try {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.key.toUpperCase()) {
                case 'R': if (!isLoading) triggerRefresh(); break;
                case 'S': saveSnapshot(); break;
                case 'A':
                    if (!toggleAccordionSection('acc-summary')) togglePanel('assumptions-card');
                    break;
                case 'G':
                    if (!toggleAccordionSection('acc-summary')) togglePanel('gap-card');
                    break;
                case 'H':
                    if (!toggleAccordionSection('acc-logs')) togglePanel('snapshot-card');
                    break;
                case 'ESCAPE': acknowledgeRedPhone(); break;
                default:
                    const n = parseInt(e.key);
                    if (n >= 1 && n <= 9) {
                        const sections = document.querySelectorAll('.acc-item');
                        const target = sections[n - 1];
                        if (target) {
                            target.open = true;
                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
            }
        });
        initPanelStates();
    } catch (e) { }

    try {
        updateClock();
        if (masterClockTimer) clearInterval(masterClockTimer);
        masterClockTimer = setInterval(updateClock, 1000);
        startThroughputTicker();
    } catch (e) { }

    try { initMap(); } catch (e) { }
    try {
        await waitForMapBridgeReady(4000);
        if (typeof AssetTracker !== 'undefined') AssetTracker.start();
    } catch (e) {
        console.warn('[BOOT] Asset tracker delayed: map bridge not ready yet.');
    }
    try { initRadarChart(); } catch (e) { }
    try { computeIW(); renderIW(); } catch (e) { }
    try { renderACH(); } catch (e) { }
    try { renderRedTeam(); } catch (e) { }
    try { renderNetAssessTable(); } catch (e) { }
    try { renderCone(); } catch (e) { }
    try { renderSIGINT(); } catch (e) { }
    try { renderPropaganda(); } catch (e) { }
    try { renderUnverified(); } catch (e) { }
    try { renderChronology(); } catch (e) { }

    // Live News Engine
    if (liveNewsTimer) clearInterval(liveNewsTimer);
    liveNewsTimer = setInterval(() => {
        if (typeof VERIFIED_NEWS !== 'undefined' && Array.isArray(VERIFIED_NEWS)) {
            VERIFIED_NEWS.forEach(n => { n.time++; });
            renderNews();
        }
    }, 60000);

    function startLiveNewsEngine() {
        const hasVerified = typeof LIVE_NEWS_POOL !== 'undefined' && LIVE_NEWS_POOL.length > 0;
        const hasPropaganda = typeof LIVE_PROPAGANDA_POOL !== 'undefined' && LIVE_PROPAGANDA_POOL.length > 0;
        const hasUnverified = typeof LIVE_UNVERIFIED_POOL !== 'undefined' && LIVE_UNVERIFIED_POOL.length > 0;

        if (hasVerified || hasPropaganda || hasUnverified) {
            const delay = Math.floor(Math.random() * 10000) + 8000;
            if (newsInjectTimer) clearTimeout(newsInjectTimer);
            newsInjectTimer = setTimeout(() => {
                const pools = [];
                if (hasVerified) pools.push({ pool: LIVE_NEWS_POOL, type: 'verified' }, { pool: LIVE_NEWS_POOL, type: 'verified' });
                if (hasPropaganda) pools.push({ pool: LIVE_PROPAGANDA_POOL, type: 'propaganda' });
                if (hasUnverified) pools.push({ pool: LIVE_UNVERIFIED_POOL, type: 'unverified' });

                if (pools.length === 0) return;
                const selected = pools[Math.floor(Math.random() * pools.length)];
                if (!selected.pool || selected.pool.length === 0) return;

                const nextItem = selected.pool.shift();

                if (selected.type === 'verified' && typeof VERIFIED_NEWS !== 'undefined') {
                    nextItem.time = 0;
                    VERIFIED_NEWS.unshift(nextItem);
                    if (VERIFIED_NEWS.length > 25) VERIFIED_NEWS.splice(20);
                    renderNews();
                    const c = document.getElementById('osint-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                } else if (selected.type === 'propaganda' && typeof PROPAGANDA_NEWS !== 'undefined') {
                    PROPAGANDA_NEWS.unshift(nextItem);
                    if (PROPAGANDA_NEWS.length > 15) PROPAGANDA_NEWS.splice(12);
                    renderPropaganda();
                    const c = document.getElementById('prop-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                } else if (selected.type === 'unverified' && typeof UNVERIFIED_NEWS !== 'undefined') {
                    UNVERIFIED_NEWS.unshift(nextItem);
                    if (UNVERIFIED_NEWS.length > 10) UNVERIFIED_NEWS.splice(8);
                    renderUnverified();
                    const c = document.getElementById('unverified-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                }

                startLiveNewsEngine();
            }, delay);
        }
    }
    try { startLiveNewsEngine(); } catch (e) { }

    simulateRefresh(true).catch(e => { hideLoadingOverlay(); });
}

async function waitForMapBridgeReady(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (window.viewer && typeof window.addOrUpdateLiveAsset === 'function') return;
        await sleep(200);
    }
    throw new Error('map-bridge-timeout');
}

function hideLoadingOverlay() {
    try { const overlay = getEl('loading-overlay'); if (overlay) overlay.classList.add('hidden'); } catch (e) { }
}

// ===== CLOCK =====
function updateClock() {
    const now = new Date(), utc = now.getTime() + now.getTimezoneOffset() * 60000, wib = new Date(utc + 7 * 3600000);
    const p = n => String(n).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const clockEl = getEl('clock-display');
    const dateEl = getEl('date-display');
    const utcEl = getEl('utc-clock');
    if (clockEl) clockEl.textContent = `${p(wib.getHours())}:${p(wib.getMinutes())}:${p(wib.getSeconds())} WIB`;
    if (dateEl) dateEl.textContent = `${p(wib.getDate())} ${months[wib.getMonth()]} ${wib.getFullYear()}`;
    if (utcEl) utcEl.textContent = now.toISOString().replace('T', ' ').split('.')[0] + 'Z';
}

function startThroughputTicker() {
    const recvEl = getEl('recv-rate');
    const sendEl = getEl('send-rate');
    if (!recvEl && !sendEl) return;
    const tick = () => {
        if (recvEl) recvEl.textContent = (14 + Math.random() * 2.5).toFixed(1);
        if (sendEl) sendEl.textContent = (2 + Math.random() * 0.8).toFixed(1);
    };
    tick();
    setInterval(tick, 2200);
}

// ===== COUNTDOWN =====
function startCountdown() {
    countdownSeconds = 300;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        countdownSeconds--;
        if (countdownSeconds <= 0) {
            countdownSeconds = 0;
            clearInterval(countdownTimer);
            if (!isLoading) simulateRefresh(false);
        }
        const m = Math.floor(countdownSeconds / 60), s = countdownSeconds % 60;
        const el = getEl('countdown-display');
        if (el) el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
}
function triggerRefresh() { if (!isLoading) { clearInterval(countdownTimer); simulateRefresh(false); } }

// ===== SIMULATE REFRESH =====
async function simulateRefresh(isInitial) {
    isLoading = true;
    const btn = getEl('refresh-btn');
    if (btn) btn.classList.add('loading');
    const overlay = getEl('loading-overlay');
    const ltxt = getEl('loading-text');
    const lsteps = getEl('loading-steps');
    if (overlay) overlay.classList.remove('hidden');
    if (lsteps) lsteps.innerHTML = '';

    const steps = [
        'KONEKSI AMAN TERBENTUK...', 'WEB SEARCH: REUTERS/AP/ISW/IAEA...',
        'ANALISIS BERITA KONFLIK IRAN-ISRAEL-AS...', 'I&W MATRIX: EVALUASI 16 INDIKATOR...',
        'ACH: SCORING COMPETING HYPOTHESES...', 'RED TEAM: KALKULASI PAYOFF MATRIX...',
        'NET ASSESSMENT: RADAR UPDATE...', 'SIGINT FUSION: SIGNAL vs NOISE...',
        'UPDATE 12 PROBABILITAS + CONFIDENCE...', 'FILTER PROPAGANDA & UNVERIFIED INTEL...'
    ];

    for (let i = 0; i < steps.length; i++) {
        if (ltxt) ltxt.textContent = isInitial ? 'MEMULAI INTEL DASHBOARD v4.0...' : 'MULTI-METHOD INTELLIGENCE UPDATE...';
        if (lsteps) {
            const el = document.createElement('div');
            el.className = 'loading-step step-active';
            el.textContent = `▸ ${steps[i]}`;
            lsteps.appendChild(el);
            await sleep(isInitial ? 220 : 130);
            el.className = 'loading-step step-done';
            el.textContent = `✓ ${steps[i].replace('...', '').trim()}`;
        }
    }

    try {
        applyProbabilityUpdate();
        renderAll();

        if (!isInitial) {
            const RPCOOLDOWN = 28 * 60 * 1000;
            const criticalSpike = scenarios.find(s =>
                s.group === 'militer' &&
                s.confBase !== 'spec' &&
                s.current > 38 &&
                (s.current - s.baseline) >= 15
            );
            if (criticalSpike && (Date.now() - lastRedPhoneTime > RPCOOLDOWN)) {
                lastRedPhoneTime = Date.now();
                const rpMsg = document.getElementById('rp-message');
                const rpModal = document.getElementById('red-phone-modal');
                if (rpMsg) rpMsg.innerHTML =
                    `Peringatan Darurat: Lonjakan tajam pada skenario <strong>${criticalSpike.name}</strong> (+${(criticalSpike.current - criticalSpike.baseline).toFixed(1)}%).<br><br>
                    Sistem mendeteksi pergeseran probabilitas kritis yang memerlukan perhatian segera.`;
                if (rpModal) rpModal.classList.remove('hidden');
            }
        }
    } catch (e) {
        console.error('Error during simulateRefresh:', e);
    }

    try {
        await sleep(250);
        hideLoadingOverlay();
        try { initMap(); } catch (e) { console.error('initMap post-load:', e); }
        try { if (btn) btn.classList.remove('loading'); } catch (e) { }
        isLoading = false;
        refreshCount++;
        try {
            const rcEl = document.getElementById('refresh-count');
            if (rcEl) rcEl.textContent = refreshCount;
            const now = new Date(), wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
            const p = n => String(n).padStart(2, '0');
            const ts = `${p(wib.getHours())}:${p(wib.getMinutes())}`;
            const luEl = document.getElementById('last-update');
            const atEl = document.getElementById('analysis-time');
            if (luEl) luEl.textContent = ts;
            if (atEl) atEl.textContent = `${ts} WIB`;
        } catch (e) { }
    } finally {
        try { startCountdown(); } catch (e) { }
        isLoading = false;
    }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== PROBABILITY & THREAT =====
function computeIW() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;
    IW_INDICATORS.forEach(i => {
        if (typeof i.val !== 'number') return;
        if (Math.abs(i.val - i.base) < (i.base * 0.05) || i.base === 0) i.trend = 'flat';
        else i.trend = (i.val > i.base) ? 'up' : 'down';
        if (i.inverse) {
            i.status = (i.val <= i.triggerThresh) ? 'triggered' : (i.val <= i.watchThresh) ? 'watch' : 'clear';
        } else {
            i.status = (i.val >= i.triggerThresh) ? 'triggered' : (i.val >= i.watchThresh) ? 'watch' : 'clear';
        }
        i.reading = `${i.val % 1 !== 0 ? i.val.toFixed(1) : i.val} ${i.unit}`;
    });
}

function recomputeAllCurrents() {
    scenarios = scenarios.map(s => ({ ...s, current: Math.round(s.base) }));
    if (typeof KEY_ASSUMPTIONS !== 'undefined') {
        KEY_ASSUMPTIONS.forEach(ka => {
            if (ka.active) return;
            Object.entries(ka.ifFalse).forEach(([id, delta]) => {
                const idx = scenarios.findIndex(sc => sc.id === id);
                if (idx >= 0) {
                    scenarios[idx] = {
                        ...scenarios[idx],
                        current: Math.round(Math.min(98, Math.max(2, scenarios[idx].current + delta)))
                    };
                }
            });
        });
    }
    if (typeof INTEL_GAPS !== 'undefined') {
        INTEL_GAPS.forEach(gap => {
            if (gap.status !== 'CLOSED') return;
            Object.entries(gap.closedBoost).forEach(([id, delta]) => {
                const idx = scenarios.findIndex(sc => sc.id === id);
                if (idx >= 0) {
                    scenarios[idx] = {
                        ...scenarios[idx],
                        current: Math.round(Math.min(98, Math.max(2, scenarios[idx].current + delta)))
                    };
                }
            });
        });
    }
}

function applyProbabilityUpdate() {
    if (typeof IW_INDICATORS !== 'undefined') {
        IW_INDICATORS.forEach(i => {
            if (typeof i.val === 'number' && typeof i.triggerThresh === 'number' && typeof i.base === 'number') {
                const maxDelta = Math.abs(i.triggerThresh - i.base) * 0.3;
                const iwDiff = i.val - i.base;
                const iwRev = -iwDiff * 0.08;
                const shift = (Math.random() - 0.5) * maxDelta;
                i.val = Math.max(0, i.val + iwRev + shift);
            }
        });
    }
    computeIW();

    const iwT = (typeof IW_INDICATORS !== 'undefined' && Array.isArray(IW_INDICATORS))
        ? IW_INDICATORS.filter(i => i.status === 'triggered').length : 0;
    const mul = 1 + iwT * 0.02;

    scenarios = scenarios.map(s => {
        const diff = s.base - s.baseline, rev = -diff * 0.12, noise = (Math.random() - 0.5) * 6 * mul;
        const newBase = s.base + rev + noise;
        return { ...s, base: Math.round(Math.min(97, Math.max(3, newBase))) };
    });

    recomputeAllCurrents();
    updateThreatLevel();
}

function computeConf(s) {
    const d = Math.abs(s.current - s.baseline);
    if (s.confBase === 'spec') return 'spec';
    if (s.confBase === 'high') return d < 8 ? 'high' : d < 15 ? 'med' : 'low';
    if (s.confBase === 'med') return d < 5 ? 'med' : d < 12 ? 'low' : 'spec';
    return 'spec';
}
const CLBL = { high: 'HIGH ▲', med: 'MED ◆', low: 'LOW ▼', spec: 'SPEKULATIF' };

function updateThreatLevel() {
    if (!Array.isArray(scenarios)) return;
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;

    const f = id => {
        const s = scenarios.find(sc => sc.id === id);
        return s ? s.current : 0;
    };

    const iwT = IW_INDICATORS.filter(i => i.status === 'triggered').length;
    const iwW = IW_INDICATORS.filter(i => i.status === 'watch').length;

    const milScore = f('S4') * 0.35 + f('S5') * 0.30 + f('S7') * 0.20 + f('S6') * 0.15;
    const nucScore = f('S12') * 0.50 + f('S3') * 0.30 + f('S11') * 0.20;
    const econScore = f('S9') * 0.50 + f('S8') * 0.30 + f('S10') * 0.20;
    const composite = milScore * 0.45 + nucScore * 0.35 + econScore * 0.20;

    const sc = Math.min(100, Math.round(composite * 1.3 + iwT * 2.0 + iwW * 0.6));
    currentThreatLevel = sc >= 80 ? 4 : sc >= 60 ? 3 : sc >= 40 ? 2 : sc >= 20 ? 1 : 0;
}

function toggleAssumption(id) {
    if (typeof KEY_ASSUMPTIONS === 'undefined') return;
    const ka = KEY_ASSUMPTIONS.find(k => k.id === id);
    if (!ka) return;
    ka.active = !ka.active;
    recomputeAllCurrents();
    updateThreatLevel();
    renderAssumptions();
    renderScenarios();
    renderDeltaTracker();
    renderThreat();
    renderAnalystSummary();
    renderSIGINT();
}

function renderAssumptions() {
    const el = document.getElementById('assumptions-list');
    if (!el || typeof KEY_ASSUMPTIONS === 'undefined') return;

    const violatedCount = KEY_ASSUMPTIONS.filter(k => !k.active).length;
    const badge = document.getElementById('assumptions-violated-count');
    if (badge) {
        badge.textContent = violatedCount > 0 ? `${violatedCount} DILANGGAR` : 'SEMUA AKTIF';
        badge.style.color = violatedCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
    }

    el.innerHTML = KEY_ASSUMPTIONS.map(ka => {
        const violated = !ka.active;
        return `<div class="ka-item ${violated ? 'ka-violated' : ''}">
            <div class="ka-header">
                <span class="ka-id">${ka.id}</span>
                <label class="ka-toggle-wrap">
                    <input type="checkbox" class="ka-checkbox" ${ka.active ? 'checked' : ''}
                        onchange="toggleAssumption('${ka.id}')" />
                    <span class="ka-toggle-label">${ka.active ? 'AKTIF' : 'DILANGGAR'}</span>
                </label>
            </div>
            <div class="ka-text ${violated ? 'ka-text-violated' : ''}">${ka.text}</div>
            ${violated ? `<div class="ka-impact-hint">Skenario terpengaruh: ${Object.keys(ka.ifFalse).join(', ')}</div>` : ''}
        </div>`;
    }).join('');
}

function saveSnapshot() {
    if (typeof SNAPSHOT_HISTORY === 'undefined') return;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const snap = { time: timeLabel, threatLevel: currentThreatLevel || 0, probabilities: {} };

    scenarios.forEach(s => { s.current = Math.max(0, Math.min(100, s.current)); });
    scenarios.forEach(s => { snap.probabilities[s.id] = Math.round(s.current); });

    SNAPSHOT_HISTORY.push(snap);
    _sparkCache.clear();
    if (SNAPSHOT_HISTORY.length > MAX_SNAPSHOTS) SNAPSHOT_HISTORY.shift();

    renderSnapshotPanel();
    renderScenarios();

    const btn = document.getElementById('snapshot-btn');
    if (btn) {
        btn.textContent = '✓ TERSIMPAN';
        btn.style.color = 'var(--accent-green)';
        btn.style.borderColor = 'var(--accent-green)';
        setTimeout(() => {
            btn.textContent = '◉ SIMPAN SNAPSHOT';
            btn.style.color = '';
            btn.style.borderColor = '';
        }, 1500);
    }
}

function buildSparkline(scenarioId) {
    if (typeof SNAPSHOT_HISTORY === 'undefined' || !SNAPSHOT_HISTORY || SNAPSHOT_HISTORY.length < 2) return '';
    if (SNAPSHOT_HISTORY.length !== _sparkCacheLen) {
        _sparkCache.clear();
        _sparkCacheLen = SNAPSHOT_HISTORY.length;
    }
    if (_sparkCache.has(scenarioId)) return _sparkCache.get(scenarioId);

    const values = SNAPSHOT_HISTORY.map(s => s.probabilities[scenarioId] ?? null).filter(v => v !== null);
    if (values.length < 2) return '';

    const w = 60, h = 18, pad = 2;
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;

    const pts = values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - pad * 2);
        const y = h - pad - ((v - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const last = values[values.length - 1], prev = values[values.length - 2];
    const trend = last > prev + 1 ? 'up' : last < prev - 1 ? 'down' : 'flat';
    const lineColor = trend === 'up' ? '#ff3355' : trend === 'down' ? '#00ff88' : '#ffd700';
    const arrow = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '▬';
    const [lx, ly] = pts[pts.length - 1].split(',');

    const result = `<span class="sparkline-wrap" title="Tren ${values.length} snapshot">
        <svg width="${w}" height="${h}" class="sparkline-svg">
            <polyline points="${pts.join(' ')}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linejoin="round"/>
            <circle cx="${lx}" cy="${ly}" r="2" fill="${lineColor}"/>
        </svg>
        <span class="spark-arrow" style="color:${lineColor}">${arrow}</span>
    </span>`;

    _sparkCache.set(scenarioId, result);
    return result;
}

function renderSnapshotPanel() {
    const el = document.getElementById('snapshot-list');
    if (!el || typeof SNAPSHOT_HISTORY === 'undefined') return;

    if (SNAPSHOT_HISTORY.length === 0) {
        el.innerHTML = '<div class="snap-empty">Belum ada snapshot tersimpan.</div>';
        return;
    }

    const reversed = [...SNAPSHOT_HISTORY].reverse();
    el.innerHTML = reversed.map((snap, i) => {
        const isLatest = i === 0;
        const topScenarios = Object.entries(snap.probabilities)
            .sort((a, b) => b[1] - a[1]).slice(0, 3)
            .map(([id, pct]) => `<span class="snap-sc">${id}:${pct}%</span>`).join('');
        return `<div class="snap-item ${isLatest ? 'snap-latest' : ''}">
            <div class="snap-header">
                <span class="snap-time">${isLatest ? '● ' : '○ '}${snap.time}</span>
                <span class="snap-threat">TL:${snap.threatLevel}</span>
            </div>
            <div class="snap-top">${topScenarios}</div>
        </div>`;
    }).join('');

    const badge = document.getElementById('snap-count');
    if (badge) badge.textContent = `${SNAPSHOT_HISTORY.length} / ${MAX_SNAPSHOTS}`;
}

// ===== INTELLIGENCE GAPS =====
function cycleGapStatus(id) {
    if (typeof INTEL_GAPS === 'undefined') return;
    const gap = INTEL_GAPS.find(g => g.id === id);
    if (!gap) return;
    const cycle = { 'OPEN': 'PARTIAL', 'PARTIAL': 'CLOSED', 'CLOSED': 'OPEN' };
    gap.status = cycle[gap.status];
    recomputeAllCurrents();
    updateThreatLevel();
    renderGapPanel();
    renderScenarios();
    renderDeltaTracker();
    renderThreat();
    renderSIGINT();
    renderAnalystSummary();
}

function getOpenGapCount() {
    if (typeof INTEL_GAPS === 'undefined') return 0;
    return INTEL_GAPS.filter(g => g.status === 'OPEN').length;
}

function renderGapPanel() {
    const el = document.getElementById('gap-list');
    if (!el || typeof INTEL_GAPS === 'undefined') return;

    const { openCount, partialCount, closedCount } = INTEL_GAPS.reduce(
        (acc, g) => {
            if (g.status === 'OPEN') acc.openCount++;
            else if (g.status === 'PARTIAL') acc.partialCount++;
            else if (g.status === 'CLOSED') acc.closedCount++;
            return acc;
        },
        { openCount: 0, partialCount: 0, closedCount: 0 }
    );

    const badge = document.getElementById('gap-summary-badge');
    if (badge) {
        badge.textContent = `${openCount} OPEN · ${partialCount} PARTIAL · ${closedCount} CLOSED`;
        badge.style.color = openCount >= 5 ? 'var(--accent-red)'
            : openCount >= 3 ? 'var(--accent-orange)' : 'var(--accent-green)';
    }

    const priorityColor = { 'KRITIS': 'var(--accent-red)', 'TINGGI': 'var(--accent-orange)', 'SEDANG': 'var(--accent-yellow)' };
    const statusIcon = { 'OPEN': '○', 'PARTIAL': '◑', 'CLOSED': '●' };
    const statusColor = { 'OPEN': 'var(--accent-red)', 'PARTIAL': 'var(--accent-orange)', 'CLOSED': 'var(--accent-green)' };

    el.innerHTML = INTEL_GAPS.map(gap => `
        <div class="gap-item gap-${gap.status.toLowerCase()}" data-gap-id="${gap.id}" title="Klik untuk ubah status koleksi">
            <div class="gap-header">
                <span class="gap-id">${gap.id}</span>
                <span class="gap-priority" style="color:${priorityColor[gap.priority]}">${gap.priority}</span>
                <span class="gap-status" style="color:${statusColor[gap.status]}">${statusIcon[gap.status]} ${gap.status}</span>
            </div>
            <div class="gap-question">${gap.question}</div>
            <div class="gap-footer">
                <span class="gap-collection">${gap.collection}</span>
                <span class="gap-related">${gap.relatedScenarios.join(' ')}</span>
            </div>
        </div>
    `).join('');
}

// ===== RENDER ALL =====
function renderAll() {
    try { renderThreat(); } catch (e) { console.error('renderThreat fail:', e); }
    try { renderScenarios(); } catch (e) { console.error('renderScen fail:', e); }
    try { renderDeltaTracker(); } catch (e) { console.error('renderDelta fail:', e); }
    try { renderNews(); } catch (e) { console.error('renderNews fail:', e); }
    try { renderAnalystSummary(); } catch (e) { console.error('renderSummary fail:', e); }
    try { renderIW(); } catch (e) { console.error('renderIW fail:', e); }
    try { renderSignalNoise(); } catch (e) { console.error('renderSignal fail:', e); }
    try { renderSIGINT(); } catch (e) { console.error('renderSIGINT fail:', e); }
    try { renderAssumptions(); } catch (e) { console.error('renderAssump fail:', e); }
    try { renderSnapshotPanel(); } catch (e) { console.error('renderSnap fail:', e); }
    try { renderGapPanel(); } catch (e) { console.error('renderGap fail:', e); }
    try { renderACH(); } catch (e) { console.error('renderACH fail:', e); }
    try { renderRedTeam(); } catch (e) { console.error('renderRedTeam fail:', e); }
    try { renderNetAssessTable(); } catch (e) { console.error('renderNetAssess fail:', e); }
    try { renderCone(); } catch (e) { console.error('renderCone fail:', e); }
    try { renderChronology(); } catch (e) { console.error('renderChronology fail:', e); }
    try { renderPropaganda(); } catch (e) { console.error('renderPropaganda fail:', e); }
    try { renderUnverified(); } catch (e) { console.error('renderUnverified fail:', e); }
}

// ===== THREAT =====
const TCFG = [
    { label: 'RENDAH', sub: 'SITUASI TERKENDALI', color: 'var(--threat-low)', bCount: 1, glow: '#00e676' },
    { label: 'SEDANG', sub: 'PEMANTAUAN RUTIN', color: 'var(--threat-med)', bCount: 2, glow: '#69f0ae' },
    { label: 'WASPADA', sub: 'POTENSI ESKALASI', color: 'var(--threat-wsp)', bCount: 3, glow: '#ffd740' },
    { label: 'TINGGI', sub: 'RISIKO SIGNIFIKAN AKTIF', color: 'var(--threat-hgh)', bCount: 4, glow: '#ff6e40' },
    { label: 'KRITIS', sub: 'RISIKO ESKALASI AKTIF', color: 'var(--threat-crt)', bCount: 5, glow: '#ff1744' },
];
const BCLS = ['active-low', 'active-med', 'active-wsp', 'active-hgh', 'active-crt'];

// Cached references to static threat-bar and threat-indicator elements (populated on first render)
let _tbCache = null;
let _tidCache = null;

function renderThreat() {
    if (currentThreatLevel < 0 || currentThreatLevel >= TCFG.length) return;
    const c = TCFG[currentThreatLevel];
    if (!c) return;
    const lbl = document.getElementById('threat-label');
    if (lbl) { lbl.textContent = c.label; lbl.style.color = c.color; lbl.style.textShadow = `0 0 20px ${c.glow},0 0 40px ${c.glow}66`; }
    const sub = document.getElementById('threat-sub');
    if (sub) sub.textContent = c.sub;

    if (!_tbCache) _tbCache = [0, 1, 2, 3, 4].map(i => document.getElementById(`tb${i}`));
    for (let i = 0; i < 5; i++) {
        const b = _tbCache[i];
        if (b) { b.className = 'tbar'; if (i < c.bCount) b.classList.add(BCLS[i]); }
    }

    if (!_tidCache) _tidCache = Array.from(document.querySelectorAll('.tid'));
    _tidCache.forEach((el, i) => { if (el) el.style.opacity = i === currentThreatLevel ? '1' : '0.35'; });
}

// Shared lookup tables used inside computeDST — defined once to avoid recreation per call.
const _DST_SCENARIO_GROUP_MAP = { militer: ['S4','S5','S6','S7'], nuklir: ['S3','S11','S12'], ekonomi: ['S8','S9'], diplomatik: ['S1','S2','S10'] };
const _DST_GROUP_TO_CAT = { militer: 'MILITER', nuklir: 'INTELIJEN', ekonomi: 'EKONOMI', diplomatik: 'DIPLOMATIK' };

function computeDST(scenario) {
    const p = scenario.current;
    let beliefFactor = 0.70;

    try {
        const groupACHmap = {
            diplomasi: [0, 2], militer: [1, 4], ekonomi: [2, 3], ekstrem: [3, 5]
        };
        const relHypIndices = groupACHmap[scenario.group] || [0, 1];
        let corrobC = 0, totalCells = 0;
        if (typeof ACH_EVIDENCE !== 'undefined' && Array.isArray(ACH_EVIDENCE)) {
            ACH_EVIDENCE.forEach(ev => {
                relHypIndices.forEach(hi => { totalCells++; if (ev.cells[hi] === 'C') corrobC++; });
            });
        }
        const corrobRatio = totalCells > 0 ? corrobC / totalCells : 0.5;
        beliefFactor += (corrobRatio - 0.5) * 0.20;
    } catch (e) { }

    // Resolve the scenario group once; reuse for both beliefFactor and plausFactor.
    let scenGroup = null;
    for (const [g, ids] of Object.entries(_DST_SCENARIO_GROUP_MAP)) { if (ids.includes(scenario.id)) { scenGroup = g; break; } }
    const catName = scenGroup ? _DST_GROUP_TO_CAT[scenGroup] : null;

    // Count triggered IW indicators for the category once, shared by both factor calculations.
    let triggeredCount = 0;
    try {
        if (catName && typeof IW_INDICATORS !== 'undefined' && Array.isArray(IW_INDICATORS)) {
            triggeredCount = IW_INDICATORS.reduce((n, iw) => n + (iw.cat === catName && iw.status === 'triggered' ? 1 : 0), 0);
            beliefFactor += triggeredCount * 0.04;
        }
    } catch (e) { }

    let violations = 0;
    try {
        if (typeof KEY_ASSUMPTIONS !== 'undefined' && Array.isArray(KEY_ASSUMPTIONS)) {
            KEY_ASSUMPTIONS.forEach(ka => { if (!ka.active && ka.ifFalse[scenario.id] !== undefined) violations++; });
        }
    } catch (e) { }
    beliefFactor -= violations * 0.06;

    let plausFactor = 1.30;
    try {
        if (catName && triggeredCount > 0) {
            plausFactor -= triggeredCount * 0.05;
        }
    } catch (e) { }
    plausFactor += violations * 0.08;

    try {
        if (typeof INTEL_GAPS !== 'undefined' && Array.isArray(INTEL_GAPS)) {
            const openGaps = INTEL_GAPS.filter(g => g.status === 'OPEN' && g.relatedScenarios.includes(scenario.id)).length;
            plausFactor += openGaps * 0.04;
        }
    } catch (e) { }

    plausFactor = Math.min(1.55, Math.max(1.05, plausFactor));
    beliefFactor = Math.min(0.92, Math.max(0.40, beliefFactor));

    const belief = Math.round(Math.min(97, p * beliefFactor));
    const plausibility = Math.round(Math.min(98, p * plausFactor));
    const uncertainty = Math.max(0, plausibility - belief);
    return { belief, plausibility, uncertainty };
}

// ===== SCENARIOS =====
const GRP = { diplomasi: 'group-diplomasi', militer: 'group-militer', ekonomi: 'group-ekonomi', ekstrem: 'group-ekstrem' };

function renderScenarios() {
    Object.values(GRP).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

    const topScenariosEl = document.getElementById('top-scenarios-list');
    if (topScenariosEl) topScenariosEl.innerHTML = '';

    const top3Ids = [...scenarios].sort((a, b) => b.current - a.current).slice(0, 3).map(s => s.id);

    scenarios.forEach(s => {
        const el = document.getElementById(GRP[s.group]);
        const delta = s.current - s.baseline;
        const ds = delta === 0 ? '±0%' : delta > 0 ? `+${delta}%` : `${delta}%`;
        const dc = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neutral';
        const pc = s.group === 'militer' ? 'var(--accent-red)' : s.group === 'ekonomi' ? 'var(--accent-yellow)' : s.group === 'ekstrem' ? 'var(--accent-purple)' : 'var(--accent-cyan)';
        const conf = computeConf(s);
        const tags = s.tags.map(t => `<span class="tag ${t === 'de-eskalasi' ? 'deeskalasi' : t}">${t.toUpperCase()}</span>`).join('');
        const dst = computeDST(s);
        const uClass = dst.uncertainty > 25 ? 'dst-high-unc' : dst.uncertainty > 12 ? 'dst-med-unc' : 'dst-low-unc';

        const html = `<div class="scenario-item">
            <div class="scenario-header">
                <div class="scenario-name">${esc(s.name)}</div>
                <div class="scenario-prob" style="color:${pc}">${s.current}% ${buildSparkline(s.id)}</div>
                <div class="scenario-delta ${dc}">${ds}</div>
            </div>
            <div class="bar-container">
                <div class="bar-baseline" style="width:${s.baseline}%"></div>
                <div class="bar-current ${s.barClass}" style="width:${s.current}%"></div>
            </div>
            <div class="dst-row">
                <span class="dst-label">Bel</span><span class="dst-val">${dst.belief}%</span><span class="dst-sep">|</span>
                <span class="dst-label">Pl</span><span class="dst-val">${dst.plausibility}%</span><span class="dst-sep">|</span>
                <span class="dst-label dst-unc ${uClass}">?</span><span class="dst-val ${uClass}">${dst.uncertainty}%</span>
            </div>
            <div class="scenario-footer">${tags}<span class="conf-badge ${conf}">${CLBL[conf]}</span></div>
            ${s.challenge ? `<button class="btn-challenge" data-challenge-id="${s.id}">⚡ CHALLENGE THIS ANALYSIS <span style="float:right;font-size:8px;opacity:0.5">(DEVIL'S ADVOCATE)</span></button><div class="challenge-box" id="cb-${s.id}"><div class="cb-label">ACH HIGHLIGHT <span>(AI Red Team)</span></div>${esc(s.challenge)}</div>` : ''}
        </div>`;

        if (el) el.insertAdjacentHTML('beforeend', html);
        if (topScenariosEl && top3Ids.includes(s.id)) {
            const htmlTop = html
                .replace(`id="cb-${s.id}"`, `id="cb-${s.id}-top"`)
                .replace(`data-challenge-id="${s.id}"`, `data-challenge-id="${s.id}-top"`);
            topScenariosEl.insertAdjacentHTML('beforeend', htmlTop);
        }
    });
}

// ===== DELTA =====
function renderDeltaTracker() {
    const el = document.getElementById('delta-list');
    if (!el || !Array.isArray(scenarios)) return;
    const top = scenarios.map(s => ({ ...s, delta: s.current - s.baseline, abs: Math.abs(s.current - s.baseline) }))
        .filter(s => s.abs > 0).sort((a, b) => b.abs - a.abs).slice(0, 6);
    el.innerHTML = top.length ? top.map(s => `<div class="delta-item">
        <span class="delta-arrow ${s.delta > 0 ? 'up' : 'down'}">${s.delta > 0 ? '▲' : '▼'}</span>
        <span class="delta-label">${esc(s.name)}</span>
        <span class="delta-value ${s.delta > 0 ? 'pos' : 'neg'}">${s.delta > 0 ? '+' + s.delta : s.delta}%</span>
    </div>`).join('') : '<div style="color:var(--text-dim);font-size:11px;padding:6px 0">Tidak ada perubahan dari baseline.</div>';
}

// ===== SECURITY =====
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/[&<>"'`=\/]/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;' })[s])
        .replace(/[\u200B-\u200D\uFEFF\u2028\u2029\u0000-\u001F\u007F]/g, '');
}

// ===== NEWS =====
// FIX 2: filterFeed — was using getAttribute('onclick') which is always null now.
// Buttons use data-feed-filter attribute, must compare against that.
function filterFeed(f) {
    activeFeedFilter = f;
    document.querySelectorAll('.ff-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-feed-filter') === f);
    });
    renderNews();
}

function toggleCredFilter() {
    const el = document.getElementById('high-cred-filter');
    credFilterOn = el ? el.checked : false;
    renderPropaganda();
}

function toggleUnverified() {
    uvVisible = !uvVisible;
    const feed = document.getElementById('unverified-feed');
    const btn = document.getElementById('uv-toggle-btn');
    if (feed) feed.classList.toggle('uv-hidden', !uvVisible);
    if (btn) btn.textContent = uvVisible ? 'SEMBUNYIKAN' : 'TAMPILKAN';
}

function renderNews() {
    if (typeof VERIFIED_NEWS === 'undefined' || !Array.isArray(VERIFIED_NEWS)) return;
    const sorted = [...VERIFIED_NEWS].sort((a, b) => a.time - b.time);
    const filtered = activeFeedFilter === 'all' ? sorted : sorted.filter(n => n.impact === activeFeedFilter);

    const cb = getEl('feed-count');
    if (cb) cb.textContent = filtered.length;

    // FIX 3: Use cached element reference — was calling getElementById twice
    const elFeed = getEl('osint-feed');
    if (!elFeed) return;

    const now = new Date();
    elFeed.innerHTML = filtered.map(n => {
        const itemTime = new Date(now.getTime() - n.time * 60000 + now.getTimezoneOffset() * 60000 + 7 * 3600000);
        const p = num => String(num).padStart(2, '0');
        const ts = `${p(itemTime.getHours())}:${p(itemTime.getMinutes())}`;
        const targetLink = n.link || 'https://x.com/DeItaone';
        return `<a href="${esc(targetLink)}" target="_blank" rel="noopener noreferrer" class="news-item ${n.impact}">
            <div class="news-header">
                <span class="news-time-badge">${ts} WIB</span>
                <span class="news-impact ${n.impact}">${n.impact === 'eskalasi' ? 'ESKALASI' : n.impact === 'deeskalasi' ? 'DE-ESKALASI' : 'NETRAL'}</span>
                <span class="intel-badge ${n.intel}">${n.intel}</span>
                <span class="credibility-score ${n.cred >= 8 ? 'high' : n.cred >= 6 ? 'med' : 'low'}">CRED:${n.cred}/10</span>
                <span class="news-source">${esc(n.source)}</span>
            </div>
            <div class="news-headline">${esc(n.headline)}</div>
            <div class="news-analysis">${esc(n.analysis)}</div>
        </a>`;
    }).join('');
}

// FIX 4: renderPropaganda — added guard for undefined PROPAGANDA_NEWS
function renderPropaganda() {
    if (typeof PROPAGANDA_NEWS === 'undefined' || !Array.isArray(PROPAGANDA_NEWS)) return;
    const list = credFilterOn ? PROPAGANDA_NEWS.filter(n => n.cred >= 7) : PROPAGANDA_NEWS;
    const propCount = getEl('prop-count');
    if (propCount) propCount.textContent = `${PROPAGANDA_NEWS.filter(n => n.cred < 5).length} FLAGS`;
    const propFeed = getEl('prop-feed');
    if (!propFeed) return;
    propFeed.innerHTML = list.map(n => `<div class="prop-item">
        <div class="prop-item-header"><span class="prop-flag">${n.flag}</span><span class="credibility-score ${n.cred >= 8 ? 'high' : n.cred >= 6 ? 'med' : 'low'}">CRED:${n.cred}/10</span></div>
        <div class="prop-headline">"${esc(n.headline)}" — ${esc(n.source)}</div>
        <div class="prop-analysis">${esc(n.analysis)}</div>
    </div>`).join('');
}

// FIX 5: renderUnverified — added guard for undefined UNVERIFIED_NEWS
function renderUnverified() {
    if (typeof UNVERIFIED_NEWS === 'undefined' || !Array.isArray(UNVERIFIED_NEWS)) return;
    const el = document.getElementById('unverified-feed');
    if (!el) return;
    el.innerHTML = UNVERIFIED_NEWS.map(n => `<div class="uv-item">
        <div class="uv-watermark">UNVERIFIED</div>
        <div><span class="uv-label">${esc(n.label)}</span></div>
        <div class="uv-headline">${esc(n.headline)}</div>
        <div class="uv-impact">Potensi Dampak (IF valid): <strong>${esc(n.impact)}</strong></div>
    </div>`).join('');
}

function buildAnalystSummary() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return '';
    if (typeof scenarios === 'undefined' || !Array.isArray(scenarios)) return '';

    const triggered = IW_INDICATORS.filter(i => i.status === 'triggered');
    const watched = IW_INDICATORS.filter(i => i.status === 'watch');

    const confMap = { low: 0.72, med: 0.84, high: 0.94, spec: 0.55 };
    const bounded = (v, min, max) => Math.max(min, Math.min(max, v));
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const topMover = scenarios.map(s => ({ ...s, absDelta: Math.abs(s.current - s.baseline) }))
        .sort((a, b) => b.absDelta - a.absDelta)[0];
    const topMilitary = scenarios.filter(s => s.group === 'militer').sort((a, b) => b.current - a.current)[0];
    const topDiplomasi = scenarios.filter(s => s.group === 'diplomasi').sort((a, b) => b.current - a.current)[0];

    const weightedScenarios = scenarios.map(s => {
        const delta = s.current - s.baseline;
        const conf = confMap[s.confBase] ?? 0.78;
        const prob = bounded(s.current / 100, 0, 1);
        const momentum = bounded(Math.abs(delta) / 25, 0, 1);
        return {
            ...s,
            delta,
            conf,
            riskScore: (0.55 * prob + 0.3 * conf + 0.15 * momentum) * 100
        };
    });
    const highestRisk = weightedScenarios.sort((a, b) => b.riskScore - a.riskScore)[0];

    const verified = (typeof VERIFIED_NEWS !== 'undefined' && Array.isArray(VERIFIED_NEWS)) ? VERIFIED_NEWS : [];
    const propaganda = (typeof PROPAGANDA_NEWS !== 'undefined' && Array.isArray(PROPAGANDA_NEWS)) ? PROPAGANDA_NEWS : [];
    const recentVerified = verified.filter(n => (n.time ?? 999) <= 90);
    const intelMix = ['OSINT', 'SIGINT', 'HUMINT', 'IMINT', 'COMINT'].filter(t => recentVerified.some(n => n.intel === t));
    const meanCred = avg(recentVerified.map(n => n.cred || 0));
    const lowCredPropaganda = propaganda.filter(n => (n.cred || 0) < 5).length;
    const corroboration = bounded((intelMix.length * 12) + (meanCred * 4) - (lowCredPropaganda * 1.5), 8, 96);

    let achWinner = null;
    if (typeof ACH_HYPOTHESES !== 'undefined' && typeof ACH_EVIDENCE !== 'undefined') {
        const achScores = ACH_HYPOTHESES.map((h, hi) => {
            const incons = ACH_EVIDENCE.reduce((sum, e) => sum + (e.cells[hi] === 'I' ? (e.weight || 1) : 0), 0);
            return { name: h.short, incons };
        });
        achWinner = achScores.reduce((a, b) => a.incons < b.incons ? a : b);
    }

    const threatLabels = ['RENDAH', 'SEDANG', 'WASPADA', 'TINGGI', 'KRITIS'];
    const threatLabel = threatLabels[currentThreatLevel] || 'TIDAK DIKETAHUI';
    const parts = [];

    if (currentThreatLevel >= 4) {
        parts.push(`KRITIS — ${triggered.length} indikator I&W aktif (TRIGGERED) dengan ${watched.length} dalam status WATCH. Sistem berada di ambang batas eskalasi penuh.`);
    } else if (currentThreatLevel === 3) {
        parts.push(`Level ancaman TINGGI — ${triggered.length} I&W triggered, ${watched.length} WATCH. Postur kinetik sedang meningkat secara terukur.`);
    } else if (currentThreatLevel === 2) {
        parts.push(`Level ancaman WASPADA — ${triggered.length} indikator dipicu, ${watched.length} dalam pemantauan aktif. Deterrence masih berfungsi namun rentan.`);
    } else {
        parts.push(`Level ancaman ${threatLabel} — ${triggered.length} I&W triggered. Situasi terkendali dalam parameter pemantauan rutin.`);
    }

    if (topMover && topMover.absDelta >= 3) {
        const dir = topMover.current > topMover.baseline ? 'naik' : 'turun';
        const delta = topMover.current - topMover.baseline;
        const sign = delta > 0 ? '+' : '';
        parts.push(`Delta terbesar: skenario "${topMover.name}" ${dir} ${sign}${delta}% dari baseline — menjadi focal point perhatian analis sesi ini.`);
    }

    if (highestRisk) {
        const riskBand = highestRisk.riskScore >= 78 ? 'HIGH-RISK' : highestRisk.riskScore >= 62 ? 'ELEVATED' : 'MODERATE';
        parts.push(`Model komposit menilai ${highestRisk.id} sebagai prioritas ${riskBand} (risk score ${Math.round(highestRisk.riskScore)}/100; confidence ${Math.round(highestRisk.conf * 100)}%).`);
    }

    if (topMilitary && topDiplomasi) {
        const tension = topMilitary.current - topDiplomasi.current;
        if (tension > 20) {
            parts.push(`Ketegangan asimetris: kapabilitas militer (${topMilitary.name}: ${topMilitary.current}%) secara signifikan melampaui opsi diplomatik (${topDiplomasi.name}: ${topDiplomasi.current}%). Ruang manuver non-kinetik menyempit.`);
        } else if (tension < -10) {
            parts.push(`Momentum diplomatik terdeteksi: ${topDiplomasi.name} (${topDiplomasi.current}%) mengungguli tekanan militer. Window de-eskalasi terbuka.`);
        } else {
            parts.push(`Keseimbangan rapuh antara opsi militer (${topMilitary.current}%) dan jalur diplomatik (${topDiplomasi.current}%). Kalkulasi aktor sedang dalam fase reassessment.`);
        }
    }

    if (achWinner) {
        parts.push(`ACH saat ini menunjuk hipotesis paling konsisten: ${achWinner.name} (${achWinner.incons} inkonsistensi berbobot). Prioritaskan collection requirement pada indikator diagnostik untuk konfirmasi.`);
    }

    if (recentVerified.length > 0) {
        parts.push(`Kualitas evidensi: ${recentVerified.length} laporan terbaru tervalidasi, rerata kredibilitas ${meanCred.toFixed(1)}/10, cakupan intel ${intelMix.join('/') || 'terbatas'}, dan skor corroboration ${Math.round(corroboration)}/100.`);
    }

    return parts.join(' ');
}

function renderAnalystSummary() {
    const el = document.getElementById('analyst-summary');
    if (!el) return;
    try {
        el.textContent = buildAnalystSummary();
    } catch (e) {
        if (typeof ANALYST_SUMMARIES !== 'undefined' && ANALYST_SUMMARIES.length > 0) {
            el.textContent = ANALYST_SUMMARIES[0];
        }
    }
}

function renderSignalNoise() {
    if (typeof VERIFIED_NEWS === 'undefined' || !Array.isArray(VERIFIED_NEWS)) return;
    if (typeof PROPAGANDA_NEWS === 'undefined' || !Array.isArray(PROPAGANDA_NEWS)) return;
    const highCred = VERIFIED_NEWS.filter(n => n.cred >= 8).length;
    const propagandaLow = PROPAGANDA_NEWS.filter(n => n.cred < 5).length;
    const total = VERIFIED_NEWS.length + PROPAGANDA_NEWS.length;
    if (total === 0) return;
    const sig = Math.min(92, Math.max(45, Math.round(((highCred * 1.4 - propagandaLow * 0.7) / total) * 100 + 42)));
    const noise = 100 - sig;
    const snBar = document.getElementById('sn-bar');
    const snNoise = document.getElementById('sn-noise');
    const snRatio = document.getElementById('sn-ratio');
    if (snBar) snBar.style.width = sig + '%';
    if (snNoise) snNoise.style.width = noise + '%';
    if (snRatio) snRatio.textContent = `${sig}:${noise}`;
}

// ===== I&W =====
const IW_CATS = ['MILITER', 'DIPLOMATIK', 'EKONOMI', 'INTELIJEN'];
function renderIW() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;
    const iwTable = document.getElementById('iw-table');
    if (!iwTable) return;

    iwTable.innerHTML = IW_CATS.map(cat => {
        const rows = IW_INDICATORS.filter(i => i.cat === cat);
        return `<div class="iw-category">
            <div class="iw-cat-title">${cat}</div>
            <div class="iw-row header"><div>STS</div><div>CR-ID</div><div>INDIKATOR</div><div>THRESHOLD</div><div>READING</div><div>↕</div></div>
            ${rows.map(r => {
                const threshLabel = r.inverse ? `&lt; ${r.triggerThresh} ${r.unit}` : `&gt; ${r.triggerThresh} ${r.unit}`;
                return `<div class="iw-row">
                    <div><div class="iw-dot ${r.status}"></div></div>
                    <div class="iw-cr">${r.cr}</div>
                    <div class="iw-name">${esc(r.name)}</div>
                    <div class="iw-threshold">${threshLabel}</div>
                    <div class="iw-reading ${r.status}">${esc(r.reading)}</div>
                    <div class="iw-trend ${r.trend === 'up' ? 'up' : r.trend === 'down' ? 'down' : 'flat'}">${r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'}</div>
                </div>`;
            }).join('')}
        </div>`;
    }).join('');
    renderIWCounts();
}

function renderIWCounts() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;
    const tot = IW_INDICATORS.length;
    if (tot === 0) return;

    const { t, w, cl } = IW_INDICATORS.reduce(
        (acc, i) => {
            if (i.status === 'triggered') acc.t++;
            else if (i.status === 'watch') acc.w++;
            else if (i.status === 'clear') acc.cl++;
            return acc;
        },
        { t: 0, w: 0, cl: 0 }
    );

    const setT = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const setW = (id, pct) => { const e = document.getElementById(id); if (e) e.style.width = pct + '%'; };

    setT('iw-triggered', t); setT('iw-watch', w); setT('iw-clear', cl);
    setW('iw-bar-t', (t / tot) * 100);
    setW('iw-bar-w', (w / tot) * 100);
    setW('iw-bar-c', (cl / tot) * 100);
}

// ===== ACH =====
const CCLS = { C: 'ac', I: 'ai', N: 'an', D: 'ad' };
function renderACH() {
    if (typeof ACH_HYPOTHESES === 'undefined' || typeof ACH_EVIDENCE === 'undefined') return;
    const achMatrix = document.getElementById('ach-matrix');
    const achScores = document.getElementById('ach-scores');
    const achConclusion = document.getElementById('ach-conclusion');
    if (!achMatrix) return;

    const scores = ACH_HYPOTHESES.map((_, hi) => {
        let incons = 0, diag = 0;
        ACH_EVIDENCE.forEach(e => {
            const w = e.weight || 1;
            if (e.cells[hi] === 'I') incons += w;
            if (e.cells[hi] === 'D') diag += w;
        });
        return { hi, incons, diag };
    });

    const minIncons = Math.min(...scores.map(s => s.incons));
    const bestCandidates = scores.filter(s => s.incons === minIncons);
    const maxDiag = Math.max(...bestCandidates.map(s => s.diag));
    const winners = bestCandidates.filter(s => s.diag === maxDiag).map(s => s.hi);

    const hdrs = ACH_HYPOTHESES.map((h, i) => `<th class="hyp${winners.includes(i) ? ' winner' : ''}">${esc(h.short)}<br><small style="font-size:8px;opacity:.6">${h.id}</small></th>`).join('');
    const rows = ACH_EVIDENCE.map(ev => `<tr><td class="ev-label">${esc(ev.ev)}</td>${ev.cells.map((c, i) => `<td class="${CCLS[c]}">${c}</td>`).join('')}</tr>`).join('');

    achMatrix.innerHTML = `<table class="ach-table"><thead><tr><th>BUKTI / HIPOTESIS</th>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
    if (achScores) achScores.innerHTML = scores.map((sc, i) => `<div class="ach-score-item"><div class="ach-score-val${winners.includes(i) ? ' best' : ''}">${sc.incons}I / ${sc.diag}D</div><div class="ach-score-name">${esc(ACH_HYPOTHESES[i].short)}</div></div>`).join('');

    const winnerNames = winners.map(i => `<strong>${esc(ACH_HYPOTHESES[i].name)}</strong>`).join(' & ');
    if (achConclusion) achConclusion.innerHTML = `<strong>KESIMPULAN ACH:</strong> Hipotesis paling konsisten dengan bukti: ${winnerNames} — hanya ${minIncons} inkonsistensi berbobot dari ${ACH_EVIDENCE.length} bukti. Lakukan collection requirement pada indikator diagnostik untuk konfirmasi.`;
}

// ===== RED TEAM =====
// FIX 6: renderRedTeam — added guard for undefined PAYOFF_DATA / WARGAME_SCENARIOS
function renderRedTeam() {
    if (typeof PAYOFF_DATA === 'undefined' || typeof WARGAME_SCENARIOS === 'undefined') return;
    const d = PAYOFF_DATA[currentPerspective];
    if (!d) return;

    const pvLabel = document.getElementById('pv-label');
    const nashInfo = document.getElementById('nash-info');
    const domStrat = document.getElementById('dominant-strategy');
    const payoffMatrix = document.getElementById('payoff-matrix');
    const wargameList = document.getElementById('wargame-list');

    if (pvLabel) pvLabel.textContent = d.title;
    if (nashInfo) nashInfo.textContent = d.nash;
    if (domStrat) domStrat.innerHTML = `<strong>DOMINANT STRATEGY:</strong> ${d.dominant}`;

    const rows = d.rowLabels, cols = d.colLabels;
    let html = `<div class="payoff-grid">
        <div class="payoff-label"></div>
        <div class="payoff-label col">${cols[0]}</div>
        <div class="payoff-label col">${cols[1]}</div>`;
    d.cells.forEach((c, i) => {
        if (i % 2 === 0) {
            const rIdx = Math.floor(i / 2);
            html += `<div class="payoff-label row">${rows[rIdx] || `R-${rIdx + 1}`}</div>`;
        }
        const va = parseFloat(c.rv), vb = parseFloat(c.cv);
        html += `<div class="payoff-cell${c.isNash ? ' nash' : ''}">
            <div class="payoff-val ${va > 0 ? 'pos' : va < 0 ? 'neg' : 'neu'}">A:${c.rv}</div>
            <div class="payoff-val ${vb > 0 ? 'pos' : vb < 0 ? 'neg' : 'neu'}">B:${c.cv}</div>
            <div class="payoff-desc">${c.rdesc} / ${c.cdesc}</div>
            ${c.isNash ? '<div style="font-size:8px;color:var(--accent-yellow);font-family:var(--font-data)">⚡NASH EQ</div>' : ''}
        </div>`;
    });
    html += '</div>';
    if (payoffMatrix) payoffMatrix.innerHTML = html;

    if (wargameList) wargameList.innerHTML = WARGAME_SCENARIOS.map(w => `<div class="wargame-item">
        <div class="wg-name">${w.name}</div>
        <div class="wg-utility"><span style="font-size:9px;color:var(--text-dim);font-family:var(--font-data);min-width:52px">${w.l1}</span><div class="wg-bar"><div class="wg-fill" style="width:${w.util1}%;background:${w.col1}"></div></div><span class="wg-score" style="color:${w.col1}">${w.util1}</span></div>
        <div class="wg-utility"><span style="font-size:9px;color:var(--text-dim);font-family:var(--font-data);min-width:52px">${w.l2}</span><div class="wg-bar"><div class="wg-fill" style="width:${w.util2}%;background:${w.col2}"></div></div><span class="wg-score" style="color:${w.col2}">${w.util2}</span></div>
    </div>`).join('');
}

function setPerspective(p, el) {
    currentPerspective = p;
    document.querySelectorAll('.pv-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    renderRedTeam();
}

// ===== NET ASSESSMENT =====
// FIX 7: renderNetAssessTable — added guard for undefined NET_DIMS / NET_DATA
function renderNetAssessTable() {
    if (typeof NET_DIMS === 'undefined' || typeof NET_DATA === 'undefined') return;
    const tableEl = document.getElementById('netassess-table');
    const summaryEl = document.getElementById('netassess-summary');
    if (!tableEl) return;

    tableEl.innerHTML = `<table class="na-table">
        <thead><tr><th>DIMENSI</th><th>🇮🇷 IRAN</th><th>🇮🇱 ISRAEL</th><th>🇺🇸 AS</th></tr></thead>
        <tbody>${NET_DIMS.map((d, i) => `<tr>
            <td class="na-dim">${d}</td>
            <td><div class="na-bar"><div class="na-fill iran" style="width:${NET_DATA.iran[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.iran[i]}</span></td>
            <td><div class="na-bar"><div class="na-fill israel" style="width:${NET_DATA.israel[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.israel[i]}</span></td>
            <td><div class="na-bar"><div class="na-fill us" style="width:${NET_DATA.us[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.us[i]}</span></td>
        </tr>`).join('')}</tbody>
    </table>`;

    if (summaryEl) summaryEl.innerHTML = '<strong>Net Assessment:</strong> AS memiliki superioritas absolut di hampir semua dimensi. Iran memimpin di <strong>Proxy Networks (85/100)</strong> sebagai asymmetric equalizer. Israel unggul di <strong>Siber (82)</strong> dan <strong>Presisi Militer (78)</strong>. Konflik langsung Iran vs Israel: Israel menang militer konvensional, namun Iran dapat mengeksploitasi proxy untuk meningkatkan biaya secara signifikan.';
}

function initRadarChart() {
    const canvas = document.getElementById('radar-chart');
    if (!canvas || typeof NET_DIMS === 'undefined' || typeof NET_DATA === 'undefined') return;

    const W = 280, H = 280, cx = 140, cy = 140, R = 110;
    const n = NET_DIMS.length;
    const angle = i => (i * 2 * Math.PI / n) - Math.PI / 2;
    const pt = (val, i) => { const a = angle(i), r = (val / 100) * R; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; };
    const ptStr = (val, i) => { const p = pt(val, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; };
    const polyStr = (data) => data.map((v, i) => ptStr(v, i)).join(' ');

    let rings = '';
    for (let g = 20; g <= 100; g += 20) {
        const pts = NET_DIMS.map((_, i) => ptStr(g, i)).join(' ');
        rings += `<polygon points="${pts}" fill="none" stroke="rgba(26,45,69,0.8)" stroke-width="${g === 100 ? 1 : 0.5}"/>`;
        if (g === 100 || g === 60 || g === 20) rings += `<text x="${(cx + 4).toFixed(0)}" y="${(cy - (g / 100) * R - 3).toFixed(0)}" fill="rgba(100,150,180,0.5)" font-size="7" font-family="Share Tech Mono">${g}</text>`;
    }

    let axes = '';
    NET_DIMS.forEach((dim, i) => {
        const a = angle(i);
        const ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
        const lx = cx + (R + 18) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a);
        axes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="rgba(26,45,69,0.9)" stroke-width="0.8"/>`;
        const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        axes += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" fill="#4a7a9a" font-size="7.5" font-family="Share Tech Mono" text-anchor="${anchor}">${dim.replace(' & ', '/').replace('Kapabilitas ', '')}</text>`;
    });

    const datasets = [
        { data: NET_DATA.iran, color: '#cc2244', label: '🇮🇷 Iran', alpha: '22' },
        { data: NET_DATA.israel, color: '#3399ff', label: '🇮🇱 Israel', alpha: '22' },
        { data: NET_DATA.us, color: '#00aa55', label: '🇺🇸 AS', alpha: '15' },
    ];
    let polys = '', dots = '', legend = '';
    datasets.forEach((ds, di) => {
        polys += `<polygon points="${polyStr(ds.data)}" fill="${ds.color}${ds.alpha}" stroke="${ds.color}" stroke-width="1.5" opacity="0.9"/>`;
        ds.data.forEach((v, i) => {
            const p = pt(v, i);
            dots += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${ds.color}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>`;
        });
        legend += `<rect x="${10 + di * 82}" y="265" width="8" height="8" rx="2" fill="${ds.color}"/>
        <text x="${22 + di * 82}" y="273" fill="${ds.color}" font-size="9" font-family="Share Tech Mono">${ds.label}</text>`;
    });

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H + 20);
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 20}`);
    svg.style.cssText = 'display:block;margin:0 auto;max-width:100%';
    svg.innerHTML = `<rect width="${W}" height="${H + 20}" fill="rgba(6,16,26,0.6)" rx="6"/>
        ${rings}${axes}${polys}${dots}${legend}`;
    canvas.parentNode.replaceChild(svg, canvas);
    radarChart = { update: () => { } };
}

// ===== CONE =====
// FIX 8: renderCone — added guards for undefined CONE data
function renderCone() {
    if (typeof CONE_MONTHS === 'undefined' || typeof CONE_WORST === 'undefined'
        || typeof CONE_LIKELY === 'undefined' || typeof CONE_BEST === 'undefined'
        || typeof CONE_MILESTONES === 'undefined') return;

    const container = document.getElementById('cone-container');
    if (!container) return;

    const track = CONE_MONTHS.map((m, i) => `<div class="cone-column">
        <div class="cone-month">${m}</div>
        <div class="cone-lane worst">${CONE_WORST[i]}</div>
        <div class="cone-lane likely">${CONE_LIKELY[i]}</div>
        <div class="cone-lane best">${CONE_BEST[i]}</div>
    </div>`).join('');

    const milestones = CONE_MILESTONES.map(m => `<div class="cone-milestone">
        <div class="cm-dot"></div>
        <span class="cm-date">${m.date}</span>
        <span>${m.text}</span>
    </div>`).join('');

    container.innerHTML = `<div class="cone-timeline">
        <div class="cone-track">${track}</div>
        <div style="margin-top:16px">
            <div style="font-family:var(--font-data);font-size:9px;color:var(--accent-cyan);letter-spacing:2px;margin-bottom:8px">KEY DECISION POINTS</div>
            ${milestones}
        </div>
    </div>`;
}

// ===== SIGINT FUSION =====
function computeFusionScore() {
    if (typeof VERIFIED_NEWS === 'undefined' || typeof SIGINT_SOURCES === 'undefined'
        || typeof IW_INDICATORS === 'undefined') return 72;
    const avgCred = VERIFIED_NEWS.length > 0
        ? VERIFIED_NEWS.reduce((s, n) => s + n.cred, 0) / VERIFIED_NEWS.length : 7;
    const t1Ratio = SIGINT_SOURCES.filter(s => s.tier === 't1').length / SIGINT_SOURCES.length;
    const anomalyPenalty = SIGINT_SOURCES.filter(s => s.anomaly).length * 5;
    const clearRatio = IW_INDICATORS.filter(i => i.status === 'clear').length / IW_INDICATORS.length;
    return Math.min(96, Math.round((avgCred * 7) + (t1Ratio * 18) + (clearRatio * 12) + 22 - anomalyPenalty));
}

function computePredInterval(pct, nActiveIndicators) {
    const p = Math.max(0.02, Math.min(0.97, pct / 100));
    const n = Math.max(1, nActiveIndicators);
    const marginPct = Math.round(196 * Math.sqrt(p * (1 - p) / n));
    return { lo: Math.max(2, pct - marginPct), hi: Math.min(97, pct + marginPct), margin: marginPct };
}

function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

function mean(list) {
    if (!Array.isArray(list) || list.length === 0) return 0;
    return list.reduce((s, n) => s + n, 0) / list.length;
}

function clamp(val, lo, hi) {
    return Math.min(hi, Math.max(lo, val));
}

function scenarioDelta(id) {
    const s = scenarios.find(x => x.id === id);
    if (!s) return 0;
    const baseline = typeof s.baseline === 'number' ? s.baseline : (typeof s.base === 'number' ? s.base : s.current || 0);
    return (s.current || 0) - baseline;
}

function confidenceFromDrivers(pct, spread, evidenceCount) {
    const centered = Math.abs(pct - 50) / 50;
    const stability = clamp(1 - (spread / 40), 0, 1);
    const evidence = clamp(evidenceCount / 5, 0, 1);
    const confidenceScore = (centered * 0.4) + (stability * 0.35) + (evidence * 0.25);
    return confidenceScore >= 0.68 ? 'HIGH' : confidenceScore >= 0.42 ? 'MED' : 'LOW';
}

function probabilityLabel(pct) {
    if (pct >= 78) return 'HAMPIR PASTI';
    if (pct >= 60) return 'TINGGI';
    if (pct >= 40) return 'MUNGKIN';
    if (pct >= 24) return 'RENDAH';
    return 'SANGAT RENDAH';
}

function computePredictiveAnalytics() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return [];

    const sc = id => { const s = scenarios.find(x => x.id === id); return s ? s.current : 0; };
    const iwCount = status => IW_INDICATORS.filter(i => i.status === status).length;

    const totalIw = Math.max(1, IW_INDICATORS.length);
    const triggeredRatio = iwCount('triggered') / totalIw;
    const watchRatio = iwCount('watch') / totalIw;
    const clearRatio = iwCount('clear') / totalIw;

    const avgVerifiedCred = (typeof VERIFIED_NEWS !== 'undefined' && Array.isArray(VERIFIED_NEWS) && VERIFIED_NEWS.length)
        ? mean(VERIFIED_NEWS.map(n => n.cred || 0)) : 7;
    const avgPropCred = (typeof PROPAGANDA_NEWS !== 'undefined' && Array.isArray(PROPAGANDA_NEWS) && PROPAGANDA_NEWS.length)
        ? mean(PROPAGANDA_NEWS.map(n => n.cred || 0)) : 2;
    const infoQuality = clamp(((avgVerifiedCred - avgPropCred) / 10), -0.5, 0.75);

    const milAvg = mean([sc('S4'), sc('S5'), sc('S6'), sc('S7')]);
    const milMomentum = mean([scenarioDelta('S4'), scenarioDelta('S5'), scenarioDelta('S6'), scenarioDelta('S7')]);
    const milInput =
        -1.35
        + (milAvg / 100) * 3.1
        + (milMomentum / 20) * 0.9
        + triggeredRatio * 1.8
        + watchRatio * 0.9
        + infoQuality * 0.55;
    const p1 = Math.round(clamp(sigmoid(milInput) * 100, 4, 96));

    const oilPressure = mean([sc('S9'), sc('S8')]);
    const oilMomentum = mean([scenarioDelta('S9'), scenarioDelta('S8')]);
    const p2Input =
        -1.6
        + (oilPressure / 100) * 3.4
        + (sc('S7') / 100) * 0.9
        + (oilMomentum / 25) * 0.8
        + triggeredRatio * 1.1
        + infoQuality * 0.45;
    const p2 = Math.round(clamp(sigmoid(p2Input) * 100, 4, 96));

    const cr007 = IW_INDICATORS.find(i => i.cr === 'CR-007');
    const cr014 = IW_INDICATORS.find(i => i.cr === 'CR-014');
    const nukeSignal =
        (cr007 && cr007.status === 'triggered') ? 1 : (cr007 && cr007.status === 'watch') ? 0.55 : 0.15;
    const fordowSignal =
        (cr014 && cr014.status === 'triggered') ? 0.8 : (cr014 && cr014.status === 'watch') ? 0.45 : 0.05;
    const p3Input =
        -0.45
        + nukeSignal * 1.35
        + fordowSignal * 1.2
        + triggeredRatio * 0.9
        + (scenarioDelta('S4') / 25) * 0.35;
    const p3 = Math.round(clamp(sigmoid(p3Input) * 100, 10, 97));

    const dipAvg = (sc('S1') + sc('S2')) / 2;
    const milPressure = (sc('S4') + sc('S5')) / 2;
    const dipMomentum = mean([scenarioDelta('S1'), scenarioDelta('S2')]);
    const p4Input =
        -1.8
        + (dipAvg / 100) * 3.0
        + (dipMomentum / 20) * 0.85
        - (milPressure / 100) * 1.55
        - triggeredRatio * 1.25
        - (1 - clearRatio) * 0.4
        + infoQuality * 0.35;
    const p4 = Math.round(clamp(sigmoid(p4Input) * 100, 3, 90));

    const iwMil = IW_INDICATORS.filter(i => ['CR-001','CR-002','CR-003','CR-005'].includes(i.cr) && i.status !== 'clear').length;
    const iwEcon = IW_INDICATORS.filter(i => ['CR-009','CR-010','CR-012'].includes(i.cr) && i.status !== 'clear').length;
    const iwNuke = IW_INDICATORS.filter(i => ['CR-007','CR-013','CR-014'].includes(i.cr) && i.status !== 'clear').length;
    const iwDip = IW_INDICATORS.filter(i => ['CR-006','CR-008'].includes(i.cr) && i.status !== 'clear').length;

    const int1 = computePredInterval(p1, iwMil);
    const int2 = computePredInterval(p2, iwEcon);
    const int3 = computePredInterval(p3, iwNuke);
    const int4 = computePredInterval(p4, Math.max(1, iwDip));

    const p1Conf = confidenceFromDrivers(p1, int1.hi - int1.lo, iwMil);
    const p2Conf = confidenceFromDrivers(p2, int2.hi - int2.lo, iwEcon);
    const p3Conf = confidenceFromDrivers(p3, int3.hi - int3.lo, iwNuke);
    const p4Conf = confidenceFromDrivers(p4, int4.hi - int4.lo, iwDip);

    const p1Label = probabilityLabel(p1);
    const p2Label = probabilityLabel(p2);
    const p3Label = probabilityLabel(p3);
    const p4Label = probabilityLabel(p4);

    return [
        { label: 'Eskalasi militer kinetik dalam 72 jam', pct: p1, lo: int1.lo, hi: int1.hi, levelLabel: p1Label, conf: p1Conf, confClass: p1Conf.toLowerCase() },
        { label: 'Harga Brent melampaui USD 105/barel minggu ini', pct: p2, lo: int2.lo, hi: int2.hi, levelLabel: p2Label, conf: p2Conf, confClass: p2Conf.toLowerCase() },
        { label: 'IAEA rilis laporan temuan nuklir baru &lt;7 hari', pct: p3, lo: int3.lo, hi: int3.hi, levelLabel: p3Label, conf: p3Conf, confClass: p3Conf.toLowerCase() },
        { label: 'Terobosan negosiasi back-channel Qatar/Oman &lt;14 hari', pct: p4, lo: int4.lo, hi: int4.hi, levelLabel: p4Label, conf: p4Conf, confClass: p4Conf.toLowerCase() },
    ];
}

function renderSIGINT() {
    if (typeof SIGINT_SOURCES === 'undefined') return;
    const fusionEl = document.getElementById('fusion-score-val');
    const sourceGrid = document.getElementById('source-grid');
    const anomalyList = document.getElementById('anomaly-list');
    const predEl = document.getElementById('predictive-list');

    const base = computeFusionScore();
    if (fusionEl) fusionEl.textContent = base;

    if (sourceGrid) {
        sourceGrid.innerHTML = SIGINT_SOURCES.map(s => {
            const str = Math.min(100, s.strength + Math.round((Math.random() - .4) * 8));
            const clr = str >= 80 ? '#00d4ff' : str >= 65 ? '#ffd700' : '#ff6e40';
            return `<div class="source-card">
                <div class="sc-header"><span class="sc-name">${s.name}</span><span class="sc-tier ${s.tier}">${s.tier.toUpperCase()}</span></div>
                <div class="sc-strength-wrap"><div class="sc-str-bar"><div class="sc-str-fill" style="width:${str}%;background:${clr}"></div></div><span class="sc-str-pct">${str}%</span></div>
                <div class="sc-meta">${s.topic}</div>
                <div class="sc-ping">Last: ${s.freshMins}mnt lalu ${s.speciality.map(b => `<span class="sc-badge">${b}</span>`).join('')}</div>
            </div>`;
        }).join('');
    }

    if (anomalyList) {
        const anomalies = SIGINT_SOURCES.filter(s => s.anomaly);
        anomalyList.innerHTML = anomalies.length
            ? anomalies.map(s => `<div class="anomaly-item"><span class="anom-src">⚠ ${s.name}</span><br>Sinyal anomali — output berbeda dari konsensus tier-1. Perlu cross-validation manual.</div>`).join('')
            : '<div style="color:var(--text-dim);font-size:11px">Tidak ada anomali terdeteksi.</div>';
    }

    if (predEl) {
        const predictions = computePredictiveAnalytics();
        predEl.innerHTML = predictions.map(p => `
            <div class="pred-item">
                <div class="pred-label">${p.label}</div>
                <div class="pred-conf ${p.confClass}">
                    ${p.levelLabel} — ${p.pct}%
                    <span style="font-size:8px;opacity:0.7;margin-left:4px">[${p.lo}%–${p.hi}%]</span>
                    (Conf: ${p.conf})
                </div>
            </div>`).join('');
    }
}

// ===== CHRONOLOGY =====
// FIX 9: renderChronology — added guard for undefined ESCALATION_CHRONOLOGY
function renderChronology() {
    if (typeof ESCALATION_CHRONOLOGY === 'undefined' || !Array.isArray(ESCALATION_CHRONOLOGY)) return;
    const container = document.getElementById('chronology-container');
    if (!container) return;

    container.innerHTML = ESCALATION_CHRONOLOGY.map(item => `
        <div class="chron-item">
            <div class="chron-line"></div>
            <div class="chron-dot">◉</div>
            <div class="chron-content">
                <div class="chron-time">${item.time}</div>
                <div class="chron-title">${item.title}</div>
                <div class="chron-impact">${item.impact}</div>
                <div class="chron-causality">
                    <span class="causality-label">ANALISIS KAUSALITAS :</span>
                    ${item.causality}
                </div>
            </div>
        </div>`).join('');
}

// ===== ACH CHALLENGE =====
function toggleChallenge(id) {
    const box = document.getElementById('cb-' + id);
    if (box) box.classList.toggle('open');
}

// ===== RED PHONE =====
function acknowledgeRedPhone() {
    const modal = document.getElementById('red-phone-modal');
    if (modal) modal.classList.add('hidden');
}

// ===== PDF EXPORT =====
function generatePDFReport() {
    if (typeof window.jspdf === 'undefined') {
        alert('jsPDF belum dimuat. Coba refresh halaman terlebih dahulu.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const now = new Date();
    const wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
    const p = n => String(n).padStart(2, '0');
    const pdfMonths = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const timestamp = `${p(wib.getDate())} ${pdfMonths[wib.getMonth()]} ${wib.getFullYear()} — ${p(wib.getHours())}:${p(wib.getMinutes())} WIB`;
    const dateSlug = `${wib.getFullYear()}${p(wib.getMonth()+1)}${p(wib.getDate())}_${p(wib.getHours())}${p(wib.getMinutes())}`;
    const threatLabels = ['RENDAH','SEDANG','WASPADA','TINGGI','KRITIS'];
    const threatColors = { 0:[0,230,118], 1:[105,240,174], 2:[255,215,0], 3:[255,110,64], 4:[255,23,68] };

    doc.setFillColor(6, 10, 15); doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(10, 20, 35); doc.rect(0, 0, 210, 22, 'F');
    doc.setDrawColor(0, 212, 255); doc.setLineWidth(0.3); doc.line(0, 22, 210, 22);

    doc.setTextColor(0, 212, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('INTEL DASHBOARD v4.0', 10, 10);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(106, 143, 168);
    doc.text('BRIEFING REPORT — KONFLIK IRAN-ISRAEL-AS', 10, 16);
    doc.setTextColor(100, 130, 150);
    doc.text(timestamp, 210 - 10, 10, { align: 'right' });
    doc.text('CLASSIFIED — INTERNAL USE ONLY', 210 - 10, 16, { align: 'right' });

    const tl = currentThreatLevel;
    const tlLabel = threatLabels[tl] || 'UNKNOWN';
    const tlColor = threatColors[tl] || [200, 200, 200];
    doc.setFillColor(15, 25, 40); doc.rect(8, 28, 92, 24, 'F');
    doc.setDrawColor(...tlColor); doc.setLineWidth(0.6); doc.rect(8, 28, 92, 24);
    doc.setTextColor(130, 160, 180); doc.setFontSize(8); doc.text('LEVEL ANCAMAN', 14, 35);
    doc.setTextColor(...tlColor); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text(tlLabel, 14, 48);

    const iwT = typeof IW_INDICATORS !== 'undefined' ? IW_INDICATORS.filter(i => i.status === 'triggered').length : 0;
    const iwW = typeof IW_INDICATORS !== 'undefined' ? IW_INDICATORS.filter(i => i.status === 'watch').length : 0;
    const iwC = typeof IW_INDICATORS !== 'undefined' ? IW_INDICATORS.filter(i => i.status === 'clear').length : 0;

    doc.setFillColor(15, 25, 40); doc.rect(106, 28, 96, 24, 'F');
    doc.setDrawColor(40, 60, 85); doc.setLineWidth(0.4); doc.rect(106, 28, 96, 24);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 160, 180); doc.setFontSize(8);
    doc.text('I&W MATRIX STATUS', 112, 35);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 80, 100); doc.text(`${iwT} TRIGGERED`, 112, 47);
    doc.setTextColor(255, 225, 50); doc.text(`${iwW} WATCH`, 147, 47);
    doc.setTextColor(0, 240, 128); doc.text(`${iwC} CLEAR`, 174, 47);

    doc.setDrawColor(26, 45, 69); doc.setLineWidth(0.2); doc.line(8, 56, 202, 56);
    doc.setTextColor(0, 212, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('PROBABILITAS SKENARIO — TOP 8', 8, 63);

    const top8 = [...scenarios].sort((a, b) => b.current - a.current).slice(0, 8);
    const groupColor = { militer:[255,80,100], diplomasi:[0,230,255], ekonomi:[255,225,50], ekstrem:[200,130,255] };

    top8.forEach((s, i) => {
        const col = i < 4 ? 8 : 108;
        const row = (i % 4);
        const y = 72 + row * 16;
        const gc = groupColor[s.group] || [200, 200, 200];
        doc.setFillColor(15, 25, 40); doc.rect(col, y - 5, 96, 14, 'F');
        doc.setDrawColor(40, 60, 85); doc.setLineWidth(0.3); doc.rect(col, y - 5, 96, 14);
        const barW = Math.round((s.current / 100) * 72);
        const sr = Math.round(gc[0] * 0.35 + 15 * 0.65);
        const sg = Math.round(gc[1] * 0.35 + 25 * 0.65);
        const sb = Math.round(gc[2] * 0.35 + 40 * 0.65);
        doc.setFillColor(sr, sg, sb); doc.rect(col + 2, y - 3, barW, 9, 'F');
        doc.setTextColor(220, 240, 255); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
        const nameClipped = s.name.length > 38 ? s.name.substring(0, 36) + '…' : s.name;
        doc.text(nameClipped, col + 4, y + 3);
        doc.setTextColor(...gc); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(`${s.current}%`, col + 88, y + 4, { align: 'right' });
    });

    const violated = (typeof KEY_ASSUMPTIONS !== 'undefined') ? KEY_ASSUMPTIONS.filter(k => !k.active) : [];
    const openGaps = (typeof INTEL_GAPS !== 'undefined') ? INTEL_GAPS.filter(g => g.status === 'OPEN') : [];

    doc.line(8, 138, 202, 138);
    doc.setTextColor(255, 225, 50); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`KEY ASSUMPTIONS — ${violated.length > 0 ? violated.length + ' DILANGGAR' : 'SEMUA AKTIF'}`, 8, 145);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    if (violated.length === 0) {
        doc.setTextColor(0, 240, 128); doc.text('Semua asumsi analitik aktif dan valid.', 8, 153);
    } else {
        violated.forEach((ka, i) => {
            doc.setTextColor(255, 80, 100);
            doc.text(`✗ [${ka.id}] ${ka.text.substring(0, 90)}`, 8, 153 + i * 8);
        });
    }

    const gapStartY = 162 + Math.max(0, violated.length - 1) * 8;
    doc.line(8, gapStartY, 202, gapStartY);
    doc.setTextColor(255, 160, 0); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(`INTELLIGENCE GAPS — ${openGaps.length} OPEN`, 8, gapStartY + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    openGaps.slice(0, 5).forEach((g, i) => {
        doc.setTextColor(255, 185, 100);
        doc.text(`○ [${g.id}][${g.priority}] ${g.question.substring(0, 85)}`, 8, gapStartY + 16 + i * 8);
    });
    if (openGaps.length > 5) {
        doc.setTextColor(130, 170, 190);
        doc.text(`... dan ${openGaps.length - 5} gap lainnya`, 8, gapStartY + 16 + 5 * 8);
    }

    const summaryStartY = gapStartY + 24 + Math.min(openGaps.length, 6) * 8;
    doc.line(8, summaryStartY, 202, summaryStartY);
    doc.setTextColor(0, 255, 204); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('RINGKASAN ANALIS (AUTO-GENERATED)', 8, summaryStartY + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 220, 240);
    try {
        const summary = buildAnalystSummary();
        const summaryLines = doc.splitTextToSize(summary, 190);
        doc.text(summaryLines.slice(0, 8), 8, summaryStartY + 16);
    } catch (e) { doc.text('Ringkasan tidak tersedia.', 8, summaryStartY + 16); }

    doc.setFillColor(10, 20, 35); doc.rect(0, 285, 210, 12, 'F');
    doc.setDrawColor(0, 212, 255); doc.setLineWidth(0.2); doc.line(0, 285, 210, 285);
    doc.setTextColor(60, 90, 110); doc.setFontSize(6.5);
    doc.text('INTEL DASHBOARD v4.0 — Metode: I&W + ACH + Red Team + DST + Key Assumptions + SIGINT Fusion', 8, 291);
    doc.text(`Refresh #${refreshCount} | ${timestamp}`, 210 - 8, 291, { align: 'right' });

    const btn = document.getElementById('pdf-btn');
    if (btn) {
        btn.textContent = '✓ PDF TERSIMPAN';
        btn.style.color = 'var(--accent-green)';
        setTimeout(() => { btn.textContent = '⬇ EXPORT PDF'; btn.style.color = ''; }, 2000);
    }

    try {
        doc.save(`Intel_Briefing_${dateSlug}.pdf`);
    } catch (e) {
        const pdfBase64 = doc.output('datauristring');
        const a = document.createElement('a');
        a.href = pdfBase64;
        a.download = `Intel_Briefing_${dateSlug}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// ==========================================
// UI EVENT BINDING — Consolidated
// ==========================================

function initTabEvents() {
    const radarAcc = document.getElementById('acc-netassess');
    if (radarAcc) {
        radarAcc.addEventListener('toggle', (e) => {
            if (e.target.open && typeof radarChart !== 'undefined' && radarChart) {
                setTimeout(() => radarChart.update(), 120);
            }
        });
    }
}

let delegatedUiEventsBound = false;

function handleDelegatedUIClick(e) {
    const challengeBtn = e.target.closest('[data-challenge-id]');
    if (challengeBtn) {
        const id = challengeBtn.getAttribute('data-challenge-id');
        if (id) toggleChallenge(id);
        return;
    }

    const layerBtn = e.target.closest('.wv-pill[data-layer]');
    if (layerBtn) {
        const cat = layerBtn.getAttribute('data-layer');
        if (cat && typeof window.toggleLayer === 'function') window.toggleLayer(cat, layerBtn);
        return;
    }

    const liveLayerBtn = e.target.closest('.wv-pill[data-live-layer]');
    if (liveLayerBtn) {
        const src = liveLayerBtn.getAttribute('data-live-layer');
        if (src && typeof window.toggleLiveLayer === 'function') window.toggleLiveLayer(src, liveLayerBtn);
        return;
    }

    const perspectiveBtn = e.target.closest('.pv-btn[data-perspective]');
    if (perspectiveBtn) {
        const p = perspectiveBtn.getAttribute('data-perspective');
        if (p) setPerspective(p, perspectiveBtn);
        return;
    }

    const feedFilterBtn = e.target.closest('.ff-btn[data-feed-filter]');
    if (feedFilterBtn) {
        const f = feedFilterBtn.getAttribute('data-feed-filter');
        if (f) filterFeed(f);
        return;
    }

    const actionBtn = e.target.closest('#btn-analysis, #close-analysis-btn, #refresh-btn, #pdf-btn, #snapshot-btn, #uv-toggle-btn, #rp-ack-btn');
    if (!actionBtn) return;

    switch (actionBtn.id) {
        case 'btn-analysis':
        case 'close-analysis-btn':
            if (typeof window.toggleAnalysisPanel === 'function') window.toggleAnalysisPanel();
            break;
        case 'refresh-btn':
            triggerRefresh();
            break;
        case 'pdf-btn':
            generatePDFReport();
            break;
        case 'snapshot-btn':
            saveSnapshot();
            break;
        case 'uv-toggle-btn':
            toggleUnverified();
            break;
        case 'rp-ack-btn':
            acknowledgeRedPhone();
            break;
    }
}

function initToolbarEvents() {
    if (!delegatedUiEventsBound) {
        document.addEventListener('click', handleDelegatedUIClick);
        delegatedUiEventsBound = true;
    }

    const credFilter = document.getElementById('high-cred-filter');
    if (credFilter) credFilter.addEventListener('change', toggleCredFilter);
}

function initAnalysisPanelEvents() {
    const overlay = document.getElementById('analysis-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) {
        const gapItem = e.target.closest('[data-gap-id]');
        if (gapItem) {
            const id = gapItem.getAttribute('data-gap-id');
            if (id) cycleGapStatus(id);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initTabEvents();
    initToolbarEvents();
    initAnalysisPanelEvents();
    console.log('[INIT] UI Event Binding Complete.');
});

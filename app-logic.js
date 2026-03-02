
// ===== STATE =====
let scenarios = (typeof SCENARIOS !== 'undefined') ? SCENARIOS.map(s => ({ ...s })) : [];
let currentThreatLevel = 4, refreshCount = 0, countdownSeconds = 300;
let countdownTimer = null, isLoading = false, leafletMap = null;
let mapLayers = {}, radarChart = null, currentPerspective = 'iran';
let activeFeedFilter = 'all', credFilterOn = false, uvVisible = false;

// Timers for memory management
let masterClockTimer = null;
let liveNewsTimer = null;
let newsInjectTimer = null;
let bootFailsafeTimer = null;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    runBootSequence().catch(e => { });
    // 15-second hard failsafe: force-hide overlay no matter what
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
        'LOADING INTEL DASHBOARD v3.0...'
    ];
    const logEl = document.getElementById('boot-log');
    const barEl = document.getElementById('boot-bar');

    for (let i = 0; i < lines.length; i++) {
        if (!logEl || !barEl) break;
        const line = document.createElement('div');
        line.textContent = '> ' + lines[i];
        logEl.appendChild(line);
        barEl.style.width = ((i + 1) / lines.length * 100) + '%';
        await sleep(300 + Math.random() * 400); // Random delay 0.3s - 0.7s per line
    }

    await sleep(400);
    const seq = document.getElementById('boot-sequence');
    if (seq) seq.classList.add('hidden');

    // Now run normal init safely
    try { initTabs(); } catch (e) { }
    try {
        updateClock();
        if (masterClockTimer) clearInterval(masterClockTimer);
        masterClockTimer = setInterval(updateClock, 1000);
    } catch (e) { }
    try { startCountdown(); } catch (e) { }
    try { initMap(); } catch (e) { }
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
            const delay = Math.floor(Math.random() * 10000) + 8000; // 8s-18s
            if (newsInjectTimer) clearTimeout(newsInjectTimer);
            newsInjectTimer = setTimeout(() => {
                const pools = [];
                // Weighting so verified is more common
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
                    renderNews();
                    const c = document.getElementById('osint-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                } else if (selected.type === 'propaganda' && typeof PROPAGANDA_NEWS !== 'undefined') {
                    PROPAGANDA_NEWS.unshift(nextItem);
                    renderPropaganda();
                    const c = document.getElementById('prop-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                } else if (selected.type === 'unverified' && typeof UNVERIFIED_NEWS !== 'undefined') {
                    UNVERIFIED_NEWS.unshift(nextItem);
                    renderUnverified();
                    const c = document.getElementById('unverified-feed');
                    if (c && c.firstElementChild) c.firstElementChild.classList.add('flash-new');
                }

                startLiveNewsEngine();
            }, delay);
        }
    }
    try { startLiveNewsEngine(); } catch (e) { }

    simulateRefresh(true).catch(e => {
        hideLoadingOverlay();
    });
}

function hideLoadingOverlay() {
    try { document.getElementById('loading-overlay').classList.add('hidden'); } catch (e) { }
}

// ===== TABS =====
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'tab-map' && leafletMap) setTimeout(() => leafletMap.invalidateSize(), 120);
            if (btn.dataset.tab === 'tab-netassess' && radarChart) radarChart.update();
        });
    });
}

// ===== CLOCK =====
function updateClock() {
    const now = new Date(), utc = now.getTime() + now.getTimezoneOffset() * 60000, wib = new Date(utc + 7 * 3600000);
    const p = n => String(n).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    document.getElementById('clock-display').textContent = `${p(wib.getHours())}:${p(wib.getMinutes())}:${p(wib.getSeconds())} WIB`;
    document.getElementById('date-display').textContent = `${p(wib.getDate())} ${months[wib.getMonth()]} ${wib.getFullYear()}`;
}

// ===== COUNTDOWN =====
function startCountdown() {
    countdownSeconds = 300;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
        countdownSeconds--;
        const m = Math.floor(countdownSeconds / 60), s = countdownSeconds % 60;
        document.getElementById('countdown-display').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        if (countdownSeconds <= 0) { clearInterval(countdownTimer); simulateRefresh(false); }
    }, 1000);
}
function triggerRefresh() { if (!isLoading) { clearInterval(countdownTimer); simulateRefresh(false); } }

// ===== SIMULATE REFRESH =====
async function simulateRefresh(isInitial) {
    isLoading = true;
    const btn = document.getElementById('refresh-btn'); btn.classList.add('loading');
    const overlay = document.getElementById('loading-overlay');
    const ltxt = document.getElementById('loading-text'), lsteps = document.getElementById('loading-steps');
    overlay.classList.remove('hidden'); lsteps.innerHTML = '';
    const steps = ['KONEKSI AMAN TERBENTUK...', 'WEB SEARCH: REUTERS/AP/ISW/IAEA...', 'ANALISIS BERITA KONFLIK IRAN-ISRAEL-AS...', 'I&W MATRIX: EVALUASI 16 INDIKATOR...', 'ACH: SCORING COMPETING HYPOTHESES...', 'RED TEAM: KALKULASI PAYOFF MATRIX...', 'NET ASSESSMENT: RADAR UPDATE...', 'SIGINT FUSION: SIGNAL vs NOISE...', 'UPDATE 12 PROBABILITAS + CONFIDENCE...', 'FILTER PROPAGANDA & UNVERIFIED INTEL...'];
    for (let i = 0; i < steps.length; i++) {
        ltxt.textContent = isInitial ? 'MEMULAI INTEL DASHBOARD v3.0...' : 'MULTI-METHOD INTELLIGENCE UPDATE...';
        const el = document.createElement('div'); el.className = 'loading-step step-active'; el.textContent = `▸ ${steps[i]}`; lsteps.appendChild(el);
        await sleep(isInitial ? 220 : 130);
        el.className = 'loading-step step-done'; el.textContent = `✓ ${steps[i].replace('...', '').trim()}`;
    }
    try {
        applyProbabilityUpdate();
        updateThreatLevel();

        // --- RED PHONE TRIGGER LOGIC ---
        if (!isInitial) {
            const criticalSpike = scenarios.find(s => (s.group === 'militer' || s.group === 'ekonomi') && (s.current - s.baseline) >= 15);
            if (criticalSpike) {
                document.getElementById('rp-message').innerHTML = `Peringatan Darurat: Lonjakan tajam terdeteksi pada skenario <strong>${criticalSpike.name}</strong> (+${criticalSpike.current - criticalSpike.baseline}%).<br><br>Skenario krusial ini melampaui red-line sistem analisis otomatis. Diperlukan eskalasi intelijen ke pengambil kebijakan segera.`;
                document.getElementById('red-phone-modal').classList.remove('hidden');
            }
        }

        renderAll();
    } catch (e) { console.error('renderAll error:', e); }
    await sleep(250);
    hideLoadingOverlay();
    // Re-init map AFTER overlay hides so SVG renders into visible container
    try { initMap(); } catch (e) { console.error('initMap post-load:', e); }
    try {
        btn.classList.remove('loading');
    } catch (e) { }
    isLoading = false;
    refreshCount++;
    try {
        document.getElementById('refresh-count').textContent = refreshCount;
        const now = new Date(), wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
        const p = n => String(n).padStart(2, '0');
        const ts = `${p(wib.getHours())}:${p(wib.getMinutes())}`;
        document.getElementById('last-update').textContent = ts;
        document.getElementById('analysis-time').textContent = `${ts} WIB`;
    } catch (e) { }
    try { startCountdown(); } catch (e) { }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== PROBABILITY & THREAT =====
function computeIW() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;
    IW_INDICATORS.forEach(i => {
        if (typeof i.val !== 'number') return;

        // Compute trend vs base
        if (Math.abs(i.val - i.base) < (i.base * 0.05) || i.base === 0) i.trend = 'flat';
        else i.trend = (i.val > i.base) ? 'up' : 'down';

        // Compute status based on thresholds
        if (i.inverse) {
            i.status = (i.val <= i.triggerThresh) ? 'triggered' : (i.val <= i.watchThresh) ? 'watch' : 'clear';
        } else {
            i.status = (i.val >= i.triggerThresh) ? 'triggered' : (i.val >= i.watchThresh) ? 'watch' : 'clear';
        }

        // Formatting reading
        i.reading = `${i.val % 1 !== 0 ? i.val.toFixed(1) : i.val} ${i.unit}`;
    });
}

function applyProbabilityUpdate() {
    // Add noise to IW values
    if (typeof IW_INDICATORS !== 'undefined') {
        IW_INDICATORS.forEach(i => {
            if (typeof i.val === 'number' && typeof i.triggerThresh === 'number' && typeof i.base === 'number') {
                const maxDelta = Math.abs(i.triggerThresh - i.base) * 0.3; // 30% volatility max
                const shift = (Math.random() - 0.5) * maxDelta;
                i.val = Math.max(0, i.val + shift); // ensure no negative
            }
        });
    }
    computeIW();

    const iwT = IW_INDICATORS.filter(i => i.status === 'triggered').length;
    const mul = 1 + iwT * 0.02; // I&W multiplier
    scenarios = scenarios.map(s => {
        const diff = s.current - s.baseline, rev = -diff * 0.12, noise = (Math.random() - 0.4) * 6 * mul;
        // Clamp explicitly to 0-100
        return { ...s, current: Math.min(100, Math.max(0, Math.round(s.current + rev + noise))) };
    });
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
    const f = id => {
        const s = scenarios.find(sc => sc.id === id);
        return s ? s.current : 0;
    };

    // Scale weighted average to approach 100 for proper boundary conditions
    // Boundary conditions tested: 79 -> 80 = TINGGI -> KRITIS
    const scoreSum = f('S4') * 0.30 + f('S5') * 0.25 + f('S7') * 0.25 + f('S8') * 0.20;
    const iwT = IW_INDICATORS.filter(i => i.status === 'triggered').length;

    // Formula verification: scale limits cleanly
    const sc = Math.min(100, Math.round((scoreSum * 1.5) + (iwT * 2.5)));

    // Boundary enforcement
    currentThreatLevel = sc >= 80 ? 4 : sc >= 60 ? 3 : sc >= 40 ? 2 : sc >= 20 ? 1 : 0;
}

// ===== RENDER ALL =====
function renderAll() {
    renderThreat(); renderScenarios(); renderDeltaTracker(); renderNews();
    renderAnalystSummary(); renderIWCounts(); renderSignalNoise(); renderSIGINT();
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
function renderThreat() {
    if (currentThreatLevel < 0 || currentThreatLevel >= TCFG.length) return;
    const c = TCFG[currentThreatLevel];
    if (!c) return;
    const lbl = document.getElementById('threat-label');
    if (lbl) {
        lbl.textContent = c.label;
        lbl.style.color = c.color;
        lbl.style.textShadow = `0 0 20px ${c.glow},0 0 40px ${c.glow}66`;
    }
    const sub = document.getElementById('threat-sub');
    if (sub) sub.textContent = c.sub;

    for (let i = 0; i < 5; i++) {
        const b = document.getElementById(`tb${i}`);
        if (b) {
            b.className = 'tbar';
            if (i < c.bCount) b.classList.add(BCLS[i]);
        }
    }
    const tids = document.querySelectorAll('.tid');
    if (tids) {
        tids.forEach((el, i) => { if (el) el.style.opacity = i === currentThreatLevel ? '1' : '0.35'; });
    }
}

// ===== SCENARIOS =====
const GRP = { diplomasi: 'group-diplomasi', militer: 'group-militer', ekonomi: 'group-ekonomi', ekstrem: 'group-ekstrem' };
function renderScenarios() {
    Object.values(GRP).forEach(id => document.getElementById(id).innerHTML = '');
    scenarios.forEach(s => {
        const el = document.getElementById(GRP[s.group]); if (!el) return;
        const delta = s.current - s.baseline;
        const ds = delta === 0 ? '±0%' : delta > 0 ? `+${delta}%` : `${delta}%`;
        const dc = delta > 0 ? 'pos' : delta < 0 ? 'neg' : 'neutral';
        const pc = s.group === 'militer' ? (s.current > 40 ? 'var(--accent-red)' : 'var(--accent-orange)') : s.group === 'ekonomi' ? 'var(--accent-yellow)' : s.group === 'ekstrem' ? 'var(--accent-purple)' : 'var(--accent-cyan)';
        const conf = computeConf(s);
        const tags = s.tags.map(t => `<span class="tag ${t === 'de-eskalasi' ? 'deeskalasi' : t}">${t.toUpperCase()}</span>`).join('');
        el.insertAdjacentHTML('beforeend', `<div class="scenario-item">
      <div class="scenario-header">
        <div class="scenario-name">${esc(s.name)}</div>
        <div class="scenario-prob" style="color:${pc}">${s.current}%</div>
        <div class="scenario-delta ${dc}">${ds}</div>
      </div>
      <div class="bar-container">
        <div class="bar-baseline" style="width:${s.baseline}%"></div>
        <div class="bar-current ${s.barClass}" style="width:${s.current}%"></div>
      </div>
      <div class="scenario-footer">${tags}<span class="conf-badge ${conf}">${CLBL[conf]}</span></div>
      ${s.challenge ? `<button class="btn-challenge" onclick="toggleChallenge('${s.id}')">⚡ CHALLENGE THIS ANALYSIS <span style="float:right;font-size:8px;opacity:0.5">(DEVIL'S ADVOCATE)</span></button><div class="challenge-box" id="cb-${s.id}"><div class="cb-label">ACH HIGHLIGHT <span>(AI Red Team)</span></div>${esc(s.challenge)}</div>` : ''}
    </div>`);
    });
}

// ===== DELTA =====
function renderDeltaTracker() {
    const el = document.getElementById('delta-list');
    if (!el || !Array.isArray(scenarios)) return;
    const top = scenarios.map(s => ({ ...s, delta: s.current - s.baseline, abs: Math.abs(s.current - s.baseline) })).filter(s => s.abs > 0).sort((a, b) => b.abs - a.abs).slice(0, 6);
    el.innerHTML = top.length ? top.map(s => `<div class="delta-item">
    <span class="delta-arrow ${s.delta > 0 ? 'up' : 'down'}">${s.delta > 0 ? '▲' : '▼'}</span>
    <span class="delta-label">${esc(s.name)}</span>
    <span class="delta-value ${s.delta > 0 ? 'pos' : 'neg'}">${s.delta > 0 ? '+' + s.delta : s.delta}%</span>
  </div>`).join('') : '<div style="color:var(--text-dim);font-size:11px;padding:6px 0">Tidak ada perubahan dari baseline.</div>';
}

// ===== SECURITY & ESCAPING =====
function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"'`=\/]/g, function (s) {
        return {
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
        }[s];
    });
}

// ===== NEWS =====
function filterFeed(f) {
    activeFeedFilter = f;
    document.querySelectorAll('.ff-btn').forEach(b => b.classList.toggle('active', b.getAttribute('onclick').includes(`'${f}'`)));
    renderNews();
}
function toggleCredFilter() { credFilterOn = document.getElementById('high-cred-filter').checked; renderPropaganda(); }
function toggleUnverified() {
    uvVisible = !uvVisible;
    document.getElementById('unverified-feed').classList.toggle('uv-hidden', !uvVisible);
    document.getElementById('uv-toggle-btn').textContent = uvVisible ? 'SEMBUNYIKAN' : 'TAMPILKAN';
}
function renderNews() {
    if (typeof VERIFIED_NEWS === 'undefined' || !Array.isArray(VERIFIED_NEWS)) return;
    const sorted = [...VERIFIED_NEWS].sort((a, b) => a.time - b.time);
    const filtered = activeFeedFilter === 'all' ? sorted : sorted.filter(n => n.impact === activeFeedFilter);
    const cb = document.getElementById('feed-count'); if (cb) cb.textContent = filtered.length;

    const elFeed = document.getElementById('osint-feed');
    if (!elFeed) return;
    const now = new Date();
    document.getElementById('osint-feed').innerHTML = filtered.map(n => {
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
function renderPropaganda() {
    const list = credFilterOn ? PROPAGANDA_NEWS.filter(n => n.cred >= 7) : PROPAGANDA_NEWS;
    document.getElementById('prop-count').textContent = `${PROPAGANDA_NEWS.filter(n => n.cred < 5).length} FLAGS`;
    document.getElementById('prop-feed').innerHTML = list.map(n => `<div class="prop-item">
    <div class="prop-item-header"><span class="prop-flag">${n.flag}</span><span class="credibility-score ${n.cred >= 8 ? 'high' : n.cred >= 6 ? 'med' : 'low'}">CRED:${n.cred}/10</span></div>
    <div class="prop-headline">"${esc(n.headline)}" — ${esc(n.source)}</div>
    <div class="prop-analysis">${esc(n.analysis)}</div>
  </div>`).join('');
}
function renderUnverified() {
    document.getElementById('unverified-feed').innerHTML = UNVERIFIED_NEWS.map(n => `<div class="uv-item">
    <div class="uv-watermark">UNVERIFIED</div>
    <div><span class="uv-label">${esc(n.label)}</span></div>
    <div class="uv-headline">${esc(n.headline)}</div>
    <div class="uv-impact">Potensi Dampak (IF valid): <strong>${esc(n.impact)}</strong></div>
  </div>`).join('');
}
function renderAnalystSummary() {
    document.getElementById('analyst-summary').textContent = ANALYST_SUMMARIES[Math.floor(Math.random() * ANALYST_SUMMARIES.length)];
}
function renderSignalNoise() {
    const sig = Math.min(95, 62 + Math.round(Math.random() * 20)), noise = 100 - sig;
    document.getElementById('sn-bar').style.width = sig + '%';
    document.getElementById('sn-noise').style.width = noise + '%';
    document.getElementById('sn-ratio').textContent = `${sig}:${noise}`;
}

// ===== I&W =====
const IW_CATS = ['MILITER', 'DIPLOMATIK', 'EKONOMI', 'INTELIJEN'];
function renderIW() {
    document.getElementById('iw-table').innerHTML = IW_CATS.map(cat => {
        const rows = IW_INDICATORS.filter(i => i.cat === cat);
        return `<div class="iw-category">
      <div class="iw-cat-title">${cat}</div>
      <div class="iw-row header"><div>STS</div><div>CR-ID</div><div>INDIKATOR</div><div>THRESHOLD</div><div>READING</div><div>↕</div></div>
      ${rows.map(r => `<div class="iw-row">
        <div><div class="iw-dot ${r.status}"></div></div>
        <div class="iw-cr">${r.cr}</div>
        <div class="iw-name">${esc(r.name)}</div>
        <div class="iw-threshold">${esc(r.threshold)}</div>
        <div class="iw-reading ${r.status}">${esc(r.reading)}</div>
        <div class="iw-trend ${r.trend === 'up' ? 'up' : r.trend === 'down' ? 'down' : 'flat'}">${r.trend === 'up' ? '↑' : r.trend === 'down' ? '↓' : '→'}</div>
      </div>`).join('')}
    </div>`;
    }).join('');
    renderIWCounts();
}
function renderIWCounts() {
    if (typeof IW_INDICATORS === 'undefined' || !Array.isArray(IW_INDICATORS)) return;
    const tot = IW_INDICATORS.length;
    if (tot === 0) return; // Prevent Divide by Zero

    const t = IW_INDICATORS.filter(i => i.status === 'triggered').length;
    const w = IW_INDICATORS.filter(i => i.status === 'watch').length;
    const cl = IW_INDICATORS.filter(i => i.status === 'clear').length;

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

    // Tie scenarios handling: pick all candidates with minIncons and maxDiag
    const winners = bestCandidates.filter(s => s.diag === maxDiag).map(s => s.hi);
    const best = winners[0]; // Primary winner for simple highlight

    const hdrs = ACH_HYPOTHESES.map((h, i) => `<th class="hyp${winners.includes(i) ? ' winner' : ''}">${esc(h.short)}<br><small style="font-size:8px;opacity:.6">${h.id}</small></th>`).join('');
    // Ensure styles to highlight winner columns subtly
    const rows = ACH_EVIDENCE.map(ev => `<tr><td class="ev-label">${esc(ev.ev)}</td>${ev.cells.map((c, i) => `<td class="${CCLS[c]}">${c}</td>`).join('')}</tr>`).join('');

    document.getElementById('ach-matrix').innerHTML = `<table class="ach-table"><thead><tr><th>BUKTI / HIPOTESIS</th>${hdrs}</tr></thead><tbody>${rows}</tbody></table>`;
    document.getElementById('ach-scores').innerHTML = scores.map((sc, i) => `<div class="ach-score-item"><div class="ach-score-val${winners.includes(i) ? ' best' : ''}">${sc.incons}I / ${sc.diag}D</div><div class="ach-score-name">${esc(ACH_HYPOTHESES[i].short)}</div></div>`).join('');

    const winnerNames = winners.map(i => `<strong>${esc(ACH_HYPOTHESES[i].name)}</strong>`).join(' & ');
    document.getElementById('ach-conclusion').innerHTML = `<strong>KESIMPULAN ACH:</strong> Hipotesis paling konsisten dengan bukti: ${winnerNames} — hanya ${minIncons} inkonsistensi berbobot (Weighted Inconsistency) dari ${ACH_EVIDENCE.length} bukti. Lakukan collection requirement pada indikator diagnostik untuk konfirmasi.`;
}

// ===== RED TEAM =====
function renderRedTeam() {
    const d = PAYOFF_DATA[currentPerspective];
    document.getElementById('pv-label').textContent = d.title;
    document.getElementById('nash-info').textContent = d.nash;
    document.getElementById('dominant-strategy').innerHTML = `<strong>DOMINANT STRATEGY:</strong> ${d.dominant}`;
    const rows = d.rowLabels, cols = d.colLabels;
    let html = `<div class="payoff-grid">
    <div class="payoff-label"></div>
    <div class="payoff-label col">${cols[0]}</div>
    <div class="payoff-label col">${cols[1]}</div>`;
    d.cells.forEach((c, i) => {
        if (i % 2 === 0) html += `<div class="payoff-label row">${rows[Math.floor(i / 2)]}</div>`;
        const va = parseFloat(c.rv), vb = parseFloat(c.cv);
        html += `<div class="payoff-cell${c.isNash ? ' nash' : ''}">
      <div class="payoff-val ${va > 0 ? 'pos' : va < 0 ? 'neg' : 'neu'}">A:${c.rv}</div>
      <div class="payoff-val ${vb > 0 ? 'pos' : vb < 0 ? 'neg' : 'neu'}">B:${c.cv}</div>
      <div class="payoff-desc">${c.rdesc} / ${c.cdesc}</div>
      ${c.isNash ? '<div style="font-size:8px;color:var(--accent-yellow);font-family:var(--font-data)">⚡NASH EQ</div>' : ''}
    </div>`;
    });
    html += '</div>';
    document.getElementById('payoff-matrix').innerHTML = html;
    document.getElementById('wargame-list').innerHTML = WARGAME_SCENARIOS.map(w => `<div class="wargame-item">
    <div class="wg-name">${w.name}</div>
    <div class="wg-utility"><span style="font-size:9px;color:var(--text-dim);font-family:var(--font-data);min-width:52px">${w.l1}</span><div class="wg-bar"><div class="wg-fill" style="width:${w.util1}%;background:${w.col1}"></div></div><span class="wg-score" style="color:${w.col1}">${w.util1}</span></div>
    <div class="wg-utility"><span style="font-size:9px;color:var(--text-dim);font-family:var(--font-data);min-width:52px">${w.l2}</span><div class="wg-bar"><div class="wg-fill" style="width:${w.util2}%;background:${w.col2}"></div></div><span class="wg-score" style="color:${w.col2}">${w.util2}</span></div>
  </div>`).join('');
}
function setPerspective(p) {
    currentPerspective = p;
    document.querySelectorAll('.pv-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderRedTeam();
}

// ===== NET ASSESSMENT =====
function renderNetAssessTable() {
    document.getElementById('netassess-table').innerHTML = `<table class="na-table">
    <thead><tr><th>DIMENSI</th><th>🇮🇷 IRAN</th><th>🇮🇱 ISRAEL</th><th>🇺🇸 AS</th></tr></thead>
    <tbody>${NET_DIMS.map((d, i) => `<tr>
      <td class="na-dim">${d}</td>
      <td><div class="na-bar"><div class="na-fill iran" style="width:${NET_DATA.iran[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.iran[i]}</span></td>
      <td><div class="na-bar"><div class="na-fill israel" style="width:${NET_DATA.israel[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.israel[i]}</span></td>
      <td><div class="na-bar"><div class="na-fill us" style="width:${NET_DATA.us[i]}%"></div></div> <span style="font-family:var(--font-data);font-size:10px">${NET_DATA.us[i]}</span></td>
    </tr>`).join('')}</tbody>
  </table>`;
    document.getElementById('netassess-summary').innerHTML = '<strong>Net Assessment:</strong> AS memiliki superioritas absolut di hampir semua dimensi. Iran memimpin di <strong>Proxy Networks (85/100)</strong> sebagai asymmetric equalizer. Israel unggul di <strong>Siber (82)</strong> dan <strong>Presisi Militer (78)</strong>. Konflik langsung Iran vs Israel: Israel menang militer konvensional, namun Iran dapat mengeksploitasi proxy untuk meningkatkan biaya secara signifikan.';
}
function initRadarChart() {
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    // Replace canvas with SVG radar chart
    const W = 280, H = 280, cx = 140, cy = 140, R = 110;
    const n = NET_DIMS.length;
    const angle = i => (i * 2 * Math.PI / n) - Math.PI / 2;
    const pt = (val, i) => {
        const a = angle(i), r = (val / 100) * R;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    };
    const ptStr = (val, i) => { const p = pt(val, i); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; };
    const polyStr = (data) => data.map((v, i) => ptStr(v, i)).join(' ');

    // Grid rings
    let rings = '';
    for (let g = 20; g <= 100; g += 20) {
        const pts = NET_DIMS.map((_, i) => ptStr(g, i)).join(' ');
        rings += `<polygon points="${pts}" fill="none" stroke="rgba(26,45,69,0.8)" stroke-width="${g === 100 ? 1 : 0.5}"/>`;
        if (g === 100 || g === 60 || g === 20) rings += `<text x="${(cx + 4).toFixed(0)}" y="${(cy - (g / 100) * R - 3).toFixed(0)}" fill="rgba(100,150,180,0.5)" font-size="7" font-family="Share Tech Mono">${g}</text>`;
    }
    // Axis lines and labels
    let axes = '';
    NET_DIMS.forEach((dim, i) => {
        const a = angle(i);
        const ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
        const lx = cx + (R + 18) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a);
        axes += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="rgba(26,45,69,0.9)" stroke-width="0.8"/>`;
        const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        axes += `<text x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" fill="#4a7a9a" font-size="7.5" font-family="Share Tech Mono" text-anchor="${anchor}">${dim.replace(' & ', '/').replace('Kapabilitas ', '')}</text>`;
    });
    // Data polygons
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

    // Replace canvas with SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H + 20);
    svg.setAttribute('viewBox', `0 0 ${W} ${H + 20}`);
    svg.style.cssText = 'display:block;margin:0 auto;max-width:100%';
    svg.innerHTML = `<rect width="${W}" height="${H + 20}" fill="rgba(6,16,26,0.6)" rx="6"/>
      ${rings}${axes}${polys}${dots}${legend}`;
    canvas.parentNode.replaceChild(svg, canvas);
    radarChart = { update: () => { } }; // dummy to prevent errors
}

// ===== CONE =====
function renderCone() {
    const track = CONE_MONTHS.map((m, i) => `<div class="cone-column">
    <div class="cone-month">${m}</div>
    <div class="cone-lane worst">${CONE_WORST[i]}</div>
    <div class="cone-lane likely">${CONE_LIKELY[i]}</div>
    <div class="cone-lane best">${CONE_BEST[i]}</div>
  </div>`).join('');
    const milestones = CONE_MILESTONES.map(m => `<div class="cone-milestone"><div class="cm-dot"></div><span class="cm-date">${m.date}</span><span>${m.text}</span></div>`).join('');
    document.getElementById('cone-container').innerHTML = `<div class="cone-timeline"><div class="cone-track">${track}</div><div style="margin-top:16px"><div style="font-family:var(--font-data);font-size:9px;color:var(--accent-cyan);letter-spacing:2px;margin-bottom:8px">KEY DECISION POINTS</div>${milestones}</div></div>`;
}

// ===== SIGINT FUSION =====
function renderSIGINT() {
    const base = Math.min(98, Math.round(70 + refreshCount * 1.5 + Math.random() * 6));
    document.getElementById('fusion-score-val').textContent = base;
    document.getElementById('source-grid').innerHTML = SIGINT_SOURCES.map(s => {
        const str = Math.min(100, s.strength + Math.round((Math.random() - .4) * 8));
        const clr = str >= 80 ? '#00d4ff' : str >= 65 ? '#ffd700' : '#ff6e40';
        return `<div class="source-card">
      <div class="sc-header"><span class="sc-name">${s.name}</span><span class="sc-tier ${s.tier}">${s.tier.toUpperCase()}</span></div>
      <div class="sc-strength-wrap"><div class="sc-str-bar"><div class="sc-str-fill" style="width:${str}%;background:${clr}"></div></div><span class="sc-str-pct">${str}%</span></div>
      <div class="sc-meta">${s.topic}</div>
      <div class="sc-ping">Last: ${s.freshMins}mnt lalu ${s.speciality.map(b => `<span class="sc-badge">${b}</span>`).join('')}</div>
    </div>`;
    }).join('');
    const anomalies = SIGINT_SOURCES.filter(s => s.anomaly);
    document.getElementById('anomaly-list').innerHTML = anomalies.length ? anomalies.map(s => `<div class="anomaly-item"><span class="anom-src">⚠ ${s.name}</span><br>Sinyal anomali — output berbeda dari konsensus tier-1. Perlu cross-validation manual.</div>`).join('') : '<div style="color:var(--text-dim);font-size:11px">Tidak ada anomali terdeteksi.</div>';
    document.getElementById('predictive-list').innerHTML = `
    <div class="pred-item"><div class="pred-label">Eskalasi militer dalam 72 jam</div><div class="pred-conf low">RENDAH — 18% (Conf: LOW)</div></div>
    <div class="pred-item"><div class="pred-label">Harga minyak > $105 minggu ini</div><div class="pred-conf high">TINGGI — 74% (Conf: HIGH)</div></div>
    <div class="pred-item"><div class="pred-label">IAEA laporan tambahan &lt;7 hari</div><div class="pred-conf high">HAMPIR PASTI — 91% (Conf: HIGH)</div></div>
    <div class="pred-item"><div class="pred-label">Terobosan diplomasi Qatar &lt;14 hari</div><div class="pred-conf med">MUNGKIN — 38% (Conf: MED)</div></div>`;
}

// ===== CUSTOM SVG TACTICAL MAP (100% OFFLINE) =====
// ===== REAL SATELLITE TACTICAL MAP (LEAFLET) =====
const MAP_LOCATIONS = [
    { lat: 32.1, lon: 34.8, label: 'TEL AVIV', sub: 'IDF HQ', color: '#3399ff', cat: 'airbase', r: 7 },
    { lat: 35.7, lon: 51.4, label: 'TEHRAN', sub: 'IRGC HQ / 84%', color: '#cc2244', cat: 'missile', r: 9 },
    { lat: 32.9, lon: 44.4, label: 'BAGHDAD', sub: 'PMF', color: '#ff8c00', cat: 'proxy', r: 6 },
    { lat: 27.2, lon: 56.3, label: 'HORMUZ', sub: 'Task Force 50', color: '#ffd700', cat: 'naval', r: 8 },
    { lat: 33.9, lon: 35.5, label: 'BEIRUT', sub: 'Hezbollah', color: '#ff3355', cat: 'proxy', r: 6 },
    { lat: 15.4, lon: 44.2, label: "SANAA", sub: 'Houthi', color: '#ff8c00', cat: 'proxy', r: 6 },
    { lat: 31.5, lon: 34.5, label: 'GAZA', sub: 'Fasa 2', color: '#ff1744', cat: 'proxy', r: 5 },
    { lat: 24.7, lon: 46.7, label: 'RIYADH', sub: 'OPEC+', color: '#00e676', cat: 'naval', r: 6 },
    { lat: 33.1, lon: 44.3, label: 'FORDOW', sub: '☢ 84% Enrichment', color: '#b966ff', cat: 'nuclear', r: 8 },
    { lat: 36.9, lon: 35.5, label: 'INCIRLIK', sub: 'NATO AB', color: '#00d4ff', cat: 'airbase', r: 5 },
    { lat: 26.0, lon: 50.5, label: 'BAHRAIN', sub: 'US NAVCENT', color: '#00d4ff', cat: 'naval', r: 6 },
];

let mapLayerGroups = {};

function initMap() {
    if (leafletMap || typeof L === 'undefined') return;

    // Reset container to accept Leaflet
    const container = document.getElementById('satellite-map');
    container.innerHTML = '';

    // Default view zoomed out on Middle East
    leafletMap = L.map('satellite-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([30.0, 48.0], 4.5);

    // Realistic Esri Satellite Layer (Highly detailed Google-Earth like)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
    }).addTo(leafletMap);

    // Initialize layer groups for categories
    const categories = ['naval', 'airbase', 'missile', 'proxy', 'nuclear'];
    categories.forEach(cat => {
        mapLayerGroups[cat] = L.layerGroup().addTo(leafletMap);
    });

    // Add Custom Dark Overlay to dim the satellite map slightly for tactical feel
    const overlay = L.rectangle([[-90, -180], [90, 180]], {
        color: '#06101a',
        fillColor: '#06101a',
        fillOpacity: 0.35,
        weight: 0,
        interactive: false
    }).addTo(leafletMap);

    // Add Markers
    MAP_LOCATIONS.forEach(loc => {
        const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: loc.r,
            fillColor: loc.color,
            color: '#fff',
            weight: 1.5,
            opacity: 0.8,
            fillOpacity: 0.7
        });

        // Add glow effect using a second larger circle
        const glow = L.circleMarker([loc.lat, loc.lon], {
            radius: loc.r + 8,
            fillColor: loc.color,
            color: 'transparent',
            fillOpacity: 0.2,
            className: 'pulse-marker-svg'
        });

        const tooltipContent = `<div style="font-family:'Share Tech Mono';text-align:center;">
            <div style="color:${loc.color};font-weight:bold;font-size:12px;margin-bottom:2px;text-shadow:0 0 5px #000;">${loc.label}</div>
            <div style="color:#e0e0e0;font-size:10px;text-shadow:0 0 5px #000;">${loc.sub}</div>
        </div>`;

        marker.bindTooltip(tooltipContent, {
            permanent: true,
            direction: 'right',
            className: 'custom-map-tooltip',
            offset: [loc.r + 5, 0]
        });

        // Add both to the category layer group
        glow.addTo(mapLayerGroups[loc.cat]);
        marker.addTo(mapLayerGroups[loc.cat]);
    });

    // Add CSS for custom tooltip to remove default white background
    if (!document.getElementById('leaflet-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'leaflet-custom-styles';
        style.innerHTML = `
            .custom-map-tooltip {
                background: rgba(10, 20, 30, 0.7) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
                box-shadow: 0 0 10px rgba(0,0,0,0.8) !important;
                border-radius: 4px !important;
                padding: 4px 8px !important;
                backdrop-filter: blur(4px);
            }
            .leaflet-tooltip-right.custom-map-tooltip::before {
                border-right-color: rgba(10, 20, 30, 0.85) !important;
            }
            .route-label {
                background: transparent !important;
                border: none !important;
                box-shadow: none !important;
                color: #00d4ff !important;
                font-family: 'Share Tech Mono' !important;
                font-size: 10px !important;
                font-weight: bold !important;
                text-shadow: 0 0 4px #000 !important;
            }
            .leaflet-tooltip.route-label::before { display: none; }
            .pulse-marker-svg {
                transform-origin: center;
                animation: svgPulse 2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
            }
            @keyframes svgPulse {
                0% { opacity: 0.8; stroke-width: 10px; stroke: currentColor; }
                100% { opacity: 0; stroke-width: 40px; stroke: currentColor; }
            }
        `;
        document.head.appendChild(style);
    }

    // Add USS Nimitz Route
    const routeHtml = `USS NIMITZ CBG`;
    const routeLine = L.polyline([
        [24, 58.5], [26, 57.2], [27.2, 56.3]
    ], {
        color: '#00d4ff',
        weight: 2,
        dashArray: '6, 6',
        opacity: 0.9
    }).bindTooltip(routeHtml, { permanent: true, direction: 'center', className: 'route-label' }).addTo(leafletMap);
}

function toggleLayer(cat) {
    const btn = event.currentTarget;
    const isActive = btn.classList.contains('active');

    if (!leafletMap || !mapLayerGroups[cat]) return;

    if (isActive) {
        btn.classList.remove('active');
        leafletMap.removeLayer(mapLayerGroups[cat]);
    } else {
        btn.classList.add('active');
        leafletMap.addLayer(mapLayerGroups[cat]);
    }
}

// ===== CHRONOLOGY OF ESCALATION =====
function renderChronology() {
    const html = ESCALATION_CHRONOLOGY.map(item => `
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
    document.getElementById('chronology-container').innerHTML = html;
}

// ===== ACH CHALLENGE =====
function toggleChallenge(id) {
    const box = document.getElementById('cb-' + id);
    if (box) box.classList.toggle('open');
}

// ===== RED PHONE ALERTS =====
function acknowledgeRedPhone() {
    document.getElementById('red-phone-modal').classList.add('hidden');
}

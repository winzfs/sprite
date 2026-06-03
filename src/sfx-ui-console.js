(() => {
  const STYLE_ID = 'sfxUiConsoleStyle';
  const MAX_TRIES = 40;
  let installed = false;
  let syncing = false;

  function $(id) { return document.getElementById(id); }
  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }
  function readValue(id, fallback) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return Number.isFinite(value) ? value : fallback;
  }
  function setValue(id, value) {
    const input = $(id);
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const strips = [
    { id: 'source', label: 'SOURCE', target: 'sfxStudioDepth', fallback: 0.78, hint: 'Layer' },
    { id: 'body', label: 'BODY', target: 'sfxStudioBody', fallback: 0.46, hint: 'Weight' },
    { id: 'tone', label: 'TONE', target: 'sfxStudioShine', fallback: 0.52, hint: 'Shine' },
    { id: 'space', label: 'SPACE', target: 'sfxStudioWidth', fallback: 0.58, hint: 'Width' },
    { id: 'tail', label: 'TAIL', target: 'sfxStudioTail', fallback: 0.34, hint: 'Decay' },
    { id: 'level', label: 'LEVEL', target: 'sfxVolume', fallback: 0.55, hint: 'Gain' },
  ];

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-sfxMaker.sfx-console-view {
        --console-bg:#070b13;
        --console-panel:#101722;
        --console-panel-2:#151f2d;
        --console-line:rgba(148,163,184,.18);
        --console-text:#e5eefb;
        --console-dim:#8fa3bd;
        --console-blue:#22d3ee;
        --console-violet:#8b5cf6;
        background:
          radial-gradient(circle at 18% 0%, rgba(34,211,238,.11), transparent 30%),
          radial-gradient(circle at 84% 12%, rgba(139,92,246,.13), transparent 32%),
          linear-gradient(180deg,#050812,#0b111b 42%,#070b13);
        border-radius:30px;
        padding:12px;
      }
      #view-sfxMaker.sfx-console-view .sfx-app { max-width:1480px; margin:0 auto; }
      #view-sfxMaker.sfx-console-view .sfx-hero {
        background:
          linear-gradient(180deg,rgba(15,23,42,.94),rgba(3,7,18,.92)),
          radial-gradient(circle at 20% 10%,rgba(34,211,238,.24),transparent 38%);
        border:1px solid rgba(148,163,184,.2);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 22px 70px rgba(0,0,0,.34);
      }
      #view-sfxMaker.sfx-console-view .sfx-card {
        background:linear-gradient(180deg,var(--console-panel),#0b111b);
        border:1px solid var(--console-line);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 16px 42px rgba(0,0,0,.26);
        color:var(--console-text);
      }
      #view-sfxMaker.sfx-console-view .sfx-card-head {
        background:linear-gradient(180deg,#182235,#111827);
        border-bottom:1px solid var(--console-line);
      }
      #view-sfxMaker.sfx-console-view .sfx-card-title { color:#f8fafc; letter-spacing:.02em; }
      #view-sfxMaker.sfx-console-view .sfx-card-sub { color:var(--console-dim); }
      #view-sfxMaker.sfx-console-view .sfx-main-grid {
        grid-template-columns:minmax(280px,.72fr) minmax(360px,1.28fr);
        gap:12px;
        align-items:start;
      }
      #view-sfxMaker.sfx-console-view .sfx-card[style*="grid-column"] {
        background:linear-gradient(180deg,#0b111b,#070b13);
      }
      .sfx-console-board {
        margin:14px 0;
        border-radius:28px;
        padding:14px;
        background:
          linear-gradient(180deg,rgba(30,41,59,.92),rgba(2,6,23,.94)),
          repeating-linear-gradient(90deg,rgba(255,255,255,.025) 0 1px,transparent 1px 72px);
        border:1px solid rgba(148,163,184,.22);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 24px 72px rgba(0,0,0,.34);
      }
      .sfx-console-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:12px;
      }
      .sfx-console-title {
        color:#f8fafc;
        font-size:12px;
        font-weight:1000;
        letter-spacing:.14em;
        text-transform:uppercase;
      }
      .sfx-console-sub {
        margin-top:3px;
        color:#8fa3bd;
        font-size:11px;
      }
      .sfx-console-leds { display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
      .sfx-led {
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:7px 9px;
        border-radius:999px;
        color:#bfdbfe;
        background:rgba(15,23,42,.68);
        border:1px solid rgba(148,163,184,.18);
        font-size:10px;
        font-weight:950;
      }
      .sfx-led::before {
        content:'';
        width:7px;
        height:7px;
        border-radius:999px;
        background:#22c55e;
        box-shadow:0 0 14px rgba(34,197,94,.9);
      }
      .sfx-console-strips {
        display:grid;
        grid-template-columns:repeat(6,minmax(86px,1fr));
        gap:10px;
      }
      .sfx-channel-strip {
        position:relative;
        min-height:276px;
        border-radius:20px;
        padding:12px 10px;
        background:
          linear-gradient(180deg,rgba(30,41,59,.96),rgba(15,23,42,.98)),
          repeating-linear-gradient(180deg,transparent 0 20px,rgba(255,255,255,.018) 20px 21px);
        border:1px solid rgba(148,163,184,.17);
        box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 14px 30px rgba(0,0,0,.22);
        display:grid;
        grid-template-rows:auto auto 1fr auto auto;
        gap:9px;
        justify-items:center;
      }
      .sfx-strip-label {
        width:100%;
        text-align:center;
        padding:7px 4px;
        border-radius:12px;
        color:#e0f2fe;
        background:rgba(14,165,233,.12);
        border:1px solid rgba(14,165,233,.18);
        font-size:10px;
        font-weight:1000;
        letter-spacing:.08em;
      }
      .sfx-strip-hint { color:#8fa3bd; font-size:10px; font-weight:800; }
      .sfx-strip-meter {
        position:relative;
        width:8px;
        align-self:stretch;
        min-height:132px;
        border-radius:999px;
        background:linear-gradient(180deg,#22c55e 0 30%,#eab308 45% 65%,#ef4444 84% 100%);
        opacity:.82;
        box-shadow:0 0 18px rgba(34,211,238,.12);
      }
      .sfx-strip-meter::after {
        content:'';
        position:absolute;
        inset:8px 2px;
        border-radius:999px;
        background:rgba(2,6,23,.72);
      }
      .sfx-strip-fader {
        width:140px;
        max-width:140px;
        transform:rotate(-90deg);
        accent-color:#22d3ee;
        cursor:pointer;
      }
      .sfx-strip-value {
        min-width:48px;
        text-align:center;
        padding:6px 8px;
        border-radius:10px;
        color:#f8fafc;
        background:rgba(2,6,23,.58);
        border:1px solid rgba(148,163,184,.14);
        font-size:11px;
        font-weight:950;
        font-variant-numeric:tabular-nums;
      }
      .sfx-console-mini-actions {
        display:flex;
        gap:8px;
        margin-top:12px;
        flex-wrap:wrap;
      }
      .sfx-console-action {
        border:0;
        border-radius:999px;
        padding:9px 12px;
        color:#dbeafe;
        background:rgba(14,165,233,.13);
        border:1px solid rgba(14,165,233,.18);
        font-size:11px;
        font-weight:950;
        cursor:pointer;
      }
      #view-sfxMaker.sfx-console-view .sfx-control {
        border-radius:16px;
        background:linear-gradient(180deg,#111827,#0b111b);
        border:1px solid rgba(148,163,184,.14);
      }
      #view-sfxMaker.sfx-console-view .sfx-control label { color:#dbeafe; }
      #view-sfxMaker.sfx-console-view .sfx-control input,
      #view-sfxMaker.sfx-console-view .sfx-control select {
        color:#e5eefb;
        background:#070b13;
        border-color:rgba(148,163,184,.16);
      }
      #view-sfxMaker.sfx-console-view .sfx-studio-tab,
      #view-sfxMaker.sfx-console-view .sfx-category-chip,
      #view-sfxMaker.sfx-console-view .sfx-browser-toggle,
      #view-sfxMaker.sfx-console-view .sfx-quick-jump button {
        background:#182235;
        color:#cbd5e1;
        border:1px solid rgba(148,163,184,.12);
      }
      #view-sfxMaker.sfx-console-view .sfx-studio-tab.active,
      #view-sfxMaker.sfx-console-view .sfx-category-chip.active,
      #view-sfxMaker.sfx-console-view .sfx-browser-toggle.active {
        color:#fff;
        background:linear-gradient(135deg,#0891b2,#4f46e5);
      }
      #view-sfxMaker.sfx-console-view .sfx-preset {
        background:linear-gradient(180deg,#151f2d,#0f172a);
        border:1px solid rgba(148,163,184,.14);
        color:#e5eefb;
      }
      #view-sfxMaker.sfx-console-view .sfx-preset-name { color:#f8fafc; }
      #view-sfxMaker.sfx-console-view .sfx-preset-desc { color:#94a3b8; }
      #view-sfxMaker.sfx-console-view .sfx-preset-tag { background:rgba(15,23,42,.72); color:#cbd5e1; }
      #view-sfxMaker.sfx-console-view .sfx-search-wrap,
      #view-sfxMaker.sfx-console-view .sfx-inspector-item,
      #view-sfxMaker.sfx-console-view .sfx-studio-status,
      #view-sfxMaker.sfx-console-view .sfx-studio-tip,
      #view-sfxMaker.sfx-console-view .sfx-macro-card {
        background:linear-gradient(180deg,#151f2d,#0f172a);
        border-color:rgba(148,163,184,.14);
        color:#cbd5e1;
      }
      #view-sfxMaker.sfx-console-view .sfx-search-wrap input,
      #view-sfxMaker.sfx-console-view .sfx-inspector-item strong,
      #view-sfxMaker.sfx-console-view .sfx-studio-tip b,
      #view-sfxMaker.sfx-console-view .sfx-studio-status strong {
        color:#f8fafc;
      }
      #view-sfxMaker.sfx-console-view .sfx-floating-player {
        border-radius:18px;
        background:linear-gradient(180deg,rgba(15,23,42,.94),rgba(2,6,23,.94));
        border:1px solid rgba(148,163,184,.2);
        box-shadow:0 22px 64px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.06);
      }
      @media (max-width:1100px) {
        .sfx-console-strips { grid-template-columns:repeat(3,minmax(92px,1fr)); }
      }
      @media (max-width:640px) {
        #view-sfxMaker.sfx-console-view { padding:8px; }
        .sfx-console-board { padding:11px; border-radius:22px; }
        .sfx-console-header { align-items:flex-start; flex-direction:column; }
        .sfx-console-leds { justify-content:flex-start; }
        .sfx-console-strips { grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .sfx-channel-strip { min-height:230px; padding:10px 8px; }
        .sfx-strip-fader { width:112px; }
      }
    `;
    document.head.append(style);
  }

  function createStrip(strip) {
    const value = readValue(strip.target, strip.fallback);
    return el(`<div class="sfx-channel-strip" data-console-strip="${strip.id}">
      <div class="sfx-strip-label">${strip.label}</div>
      <div class="sfx-strip-hint">${strip.hint}</div>
      <div class="sfx-strip-meter"></div>
      <input id="sfxConsole_${strip.id}" class="sfx-strip-fader" type="range" min="0" max="1" step="0.01" value="${value}">
      <div id="sfxConsole_${strip.id}Out" class="sfx-strip-value">${value.toFixed(2)}</div>
    </div>`);
  }

  function addConsoleBoard() {
    if ($('sfxConsoleBoard')) return;
    const hero = document.querySelector('#view-sfxMaker .sfx-hero');
    if (!hero) return;
    const board = el(`<section id="sfxConsoleBoard" class="sfx-console-board">
      <div class="sfx-console-header">
        <div>
          <div class="sfx-console-title">Mixer Console</div>
          <div class="sfx-console-sub">페이더로 큰 방향을 잡고, 하단 트랜스포트에서 바로 미리듣기하세요.</div>
        </div>
        <div class="sfx-console-leds">
          <span class="sfx-led">UI READY</span>
          <span class="sfx-led">ENGINE SAFE</span>
          <span class="sfx-led">CLICK RENDER</span>
        </div>
      </div>
      <div id="sfxConsoleStrips" class="sfx-console-strips"></div>
      <div class="sfx-console-mini-actions">
        <button type="button" class="sfx-console-action" data-console-action="preview">▶ Console Preview</button>
        <button type="button" class="sfx-console-action" data-console-action="random">🎲 Random Patch</button>
        <button type="button" class="sfx-console-action" data-console-action="download">⬇ Export WAV</button>
      </div>
    </section>`);
    const stripWrap = board.querySelector('#sfxConsoleStrips');
    strips.forEach((strip) => stripWrap.append(createStrip(strip)));
    hero.after(board);
  }

  function syncFromTargets() {
    if (syncing) return;
    syncing = true;
    strips.forEach((strip) => {
      const fader = $(`sfxConsole_${strip.id}`);
      const output = $(`sfxConsole_${strip.id}Out`);
      const value = readValue(strip.target, strip.fallback);
      if (fader) fader.value = String(value);
      if (output) output.textContent = value.toFixed(2);
    });
    syncing = false;
  }

  function bindConsole() {
    if (document.body.dataset.sfxConsoleBound === 'true') return;
    document.body.dataset.sfxConsoleBound = 'true';
    strips.forEach((strip) => {
      const fader = $(`sfxConsole_${strip.id}`);
      fader?.addEventListener('input', () => {
        if (syncing) return;
        const value = Number.parseFloat(fader.value || '0');
        setValue(strip.target, value.toFixed(2));
        const output = $(`sfxConsole_${strip.id}Out`);
        if (output) output.textContent = value.toFixed(2);
      });
    });
    strips.forEach((strip) => {
      $(strip.target)?.addEventListener('input', syncFromTargets);
      $(strip.target)?.addEventListener('change', syncFromTargets);
    });
    $('sfxConsoleBoard')?.addEventListener('click', (event) => {
      const action = event.target?.closest?.('[data-console-action]')?.dataset.consoleAction;
      if (action === 'preview') $('sfxPreviewButton')?.click();
      if (action === 'random') $('sfxRandomButton')?.click();
      if (action === 'download') $('sfxDownloadLink')?.click();
    });
  }

  function installOnce() {
    if (installed) return true;
    if (!$('view-sfxMaker') || !$('sfxStudioTabs') || !$('sfxPreviewButton')) return false;
    installed = true;
    try {
      $('view-sfxMaker')?.classList.add('sfx-console-view');
      ensureStyle();
      addConsoleBoard();
      bindConsole();
      syncFromTargets();
    } catch (error) {
      installed = false;
      console.error('[sfx-ui-console] init failed', error);
    }
    return installed;
  }

  function waitForUi(tries = 0) {
    if (installOnce()) return;
    if (tries >= MAX_TRIES) {
      console.warn('[sfx-ui-console] studio UI not ready; skipped');
      return;
    }
    window.setTimeout(() => waitForUi(tries + 1), 50);
  }

  window.addEventListener('sfx:studio-ui-ready', () => waitForUi());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForUi());
  else waitForUi();
})();
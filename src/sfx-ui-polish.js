(() => {
  const STYLE_ID = 'sfxUiPolishStyle';
  const MAX_TRIES = 40;
  let installed = false;

  function $(id) { return document.getElementById(id); }
  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }
  function setValue(id, value) {
    const input = $(id);
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function getValue(id, fallback) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-sfxMaker.sfx-studio-view { --studio-accent:#06b6d4; --studio-violet:#7c3aed; --studio-bg:#020617; padding-bottom:112px; }
      #view-sfxMaker.sfx-studio-view .sfx-hero { overflow:hidden; border:1px solid rgba(255,255,255,.12); box-shadow:0 24px 80px rgba(2,6,23,.28); }
      #view-sfxMaker.sfx-studio-view .sfx-hero::before { content:''; position:absolute; inset:-40% -10% auto auto; width:320px; height:320px; border-radius:50%; background:radial-gradient(circle,rgba(34,211,238,.28),transparent 66%); pointer-events:none; }
      #view-sfxMaker.sfx-studio-view .sfx-kicker { display:inline-flex; align-items:center; gap:8px; padding:7px 10px; border-radius:999px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.13); backdrop-filter:blur(10px); }
      #view-sfxMaker.sfx-studio-view .sfx-kicker::after { content:'PRO STUDIO'; font-size:10px; letter-spacing:.08em; opacity:.75; }
      #view-sfxMaker.sfx-studio-view .sfx-transport { padding:8px; border-radius:22px; background:rgba(2,6,23,.22); border:1px solid rgba(255,255,255,.12); backdrop-filter:blur(14px); }
      #view-sfxMaker.sfx-studio-view .sfx-big-button { box-shadow:0 10px 24px rgba(0,0,0,.16); }
      #view-sfxMaker.sfx-studio-view #sfxPreviewButton { background:linear-gradient(135deg,#06b6d4,#4f46e5,#9333ea); color:#fff; }
      #view-sfxMaker.sfx-studio-view #sfxDownloadLink { background:linear-gradient(135deg,#0891b2,#4f46e5,#a855f7); color:#fff; }
      .sfx-studio-console { align-items:stretch; }
      .sfx-studio-chip { position:relative; overflow:hidden; }
      .sfx-studio-chip::after { content:''; position:absolute; inset:auto 10px 8px 10px; height:2px; border-radius:999px; background:linear-gradient(90deg,#22d3ee,#a78bfa); opacity:.62; }
      .sfx-macro-deck { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; margin:12px 0 14px; }
      .sfx-macro-card { border:1px solid rgba(15,23,42,.1); border-radius:20px; padding:12px; background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.92)); box-shadow:0 12px 28px rgba(15,23,42,.08); }
      .sfx-macro-card label { display:flex; justify-content:space-between; gap:8px; font-size:11px; font-weight:950; color:#334155; text-transform:uppercase; letter-spacing:.04em; }
      .sfx-macro-card output { color:#4f46e5; }
      .sfx-macro-card input { width:100%; margin-top:10px; accent-color:#06b6d4; }
      .sfx-macro-hint { font-size:10px; color:#64748b; margin-top:7px; line-height:1.35; }
      .sfx-category-bar { display:flex; gap:8px; overflow-x:auto; padding:0 2px 12px; margin-top:-4px; }
      .sfx-category-chip { border:0; border-radius:999px; padding:9px 12px; font-size:11px; font-weight:950; white-space:nowrap; color:#334155; background:#e2e8f0; cursor:pointer; }
      .sfx-category-chip.active { color:#fff; background:linear-gradient(135deg,#06b6d4,#4f46e5); box-shadow:0 10px 22px rgba(79,70,229,.22); }
      #view-sfxMaker.sfx-studio-view .sfx-preset { border-radius:18px; transition:transform .14s ease, box-shadow .14s ease, opacity .14s ease; }
      #view-sfxMaker.sfx-studio-view .sfx-preset:hover { transform:translateY(-2px); }
      #view-sfxMaker.sfx-studio-view .sfx-preset[hidden] { display:none !important; }
      #view-sfxMaker.sfx-studio-view .sfx-card-head { background:linear-gradient(180deg,rgba(248,250,252,.98),rgba(255,255,255,.86)); border-bottom:1px solid rgba(15,23,42,.06); }
      #view-sfxMaker.sfx-studio-view .sfx-screen { border-radius:20px; background:radial-gradient(circle at 18% 10%,rgba(6,182,212,.16),transparent 32%),linear-gradient(180deg,#020617,#0f172a); border:1px solid rgba(148,163,184,.22); box-shadow:inset 0 1px 0 rgba(255,255,255,.08); }
      #view-sfxMaker.sfx-studio-view .sfx-readout { gap:8px; }
      #view-sfxMaker.sfx-studio-view .sfx-meter { border-radius:16px; background:rgba(15,23,42,.05); border:1px solid rgba(15,23,42,.06); }
      .sfx-studio-workflow { display:grid; grid-template-columns:1.1fr .9fr; gap:12px; margin-bottom:12px; }
      .sfx-studio-tip { border-radius:18px; padding:13px 14px; background:linear-gradient(135deg,rgba(14,165,233,.09),rgba(168,85,247,.08)); border:1px solid rgba(14,165,233,.18); font-size:12px; color:#475569; line-height:1.45; }
      .sfx-studio-tip b { color:#0f172a; }
      .sfx-studio-status { border-radius:18px; padding:13px 14px; background:#f8fafc; border:1px solid rgba(15,23,42,.08); font-size:12px; color:#475569; line-height:1.45; }
      .sfx-studio-status strong { color:#0f172a; }
      .sfx-floating-player { position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:80; width:min(720px,calc(100vw - 24px)); border-radius:26px; padding:10px; background:rgba(2,6,23,.82); border:1px solid rgba(255,255,255,.14); box-shadow:0 24px 70px rgba(2,6,23,.45); backdrop-filter:blur(20px); color:#fff; display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; }
      .sfx-floating-meta { min-width:0; padding-left:8px; }
      .sfx-floating-title { font-size:12px; font-weight:950; letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .sfx-floating-sub { margin-top:3px; font-size:10px; color:rgba(255,255,255,.62); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .sfx-floating-actions { display:flex; gap:8px; align-items:center; }
      .sfx-float-btn { border:0; border-radius:16px; min-width:46px; height:44px; padding:0 13px; font-weight:950; color:#e5e7eb; background:rgba(255,255,255,.1); cursor:pointer; }
      .sfx-float-btn.primary { min-width:92px; color:#fff; background:linear-gradient(135deg,#06b6d4,#4f46e5,#9333ea); box-shadow:0 10px 26px rgba(79,70,229,.34); }
      .sfx-float-btn.download { color:#fff; background:linear-gradient(135deg,#0891b2,#7c3aed); }
      .sfx-float-btn:active { transform:translateY(1px) scale(.99); }
      .sfx-floating-toggle { position:fixed; right:16px; bottom:18px; z-index:81; border:0; border-radius:999px; width:46px; height:46px; color:#fff; background:rgba(15,23,42,.8); border:1px solid rgba(255,255,255,.14); box-shadow:0 14px 34px rgba(2,6,23,.36); backdrop-filter:blur(16px); cursor:pointer; display:none; }
      .sfx-floating-player.collapsed { display:none; }
      .sfx-floating-toggle.visible { display:block; }
      .sfx-quick-jump { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 0; }
      .sfx-quick-jump button { border:0; border-radius:999px; padding:8px 10px; font-size:11px; font-weight:900; color:#334155; background:#e0f2fe; cursor:pointer; }
      @media (max-width:980px) { .sfx-macro-deck { grid-template-columns:repeat(3,minmax(0,1fr)); } .sfx-studio-workflow { grid-template-columns:1fr; } }
      @media (max-width:640px) { #view-sfxMaker.sfx-studio-view { padding-bottom:140px; } .sfx-macro-deck { grid-template-columns:1fr; } .sfx-category-bar { margin-left:-2px; margin-right:-2px; } #view-sfxMaker.sfx-studio-view .sfx-transport { background:transparent; border:0; padding:0; } .sfx-floating-player { grid-template-columns:1fr; gap:8px; bottom:10px; border-radius:22px; } .sfx-floating-actions { display:grid; grid-template-columns:1.2fr .8fr .8fr .8fr; } .sfx-float-btn { min-width:0; width:100%; } .sfx-floating-toggle { right:10px; bottom:10px; } }
      @media (prefers-color-scheme: dark) {
        .sfx-macro-card { background:linear-gradient(180deg,rgba(31,41,55,.96),rgba(17,24,39,.94)); border-color:rgba(255,255,255,.08); box-shadow:0 14px 32px rgba(0,0,0,.24); }
        .sfx-macro-card label { color:#e5e7eb; } .sfx-macro-hint { color:#9ca3af; }
        .sfx-category-chip { color:#d1d5db; background:#374151; }
        .sfx-studio-tip { color:#d1d5db; background:linear-gradient(135deg,rgba(14,165,233,.13),rgba(168,85,247,.12)); border-color:rgba(14,165,233,.28); }
        .sfx-studio-tip b, .sfx-studio-status strong { color:#f8fafc; }
        .sfx-studio-status { color:#d1d5db; background:#111827; border-color:rgba(255,255,255,.08); }
        .sfx-quick-jump button { color:#e0f2fe; background:#164e63; }
      }
    `;
    document.head.append(style);
  }

  function macroCard(id, label, value, hint) {
    return el(`<div class="sfx-macro-card"><label>${label}<output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="0" max="1" step="0.01" value="${value}"><div class="sfx-macro-hint">${hint}</div></div>`);
  }

  function addMacroDeck() {
    const basicPanel = document.querySelector('[data-panel="basic"]');
    if (!basicPanel || $('sfxMacroDeck')) return;
    const deck = el('<div id="sfxMacroDeck" class="sfx-macro-deck"></div>');
    deck.append(
      macroCard('sfxMacroCharacter', 'Character', '0.68', 'Clean ↔ Rich'),
      macroCard('sfxMacroImpact', 'Impact', '0.45', 'Soft ↔ Punchy'),
      macroCard('sfxMacroSpace', 'Space', '0.42', 'Dry ↔ Wide'),
      macroCard('sfxMacroTone', 'Tone', '0.58', 'Dark ↔ Bright'),
      macroCard('sfxMacroTail', 'Tail', '0.30', 'Short ↔ Long')
    );
    basicPanel.prepend(deck);
  }

  function applyMacroValues() {
    const character = getValue('sfxMacroCharacter', 0.68);
    const impact = getValue('sfxMacroImpact', 0.45);
    const space = getValue('sfxMacroSpace', 0.42);
    const tone = getValue('sfxMacroTone', 0.58);
    const tail = getValue('sfxMacroTail', 0.3);
    setValue('sfxStudioDepth', (0.28 + character * 0.72).toFixed(2));
    setValue('sfxStudioBody', (0.18 + impact * 0.78).toFixed(2));
    setValue('sfxStudioShine', (0.18 + tone * 0.8).toFixed(2));
    setValue('sfxStudioWidth', (0.12 + space * 0.84).toFixed(2));
    setValue('sfxStudioTail', (tail * 0.78).toFixed(2));
    setValue('sfxReverb', (tail * 0.48).toFixed(2));
    setValue('sfxBrightness', (0.18 + tone * 0.82).toFixed(2));
    setValue('sfxPunch', (0.1 + impact * 0.9).toFixed(2));
    updateMacroOutputs();
    updateFloatingMeta();
  }

  function updateMacroOutputs() {
    ['sfxMacroCharacter','sfxMacroImpact','sfxMacroSpace','sfxMacroTone','sfxMacroTail'].forEach((id) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (input && output) output.textContent = Number.parseFloat(input.value).toFixed(2);
    });
  }

  function classifyPreset(button) {
    const text = (button.textContent || '').toLowerCase();
    if (/click|confirm|cancel|menu|typing|ui/.test(text)) return 'ui';
    if (/coin|jump|pickup|item|power|heal/.test(text)) return 'game';
    if (/hit|impact|explosion|warning|fail|land/.test(text)) return 'combat';
    if (/magic|portal|glass|bell|crystal|chime/.test(text)) return 'magic';
    if (/whoosh|sweep|air|laser|zap|glitch/.test(text)) return 'motion';
    return 'ui';
  }

  function addCategoryFilters() {
    const presetGrid = document.querySelector('#view-sfxMaker .sfx-preset-grid');
    if (!presetGrid || $('sfxCategoryBar')) return;
    const bar = el('<div id="sfxCategoryBar" class="sfx-category-bar"></div>');
    const categories = [
      ['all', 'All'], ['ui', 'UI'], ['game', 'Game'], ['combat', 'Combat'], ['magic', 'Magic'], ['motion', 'Motion']
    ];
    categories.forEach(([value, label], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `sfx-category-chip${index === 0 ? ' active' : ''}`;
      button.dataset.category = value;
      button.textContent = label;
      bar.append(button);
    });
    presetGrid.parentElement?.insertBefore(bar, presetGrid);
    Array.from(presetGrid.querySelectorAll('.sfx-preset')).forEach((button) => {
      button.dataset.category = classifyPreset(button);
    });
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('.sfx-category-chip');
      if (!button) return;
      const category = button.dataset.category;
      bar.querySelectorAll('.sfx-category-chip').forEach((item) => item.classList.toggle('active', item === button));
      presetGrid.querySelectorAll('.sfx-preset').forEach((preset) => {
        preset.hidden = category !== 'all' && preset.dataset.category !== category;
      });
    });
  }

  function addWorkflowPanel() {
    const texturePanel = document.querySelector('[data-panel="texture"]');
    if (!texturePanel || $('sfxWorkflowPanel')) return;
    const panel = el(`<div id="sfxWorkflowPanel" class="sfx-studio-workflow">
      <div class="sfx-studio-tip"><b>Workflow</b><br>1. 프리셋 또는 파형을 고르고 2. 기본 탭의 매크로 5개로 큰 방향을 잡은 뒤 3. 질감/공간 탭에서 세부 값을 보정하세요.</div>
      <div class="sfx-studio-status"><strong>Safe Render</strong><br>옵션 변경은 렌더링하지 않습니다. 소리는 <b>미리듣기</b> 버튼을 누를 때만 새로 생성됩니다.</div>
    </div>`);
    texturePanel.prepend(panel);
  }

  function addQuickJumps() {
    const basicPanel = document.querySelector('[data-panel="basic"]');
    if (!basicPanel || $('sfxQuickJump')) return;
    const jump = el(`<div id="sfxQuickJump" class="sfx-quick-jump">
      <button type="button" data-jump-tab="basic">매크로</button>
      <button type="button" data-jump-tab="texture">소스/질감</button>
      <button type="button" data-jump-tab="space">공간감</button>
      <button type="button" data-jump-tab="advanced">고급값</button>
    </div>`);
    basicPanel.insertBefore(jump, $('sfxMacroDeck')?.nextSibling || basicPanel.firstChild);
    jump.addEventListener('click', (event) => {
      const button = event.target.closest('[data-jump-tab]');
      if (!button) return;
      document.querySelector(`.sfx-studio-tab[data-tab="${button.dataset.jumpTab}"]`)?.click();
    });
  }

  function addFloatingPlayer() {
    if ($('sfxFloatingPlayer')) return;
    const player = el(`<div id="sfxFloatingPlayer" class="sfx-floating-player">
      <div class="sfx-floating-meta">
        <div id="sfxFloatingTitle" class="sfx-floating-title">SFX Studio</div>
        <div id="sfxFloatingSub" class="sfx-floating-sub">설정을 고른 뒤 미리듣기를 눌러 렌더링</div>
      </div>
      <div class="sfx-floating-actions">
        <button id="sfxFloatPreview" type="button" class="sfx-float-btn primary">▶ 미리듣기</button>
        <button id="sfxFloatStop" type="button" class="sfx-float-btn">■</button>
        <button id="sfxFloatRandom" type="button" class="sfx-float-btn">🎲</button>
        <button id="sfxFloatDownload" type="button" class="sfx-float-btn download">⬇</button>
        <button id="sfxFloatCollapse" type="button" class="sfx-float-btn">⌄</button>
      </div>
    </div>`);
    const toggle = el('<button id="sfxFloatingToggle" class="sfx-floating-toggle" type="button">▶</button>');
    document.body.append(player, toggle);
    $('sfxFloatPreview')?.addEventListener('click', () => $('sfxPreviewButton')?.click());
    $('sfxFloatStop')?.addEventListener('click', () => $('sfxStopButton')?.click());
    $('sfxFloatRandom')?.addEventListener('click', () => $('sfxRandomButton')?.click());
    $('sfxFloatDownload')?.addEventListener('click', () => $('sfxDownloadLink')?.click());
    $('sfxFloatCollapse')?.addEventListener('click', () => {
      player.classList.add('collapsed');
      toggle.classList.add('visible');
    });
    toggle.addEventListener('click', () => {
      player.classList.remove('collapsed');
      toggle.classList.remove('visible');
    });
    updateFloatingMeta();
  }

  function updateFloatingMeta() {
    const wave = $('sfxWave')?.selectedOptions?.[0]?.textContent || $('sfxWave')?.value || 'Wave';
    const engine = $('sfxStudioEngine')?.selectedOptions?.[0]?.textContent || 'Engine';
    const texture = $('sfxStudioTexture')?.selectedOptions?.[0]?.textContent || 'Texture';
    const title = $('sfxNameInput')?.value || 'SFX Studio';
    const status = $('sfxStatus')?.textContent || '미리듣기를 눌러 렌더링';
    if ($('sfxFloatingTitle')) $('sfxFloatingTitle').textContent = `${title} · ${wave}`;
    if ($('sfxFloatingSub')) $('sfxFloatingSub').textContent = `${engine} / ${texture} · ${status}`;
  }

  function bindMetaUpdates() {
    if (document.body.dataset.sfxFloatingMetaBound === 'true') return;
    document.body.dataset.sfxFloatingMetaBound = 'true';
    ['sfxWave','sfxStudioEngine','sfxStudioTexture','sfxNameInput','sfxDuration','sfxVolume'].forEach((id) => {
      $(id)?.addEventListener('input', updateFloatingMeta);
      $(id)?.addEventListener('change', updateFloatingMeta);
    });
    ['sfxPreviewButton','sfxRandomButton'].forEach((id) => {
      $(id)?.addEventListener('click', () => window.setTimeout(updateFloatingMeta, 80));
    });
  }

  function bindMacros() {
    if (document.body.dataset.sfxPolishMacrosBound === 'true') return;
    document.body.dataset.sfxPolishMacrosBound = 'true';
    ['sfxMacroCharacter','sfxMacroImpact','sfxMacroSpace','sfxMacroTone','sfxMacroTail'].forEach((id) => {
      $(id)?.addEventListener('input', applyMacroValues);
      $(id)?.addEventListener('change', applyMacroValues);
    });
    updateMacroOutputs();
  }

  function installOnce() {
    if (installed) return true;
    if (!$('view-sfxMaker') || !$('sfxStudioTabs') || !$('sfxWave')) return false;
    installed = true;
    try {
      ensureStyle();
      addMacroDeck();
      addCategoryFilters();
      addWorkflowPanel();
      addQuickJumps();
      addFloatingPlayer();
      bindMacros();
      bindMetaUpdates();
    } catch (error) {
      installed = false;
      console.error('[sfx-ui-polish] init failed', error);
    }
    return installed;
  }

  function waitForUi(tries = 0) {
    if (installOnce()) return;
    if (tries >= MAX_TRIES) {
      console.warn('[sfx-ui-polish] studio UI not ready; skipped');
      return;
    }
    window.setTimeout(() => waitForUi(tries + 1), 50);
  }

  window.addEventListener('sfx:studio-ui-ready', () => waitForUi());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForUi());
  else waitForUi();
})();
(() => {
  const STYLE_ID = 'sfxUiProBrowserStyle';
  const MAX_TRIES = 40;
  const FAVORITES_KEY = 'sfxStudioFavoritePresets';
  let installed = false;

  function $(id) { return document.getElementById(id); }
  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function getFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveFavorites(favorites) {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
    } catch (error) {}
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sfx-project-bar {
        display:grid;
        grid-template-columns:1fr auto;
        gap:12px;
        align-items:center;
        margin-top:14px;
        padding:12px;
        border-radius:22px;
        border:1px solid rgba(255,255,255,.13);
        background:rgba(2,6,23,.34);
        backdrop-filter:blur(16px);
      }
      .sfx-project-title { color:#fff; font-size:13px; font-weight:950; letter-spacing:.02em; }
      .sfx-project-sub { color:rgba(255,255,255,.62); font-size:11px; margin-top:3px; }
      .sfx-project-chain { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
      .sfx-chain-pill {
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:7px 9px;
        border-radius:999px;
        color:#e0f2fe;
        background:rgba(14,165,233,.16);
        border:1px solid rgba(125,211,252,.18);
        font-size:10px;
        font-weight:950;
        white-space:nowrap;
      }
      .sfx-browser-tools {
        display:grid;
        grid-template-columns:1fr auto auto;
        gap:8px;
        margin-bottom:12px;
        align-items:center;
      }
      .sfx-search-wrap {
        display:flex;
        align-items:center;
        gap:8px;
        border-radius:16px;
        padding:9px 11px;
        background:#f8fafc;
        border:1px solid rgba(15,23,42,.08);
      }
      .sfx-search-wrap span { font-size:13px; opacity:.68; }
      .sfx-search-wrap input {
        width:100%;
        border:0;
        outline:0;
        background:transparent;
        color:#0f172a;
        font-size:13px;
        font-weight:750;
      }
      .sfx-browser-toggle {
        border:0;
        border-radius:16px;
        padding:11px 12px;
        color:#334155;
        background:#e2e8f0;
        font-size:12px;
        font-weight:950;
        cursor:pointer;
        white-space:nowrap;
      }
      .sfx-browser-toggle.active {
        color:#fff;
        background:linear-gradient(135deg,#f59e0b,#ef4444);
        box-shadow:0 10px 22px rgba(239,68,68,.2);
      }
      .sfx-preset-meta {
        display:flex;
        gap:5px;
        flex-wrap:wrap;
        margin-top:8px;
      }
      .sfx-preset-tag {
        display:inline-flex;
        align-items:center;
        border-radius:999px;
        padding:4px 6px;
        font-size:9px;
        font-weight:950;
        letter-spacing:.02em;
        color:#475569;
        background:rgba(226,232,240,.88);
      }
      .sfx-preset-favorite {
        position:absolute;
        top:8px;
        right:8px;
        width:28px;
        height:28px;
        border:0;
        border-radius:999px;
        color:#64748b;
        background:rgba(255,255,255,.82);
        box-shadow:0 8px 18px rgba(15,23,42,.12);
        cursor:pointer;
        z-index:2;
      }
      .sfx-preset-favorite.active { color:#f59e0b; background:#fffbeb; }
      #view-sfxMaker.sfx-studio-view .sfx-preset { position:relative; text-align:left; }
      #view-sfxMaker.sfx-studio-view .sfx-preset-name { padding-right:28px; }
      .sfx-inspector-panel {
        margin-top:12px;
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:8px;
      }
      .sfx-inspector-item {
        border-radius:16px;
        padding:10px;
        background:rgba(15,23,42,.045);
        border:1px solid rgba(15,23,42,.06);
      }
      .sfx-inspector-item small {
        display:block;
        color:#64748b;
        font-size:10px;
        font-weight:950;
        text-transform:uppercase;
        letter-spacing:.04em;
      }
      .sfx-inspector-item strong {
        display:block;
        margin-top:4px;
        color:#0f172a;
        font-size:12px;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }
      .sfx-section-label {
        grid-column:1/-1;
        display:flex;
        align-items:center;
        gap:8px;
        margin:4px 0 -2px;
        color:#64748b;
        font-size:11px;
        font-weight:950;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      .sfx-section-label::after {
        content:'';
        height:1px;
        flex:1;
        background:linear-gradient(90deg,rgba(100,116,139,.26),transparent);
      }
      .sfx-floating-player {
        grid-template-columns:minmax(0,1fr) auto;
      }
      .sfx-floating-actions { white-space:nowrap; }
      .sfx-floating-title::before { content:'● '; color:#22c55e; }
      .sfx-card.sfx-focus-card {
        outline:2px solid rgba(6,182,212,.26);
        box-shadow:0 18px 48px rgba(6,182,212,.1);
      }
      @media (max-width:840px) {
        .sfx-project-bar { grid-template-columns:1fr; }
        .sfx-project-chain { justify-content:flex-start; }
        .sfx-browser-tools { grid-template-columns:1fr; }
        .sfx-inspector-panel { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width:560px) {
        .sfx-inspector-panel { grid-template-columns:1fr; }
        .sfx-browser-toggle { width:100%; }
      }
      @media (prefers-color-scheme: dark) {
        .sfx-search-wrap { background:#111827; border-color:rgba(255,255,255,.08); }
        .sfx-search-wrap input { color:#f8fafc; }
        .sfx-browser-toggle { color:#d1d5db; background:#374151; }
        .sfx-preset-tag { color:#cbd5e1; background:rgba(51,65,85,.9); }
        .sfx-preset-favorite { color:#cbd5e1; background:rgba(15,23,42,.82); }
        .sfx-preset-favorite.active { color:#fbbf24; background:rgba(120,53,15,.75); }
        .sfx-inspector-item { background:rgba(255,255,255,.045); border-color:rgba(255,255,255,.08); }
        .sfx-inspector-item small { color:#94a3b8; }
        .sfx-inspector-item strong { color:#f8fafc; }
      }
    `;
    document.head.append(style);
  }

  function getCategoryLabel(category) {
    const map = { ui: 'UI', game: 'GAME', combat: 'COMBAT', magic: 'MAGIC', motion: 'MOTION' };
    return map[category] || 'SFX';
  }

  function inferTags(button) {
    const text = (button.textContent || '').toLowerCase();
    const tags = [];
    if (/click|menu|confirm|cancel|typing/.test(text)) tags.push('SHORT', 'CLEAN');
    if (/bell|glass|chime|crystal|magic|heal/.test(text)) tags.push('BRIGHT', 'SHINY');
    if (/hit|impact|explosion|thump|wood|fail/.test(text)) tags.push('PUNCHY', 'HEAVY');
    if (/whoosh|sweep|air|portal|zap|laser/.test(text)) tags.push('WIDE', 'MOTION');
    if (!tags.length) tags.push('READY', 'TWEAKABLE');
    return tags.slice(0, 3);
  }

  function addProjectBar() {
    const heroTop = document.querySelector('#view-sfxMaker .sfx-hero-top');
    if (!heroTop || $('sfxProjectBar')) return;
    const bar = el(`<div id="sfxProjectBar" class="sfx-project-bar">
      <div>
        <div class="sfx-project-title">Sound Design Console</div>
        <div id="sfxProjectSub" class="sfx-project-sub">프리셋 선택 → 매크로 조정 → 미리듣기 → WAV 출력</div>
      </div>
      <div class="sfx-project-chain">
        <span id="sfxChainWave" class="sfx-chain-pill">Wave</span>
        <span id="sfxChainEngine" class="sfx-chain-pill">Engine</span>
        <span id="sfxChainRender" class="sfx-chain-pill">Safe Render</span>
      </div>
    </div>`);
    heroTop.after(bar);
  }

  function addBrowserTools() {
    const presetGrid = $('sfxPresetGrid');
    if (!presetGrid || $('sfxBrowserTools')) return;
    const tools = el(`<div id="sfxBrowserTools" class="sfx-browser-tools">
      <label class="sfx-search-wrap"><span>⌕</span><input id="sfxPresetSearch" type="search" placeholder="프리셋 검색: click, hit, magic, whoosh..."></label>
      <button id="sfxFavoriteOnly" class="sfx-browser-toggle" type="button">⭐ 즐겨찾기</button>
      <button id="sfxCompactToggle" class="sfx-browser-toggle" type="button">Compact</button>
    </div>`);
    presetGrid.parentElement?.insertBefore(tools, presetGrid.parentElement.firstChild);
  }

  function enhancePresetCards() {
    const favorites = getFavorites();
    document.querySelectorAll('#sfxPresetGrid .sfx-preset').forEach((button) => {
      if (button.dataset.proEnhanced === 'true') return;
      const id = button.dataset.presetId || button.textContent.trim();
      const category = button.dataset.category || 'ui';
      button.dataset.proEnhanced = 'true';
      button.dataset.searchText = button.textContent.toLowerCase();
      const favorite = document.createElement('button');
      favorite.type = 'button';
      favorite.className = `sfx-preset-favorite${favorites.has(id) ? ' active' : ''}`;
      favorite.textContent = '★';
      favorite.title = '즐겨찾기';
      favorite.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const current = getFavorites();
        if (current.has(id)) current.delete(id);
        else current.add(id);
        saveFavorites(current);
        favorite.classList.toggle('active', current.has(id));
        applyFilters();
      });
      const meta = document.createElement('div');
      meta.className = 'sfx-preset-meta';
      const tags = [getCategoryLabel(category), ...inferTags(button)];
      meta.innerHTML = tags.map((tag) => `<span class="sfx-preset-tag">${tag}</span>`).join('');
      button.append(favorite, meta);
    });
  }

  function addInspector() {
    const waveWrap = document.querySelector('.sfx-wave-wrap');
    if (!waveWrap || $('sfxInspectorPanel')) return;
    const panel = el(`<div id="sfxInspectorPanel" class="sfx-inspector-panel">
      <div class="sfx-inspector-item"><small>Source</small><strong id="sfxInspectorSource">-</strong></div>
      <div class="sfx-inspector-item"><small>Shape</small><strong id="sfxInspectorShape">-</strong></div>
      <div class="sfx-inspector-item"><small>Space</small><strong id="sfxInspectorSpace">-</strong></div>
      <div class="sfx-inspector-item"><small>Output</small><strong id="sfxInspectorOutput">WAV</strong></div>
    </div>`);
    const status = $('sfxStatus');
    if (status) status.after(panel);
    else waveWrap.append(panel);
  }

  function addSectionLabels() {
    const panels = {
      basic: 'Macro Controls',
      texture: 'Source Design',
      space: 'Spatial / Master',
      advanced: 'Envelope / Modulation',
    };
    Object.entries(panels).forEach(([panelName, label]) => {
      const panel = document.querySelector(`[data-panel="${panelName}"]`);
      if (!panel || panel.querySelector('.sfx-section-label')) return;
      panel.prepend(el(`<div class="sfx-section-label">${label}</div>`));
    });
  }

  function activeCategory() {
    return document.querySelector('#sfxCategoryBar .sfx-category-chip.active')?.dataset.category || 'all';
  }

  function applyFilters() {
    const query = ($('sfxPresetSearch')?.value || '').trim().toLowerCase();
    const category = activeCategory();
    const favoriteOnly = $('sfxFavoriteOnly')?.classList.contains('active');
    const favorites = getFavorites();
    document.querySelectorAll('#sfxPresetGrid .sfx-preset').forEach((button) => {
      const id = button.dataset.presetId || button.textContent.trim();
      const categoryMatch = category === 'all' || button.dataset.category === category;
      const queryMatch = !query || (button.dataset.searchText || button.textContent.toLowerCase()).includes(query);
      const favoriteMatch = !favoriteOnly || favorites.has(id);
      button.hidden = !(categoryMatch && queryMatch && favoriteMatch);
    });
  }

  function updateProfessionalReadouts() {
    const wave = $('sfxWave')?.selectedOptions?.[0]?.textContent || $('sfxWave')?.value || '-';
    const engine = $('sfxStudioEngine')?.selectedOptions?.[0]?.textContent || '-';
    const texture = $('sfxStudioTexture')?.selectedOptions?.[0]?.textContent || '-';
    const duration = $('sfxDuration')?.value || '-';
    const width = $('sfxStudioWidth')?.value || '-';
    const tail = $('sfxStudioTail')?.value || '-';
    if ($('sfxChainWave')) $('sfxChainWave').textContent = wave;
    if ($('sfxChainEngine')) $('sfxChainEngine').textContent = engine;
    if ($('sfxChainRender')) $('sfxChainRender').textContent = 'Click-to-render';
    if ($('sfxInspectorSource')) $('sfxInspectorSource').textContent = `${wave} / ${engine}`;
    if ($('sfxInspectorShape')) $('sfxInspectorShape').textContent = `${texture} · ${duration}s`;
    if ($('sfxInspectorSpace')) $('sfxInspectorSpace').textContent = `Width ${width} · Tail ${tail}`;
    if ($('sfxProjectSub')) $('sfxProjectSub').textContent = `${$('sfxNameInput')?.value || 'sfx'} · ${texture} · 미리듣기 버튼으로 렌더링`;
  }

  function bind() {
    if (document.body.dataset.sfxProBrowserBound === 'true') return;
    document.body.dataset.sfxProBrowserBound = 'true';
    $('sfxPresetSearch')?.addEventListener('input', applyFilters);
    $('sfxFavoriteOnly')?.addEventListener('click', () => {
      $('sfxFavoriteOnly')?.classList.toggle('active');
      applyFilters();
    });
    $('sfxCompactToggle')?.addEventListener('click', () => {
      const compact = $('sfxCompactToggle')?.classList.toggle('active');
      document.querySelector('#view-sfxMaker')?.classList.toggle('sfx-compact-presets', Boolean(compact));
    });
    $('sfxCategoryBar')?.addEventListener('click', () => window.setTimeout(applyFilters, 0));
    ['sfxWave','sfxStudioEngine','sfxStudioTexture','sfxDuration','sfxStudioWidth','sfxStudioTail','sfxNameInput'].forEach((id) => {
      $(id)?.addEventListener('input', updateProfessionalReadouts);
      $(id)?.addEventListener('change', updateProfessionalReadouts);
    });
    document.querySelectorAll('#sfxPresetGrid .sfx-preset').forEach((button) => {
      button.addEventListener('click', () => window.setTimeout(() => {
        updateProfessionalReadouts();
        document.querySelectorAll('.sfx-focus-card').forEach((card) => card.classList.remove('sfx-focus-card'));
        document.querySelector('.sfx-wave-wrap')?.closest('.sfx-card')?.classList.add('sfx-focus-card');
        window.setTimeout(() => document.querySelector('.sfx-focus-card')?.classList.remove('sfx-focus-card'), 700);
      }, 40));
    });
  }

  function installOnce() {
    if (installed) return true;
    if (!$('view-sfxMaker') || !$('sfxPresetGrid') || !$('sfxStudioTabs')) return false;
    installed = true;
    try {
      ensureStyle();
      addProjectBar();
      addBrowserTools();
      enhancePresetCards();
      addInspector();
      addSectionLabels();
      bind();
      applyFilters();
      updateProfessionalReadouts();
    } catch (error) {
      installed = false;
      console.error('[sfx-ui-pro-browser] init failed', error);
    }
    return installed;
  }

  function waitForUi(tries = 0) {
    if (installOnce()) return;
    if (tries >= MAX_TRIES) {
      console.warn('[sfx-ui-pro-browser] studio UI not ready; skipped');
      return;
    }
    window.setTimeout(() => waitForUi(tries + 1), 50);
  }

  window.addEventListener('sfx:studio-ui-ready', () => waitForUi());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForUi());
  else waitForUi();
})();
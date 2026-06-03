(() => {
  const PANEL_ID = 'pixelArtFloatingControls';
  const TOGGLE_ID = 'pixelArtFloatingToggle';
  const STYLE_ID = 'pixelArtFloatingControlsStyle';

  const controls = [
    { id: 'pixelArtWidth', label: '너비', type: 'number' },
    { id: 'pixelArtHeight', label: '높이', type: 'number' },
    { id: 'pixelArtColors', label: '색상 수', type: 'range' },
    { id: 'pixelArtShapePreserve', label: '원형 보존', type: 'range' },
    { id: 'pixelArtDetailPower', label: '디테일', type: 'range' },
    { id: 'pixelArtMicroDetail', label: '미세 디테일', type: 'range' },
    { id: 'pixelArtTonePattern', label: '명암 패턴', type: 'range' },
    { id: 'pixelArtFeatureBoost', label: '특징점', type: 'range' },
    { id: 'pixelArtSharpness', label: '선명도', type: 'range' },
    { id: 'pixelArtShapeSimplify', label: '형태 단순화', type: 'range' },
    { id: 'pixelArtContrast', label: '대비', type: 'range' },
    { id: 'pixelArtSaturation', label: '채도', type: 'range' },
    { id: 'pixelArtOutline', label: '윤곽', type: 'range' },
    { id: 'pixelArtScale', label: '확대', type: 'range' },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function isPixelArtViewActive() {
    return Boolean($('view-pixelArt')?.classList.contains('active'));
  }

  function installStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOGGLE_ID} {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 9998;
        display: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 16px;
        font-weight: 800;
        color: #fff;
        background: rgba(17, 24, 39, .92);
        box-shadow: 0 12px 34px rgba(0,0,0,.26);
        backdrop-filter: blur(10px);
      }
      #${PANEL_ID} {
        position: fixed;
        right: 18px;
        bottom: 74px;
        z-index: 9999;
        display: none;
        width: min(390px, calc(100vw - 28px));
        max-height: min(76vh, 720px);
        overflow: auto;
        padding: 14px;
        border: 1px solid rgba(148, 163, 184, .35);
        border-radius: 18px;
        background: rgba(255, 255, 255, .94);
        box-shadow: 0 18px 58px rgba(15, 23, 42, .28);
        backdrop-filter: blur(14px);
      }
      #${PANEL_ID}.open { display: block; }
      body.pixel-art-view-active #${TOGGLE_ID} { display: inline-flex; align-items: center; gap: 8px; }
      .pixel-floating-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
      .pixel-floating-title { font-weight:900; font-size:15px; color:#111827; }
      .pixel-floating-close { border:0; background:#111827; color:#fff; border-radius:999px; padding:6px 10px; font-weight:800; }
      .pixel-floating-grid { display:grid; grid-template-columns: 1fr; gap:10px; }
      .pixel-floating-control { display:grid; grid-template-columns: 88px 1fr 48px; gap:8px; align-items:center; font-size:12px; color:#374151; }
      .pixel-floating-control input[type="range"] { width:100%; }
      .pixel-floating-control input[type="number"] { width:100%; border:1px solid rgba(148,163,184,.5); border-radius:10px; padding:7px 8px; }
      .pixel-floating-value { text-align:right; font-variant-numeric: tabular-nums; color:#111827; font-weight:800; }
      .pixel-floating-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .pixel-floating-actions button { border:0; border-radius:12px; padding:9px 11px; font-weight:800; background:#e5e7eb; color:#111827; }
      .pixel-floating-actions button.primary { background:#111827; color:#fff; }
      .pixel-floating-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
      .pixel-floating-row select, .pixel-floating-row label { width:100%; }
      .pixel-floating-check { display:flex; align-items:center; gap:6px; padding:8px 9px; border-radius:12px; background:rgba(243,244,246,.9); font-size:12px; font-weight:800; color:#111827; }
      @media (max-width: 720px) {
        #${TOGGLE_ID} { right: 14px; bottom: 14px; }
        #${PANEL_ID} {
          left: 10px;
          right: 10px;
          bottom: 66px;
          width: auto;
          max-height: 64vh;
          border-radius: 20px 20px 14px 14px;
        }
        .pixel-floating-control { grid-template-columns: 86px 1fr 44px; }
      }
      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} { background: rgba(17, 24, 39, .94); border-color: rgba(75, 85, 99, .75); }
        .pixel-floating-title, .pixel-floating-value { color:#fff; }
        .pixel-floating-control { color:#d1d5db; }
        .pixel-floating-control input[type="number"] { background:#111827; color:#fff; border-color:#374151; }
        .pixel-floating-actions button { background:#374151; color:#fff; }
        .pixel-floating-actions button.primary { background:#fff; color:#111827; }
        .pixel-floating-check { background:rgba(55,65,81,.9); color:#fff; }
      }
    `;
    document.head.append(style);
  }

  function makeControl(config) {
    const source = $(config.id);
    if (!source) return null;
    const row = document.createElement('label');
    row.className = 'pixel-floating-control';
    row.dataset.sourceId = config.id;

    const label = document.createElement('span');
    label.textContent = config.label;
    const input = document.createElement('input');
    input.type = config.type;
    input.value = source.value;
    ['min', 'max', 'step'].forEach((attr) => {
      if (source.getAttribute(attr) != null) input.setAttribute(attr, source.getAttribute(attr));
    });
    const value = document.createElement('span');
    value.className = 'pixel-floating-value';
    value.textContent = source.value;

    input.addEventListener('input', () => {
      source.value = input.value;
      value.textContent = input.value;
      source.dispatchEvent(new Event('input', { bubbles: true }));
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });

    row.append(label, input, value);
    return row;
  }

  function syncFromSource() {
    const panel = $(PANEL_ID);
    if (!panel) return;
    panel.querySelectorAll('[data-source-id]').forEach((row) => {
      const source = $(row.dataset.sourceId);
      const input = row.querySelector('input');
      const value = row.querySelector('.pixel-floating-value');
      if (!source || !input || !value) return;
      input.value = source.value;
      value.textContent = source.value;
    });
    const ultra = $('pixelFloatingUltra');
    const sourceUltra = $('pixelArtUltraDetail');
    if (ultra && sourceUltra) ultra.checked = sourceUltra.checked;
  }

  function copySelect(sourceId, targetId) {
    const source = $(sourceId);
    const target = $(targetId);
    if (!source || !target) return;
    target.innerHTML = source.innerHTML;
    target.value = source.value;
    target.addEventListener('change', () => {
      source.value = target.value;
      source.dispatchEvent(new Event('change', { bubbles: true }));
    });
    source.addEventListener('change', () => { target.value = source.value; });
  }

  function installPanel() {
    if ($(PANEL_ID) || !$('view-pixelArt')) return;

    const toggle = document.createElement('button');
    toggle.id = TOGGLE_ID;
    toggle.type = 'button';
    toggle.textContent = '⚙️ 픽셀 설정';

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="pixel-floating-head">
        <div class="pixel-floating-title">픽셀아트 빠른 설정</div>
        <button class="pixel-floating-close" type="button">닫기</button>
      </div>
      <div class="pixel-floating-row">
        <select id="pixelFloatingPreset"></select>
        <select id="pixelFloatingDither"></select>
      </div>
      <label class="pixel-floating-check"><input id="pixelFloatingSmart" type="checkbox"> 스마트 원형 보존</label>
      <label class="pixel-floating-check"><input id="pixelFloatingUltra" type="checkbox"> 초저해상도 디테일 압축</label>
      <label class="pixel-floating-check"><input id="pixelFloatingAuto" type="checkbox"> 자동 변환</label>
      <div class="pixel-floating-grid"></div>
      <div class="pixel-floating-actions">
        <button id="pixelFloatingRun" class="primary" type="button">변환</button>
        <button id="pixelFloating64" type="button">64 추천</button>
        <button id="pixelFloating32" type="button">32 추천</button>
        <button id="pixelFloatingTop" type="button">위로</button>
      </div>
    `;

    document.body.append(toggle, panel);

    const grid = panel.querySelector('.pixel-floating-grid');
    controls.forEach((config) => {
      const control = makeControl(config);
      if (control) grid.append(control);
    });

    copySelect('pixelArtPreset', 'pixelFloatingPreset');
    copySelect('pixelArtDither', 'pixelFloatingDither');

    const smart = $('pixelFloatingSmart');
    const ultra = $('pixelFloatingUltra');
    const auto = $('pixelFloatingAuto');
    const sourceSmart = $('pixelArtSmartDetail');
    const sourceUltra = $('pixelArtUltraDetail');
    const sourceAuto = $('pixelArtAutoRun');
    if (smart && sourceSmart) {
      smart.checked = sourceSmart.checked;
      smart.addEventListener('change', () => {
        sourceSmart.checked = smart.checked;
        sourceSmart.dispatchEvent(new Event('change', { bubbles: true }));
      });
      sourceSmart.addEventListener('change', () => { smart.checked = sourceSmart.checked; });
    }
    if (ultra && sourceUltra) {
      ultra.checked = sourceUltra.checked;
      ultra.addEventListener('change', () => {
        sourceUltra.checked = ultra.checked;
        sourceUltra.dispatchEvent(new Event('change', { bubbles: true }));
      });
      sourceUltra.addEventListener('change', () => { ultra.checked = sourceUltra.checked; });
    }
    if (auto && sourceAuto) {
      auto.checked = sourceAuto.checked;
      auto.addEventListener('change', () => {
        sourceAuto.checked = auto.checked;
        sourceAuto.dispatchEvent(new Event('change', { bubbles: true }));
      });
      sourceAuto.addEventListener('change', () => { auto.checked = sourceAuto.checked; });
    }

    toggle.addEventListener('click', () => {
      syncFromSource();
      panel.classList.toggle('open');
    });
    panel.querySelector('.pixel-floating-close')?.addEventListener('click', () => panel.classList.remove('open'));
    $('pixelFloatingRun')?.addEventListener('click', () => $('pixelArtRunButton')?.click());
    $('pixelFloatingTop')?.addEventListener('click', () => $('view-pixelArt')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    $('pixelFloating64')?.addEventListener('click', () => applyRecommended(64));
    $('pixelFloating32')?.addEventListener('click', () => applyRecommended(32));

    controls.forEach((config) => {
      const source = $(config.id);
      source?.addEventListener('input', syncFromSource);
      source?.addEventListener('change', syncFromSource);
    });
  }

  function setSourceValue(id, value) {
    const element = $(id);
    if (!element) return;
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSourceChecked(id, checked) {
    const element = $(id);
    if (!element) return;
    element.checked = checked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyRecommended(size) {
    setSourceValue('pixelArtWidth', size);
    setSourceValue('pixelArtHeight', size);
    setSourceValue('pixelArtColors', size <= 32 ? 64 : 96);
    setSourceValue('pixelArtShapePreserve', size <= 32 ? 90 : 78);
    setSourceValue('pixelArtDetailPower', size <= 32 ? 42 : 46);
    setSourceValue('pixelArtMicroDetail', size <= 32 ? 84 : 70);
    setSourceValue('pixelArtTonePattern', size <= 32 ? 56 : 38);
    setSourceValue('pixelArtFeatureBoost', size <= 32 ? 82 : 66);
    setSourceValue('pixelArtSharpness', size <= 32 ? 46 : 34);
    setSourceValue('pixelArtShapeSimplify', size <= 32 ? 34 : 22);
    setSourceValue('pixelArtContrast', size <= 32 ? 10 : 8);
    setSourceValue('pixelArtSaturation', size <= 32 ? 8 : 8);
    setSourceValue('pixelArtOutline', size <= 32 ? 14 : 10);
    setSourceValue('pixelArtScale', size <= 32 ? 14 : 8);
    setSourceChecked('pixelArtSmartDetail', true);
    setSourceChecked('pixelArtUltraDetail', true);
    syncFromSource();
    $('pixelArtRunButton')?.click();
  }

  function updateVisibility() {
    document.body.classList.toggle('pixel-art-view-active', isPixelArtViewActive());
    if (!isPixelArtViewActive()) $(PANEL_ID)?.classList.remove('open');
  }

  function install() {
    installStyle();
    installPanel();
    updateVisibility();
  }

  const observer = new MutationObserver(() => {
    install();
    updateVisibility();
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('.nav-btn')) window.setTimeout(updateVisibility, 0);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
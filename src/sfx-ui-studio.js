(() => {
  const STYLE_ID = 'sfxUiStudioStyle';
  const MAX_TRIES = 40;
  let installed = false;

  function $(id) { return document.getElementById(id); }
  function el(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-sfxMaker.sfx-studio-view .sfx-app { gap:14px; }
      #view-sfxMaker.sfx-studio-view .sfx-hero { position:relative; padding:18px; border-radius:26px; background:radial-gradient(circle at 8% 10%,rgba(56,189,248,.36),transparent 30%),radial-gradient(circle at 88% 18%,rgba(168,85,247,.32),transparent 32%),linear-gradient(135deg,#020617,#111827 48%,#172554); }
      #view-sfxMaker.sfx-studio-view .sfx-hero h1 { font-size:25px; margin:9px 0 5px; }
      #view-sfxMaker.sfx-studio-view .sfx-hero p { font-size:13px; max-width:660px; }
      #view-sfxMaker.sfx-studio-view .sfx-transport { align-items:stretch; }
      #view-sfxMaker.sfx-studio-view .sfx-big-button { min-width:104px; padding:12px 14px; border-radius:16px; }
      #view-sfxMaker.sfx-studio-view .sfx-main-grid { grid-template-columns:minmax(280px,.82fr) minmax(320px,1.18fr); gap:14px; }
      #view-sfxMaker.sfx-studio-view .sfx-card { border-radius:22px; }
      #view-sfxMaker.sfx-studio-view .sfx-card-body { padding:14px; }
      #view-sfxMaker.sfx-studio-view .sfx-preset-grid { display:flex; gap:10px; overflow-x:auto; overflow-y:hidden; max-height:none; padding:4px 4px 12px; scroll-snap-type:x proximity; }
      #view-sfxMaker.sfx-studio-view .sfx-preset { min-width:152px; flex:0 0 auto; scroll-snap-align:start; }
      #view-sfxMaker.sfx-studio-view .sfx-preset.active { border-color:#06b6d4; box-shadow:0 0 0 3px rgba(6,182,212,.16),0 16px 32px rgba(15,23,42,.13); }
      #view-sfxMaker.sfx-studio-view .sfx-screen { padding:10px; }
      #view-sfxMaker.sfx-studio-view #sfxWaveCanvas { height:118px; }
      .sfx-studio-console { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:14px; }
      .sfx-studio-chip { border:1px solid rgba(255,255,255,.18); border-radius:16px; padding:10px 12px; background:rgba(15,23,42,.48); backdrop-filter:blur(14px); min-width:0; }
      .sfx-studio-chip small { display:block; color:rgba(255,255,255,.58); font-size:10px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
      .sfx-studio-chip strong { display:block; margin-top:4px; color:#fff; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sfx-studio-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .sfx-studio-tab { border:0; border-radius:999px; padding:10px 13px; font-weight:950; color:#334155; background:#e2e8f0; cursor:pointer; }
      .sfx-studio-tab.active { color:#fff; background:linear-gradient(135deg,#4f46e5,#06b6d4); box-shadow:0 10px 24px rgba(79,70,229,.22); }
      .sfx-studio-panel { display:none; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .sfx-studio-panel.active { display:grid; }
      .sfx-studio-panel .sfx-control.wide { grid-column:1/-1; }
      .sfx-studio-note { grid-column:1/-1; padding:13px 14px; border-radius:18px; color:#334155; background:linear-gradient(135deg,rgba(14,165,233,.09),rgba(99,102,241,.08)); border:1px solid rgba(14,165,233,.2); font-size:12px; line-height:1.45; }
      .sfx-studio-pill-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .sfx-studio-pill { border:0; border-radius:999px; padding:8px 10px; font-size:11px; font-weight:950; color:#0f172a; background:#e0f2fe; cursor:pointer; }
      .sfx-studio-mode-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; grid-column:1/-1; }
      .sfx-studio-mini { font-size:11px; color:#64748b; margin-top:8px; line-height:1.4; }
      @media (max-width:960px) { #view-sfxMaker.sfx-studio-view .sfx-main-grid { grid-template-columns:1fr; } #view-sfxMaker.sfx-studio-view .sfx-card:nth-of-type(2) { order:-1; } .sfx-studio-console { grid-template-columns:repeat(2,minmax(0,1fr)); } }
      @media (max-width:640px) { #view-sfxMaker.sfx-studio-view .sfx-hero { padding:15px; border-radius:20px; } #view-sfxMaker.sfx-studio-view .sfx-hero-top { display:grid; } #view-sfxMaker.sfx-studio-view .sfx-transport { display:grid; grid-template-columns:1fr 1fr; } #view-sfxMaker.sfx-studio-view #sfxRandomButton { grid-column:1/-1; } .sfx-studio-toolbar { overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; } .sfx-studio-tab { white-space:nowrap; flex:0 0 auto; } .sfx-studio-panel { grid-template-columns:1fr; } .sfx-studio-mode-row { grid-template-columns:1fr; } #view-sfxMaker.sfx-studio-view .sfx-preset { min-width:138px; } }
      @media (prefers-color-scheme: dark) { .sfx-studio-tab { color:#d1d5db; background:#374151; } .sfx-studio-note { color:#d1d5db; background:linear-gradient(135deg,rgba(14,165,233,.13),rgba(99,102,241,.14)); border-color:rgba(14,165,233,.28); } .sfx-studio-pill { color:#e0f2fe; background:#164e63; } .sfx-studio-mini { color:#9ca3af; } }
    `;
    document.head.append(style);
  }

  function range(id, label, value) {
    return el(`<div class="sfx-control"><label>${label} <output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="0" max="1" step="0.01" value="${value}"></div>`);
  }

  function addWaveforms() {
    const select = $('sfxWave');
    const data = window.SFXStudioPresets;
    if (!select || !data || select.dataset.studioWaveforms === 'true') return;
    const current = select.value || 'sine';
    select.innerHTML = data.waveforms.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    select.value = data.waveforms.some(([value]) => value === current) ? current : 'sine';
    select.dataset.studioWaveforms = 'true';
  }

  function addStudioControls() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!grid || $('sfxStudioEngine')) return;
    grid.prepend(
      el(`<div class="sfx-studio-note"><b>Studio Engine</b> — 한 번만 초기화되는 안전 UI입니다. 실제 재생/다운로드는 엔진 코어 하나만 담당합니다.<div id="sfxStudioPresetPills" class="sfx-studio-pill-row"></div></div>`),
      el(`<div class="sfx-studio-mode-row"><div class="sfx-control"><label>엔진</label><select id="sfxStudioEngine"><option value="pro" selected>Pro Texture</option><option value="clean">Clean Digital</option><option value="impact">Impact Design</option><option value="air">Air / Whoosh</option></select><div class="sfx-studio-mini">합성 경로를 선택합니다.</div></div><div class="sfx-control"><label>질감</label><select id="sfxStudioTexture"><option value="auto" selected>Auto</option><option value="clean">Clean</option><option value="glass">Glass</option><option value="bell">Soft Bell</option><option value="impact">Impact</option><option value="whoosh">Whoosh</option><option value="hybrid">Hybrid</option></select><div class="sfx-studio-mini">파형/프리셋별 질감입니다.</div></div></div>`),
      range('sfxStudioDepth', '레이어 깊이', 0.78),
      range('sfxStudioBody', '바디', 0.46),
      range('sfxStudioShine', '샤인', 0.52),
      range('sfxStudioComp', '컴프레서', 0.58),
      range('sfxStudioWidth', '스테레오 폭', 0.58),
      range('sfxStudioTail', '테일', 0.34),
      range('sfxStudioAir', '공기감', 0.38)
    );
    const pills = $('sfxStudioPresetPills');
    Object.keys(window.SFXStudioPresets?.masterPresets || {}).forEach((name) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sfx-studio-pill';
      button.dataset.sfxStudioPreset = name;
      button.textContent = name;
      pills?.append(button);
    });
  }

  function buildConsole() {
    const view = $('view-sfxMaker');
    if (!view || $('sfxStudioConsole')) return;
    view.classList.add('sfx-studio-view');
    const heroTop = view.querySelector('.sfx-hero-top');
    heroTop?.after(el(`<div id="sfxStudioConsole" class="sfx-studio-console"><div class="sfx-studio-chip"><small>Engine</small><strong id="sfxStudioEngineReadout">Pro Texture</strong></div><div class="sfx-studio-chip"><small>Texture</small><strong id="sfxStudioTextureReadout">Auto</strong></div><div class="sfx-studio-chip"><small>Render</small><strong id="sfxStudioRenderReadout">48kHz WAV</strong></div><div class="sfx-studio-chip"><small>Peak</small><strong id="sfxStudioPeakReadout">-</strong></div></div>`));
  }

  function buildTabs() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    const cardBody = grid?.closest('.sfx-card-body');
    if (!grid || !cardBody || $('sfxStudioTabs')) return;
    const tabs = el(`<div id="sfxStudioTabs" class="sfx-studio-toolbar"><button type="button" class="sfx-studio-tab active" data-tab="basic">기본</button><button type="button" class="sfx-studio-tab" data-tab="texture">질감</button><button type="button" class="sfx-studio-tab" data-tab="space">공간</button><button type="button" class="sfx-studio-tab" data-tab="advanced">고급</button></div>`);
    const panels = ['basic', 'texture', 'space', 'advanced'].reduce((acc, key) => {
      acc[key] = el(`<div class="sfx-studio-panel ${key === 'basic' ? 'active' : ''}" data-panel="${key}"></div>`);
      return acc;
    }, {});
    cardBody.insertBefore(tabs, grid);
    Object.values(panels).forEach((panel) => cardBody.insertBefore(panel, grid));
    move(grid, panels.basic, ['sfxWave', 'sfxNameInput', 'sfxDuration', 'sfxVolume', 'sfxStartFreq', 'sfxEndFreq']);
    move(grid, panels.texture, ['sfxStudioEngine', 'sfxStudioTexture', 'sfxStudioDepth', 'sfxStudioBody', 'sfxStudioShine', 'sfxStudioComp', 'sfxNoise', 'sfxFilter']);
    move(grid, panels.space, ['sfxStudioWidth', 'sfxStudioTail', 'sfxStudioAir', 'sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub']);
    move(grid, panels.advanced, ['sfxAttack', 'sfxDecay', 'sfxSustain', 'sfxRelease', 'sfxVibratoDepth', 'sfxVibratoRate', 'sfxPunch', 'sfxBitcrush', 'sfxArpeggio']);
    Array.from(grid.children).forEach((child) => panels.advanced.append(child));
    grid.remove();
    tabs.addEventListener('click', (event) => {
      const button = event.target.closest('.sfx-studio-tab');
      if (!button) return;
      tabs.querySelectorAll('.sfx-studio-tab').forEach((item) => item.classList.toggle('active', item === button));
      Object.values(panels).forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
    });
  }

  function move(source, target, ids) {
    ids.forEach((id) => {
      const input = $(id);
      const control = input?.closest('.sfx-control, .sfx-studio-note, .sfx-studio-mode-row');
      if (control && source.contains(control)) target.append(control);
    });
  }

  function syncOutputs() {
    ['sfxStudioDepth', 'sfxStudioBody', 'sfxStudioShine', 'sfxStudioComp', 'sfxStudioWidth', 'sfxStudioTail', 'sfxStudioAir'].forEach((id) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (input && output) output.textContent = input.value;
    });
  }

  function installOnce() {
    if (installed) return true;
    const view = $('view-sfxMaker');
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!view || !grid || !window.SFXStudioPresets) return false;
    installed = true;
    try {
      ensureStyle();
      addWaveforms();
      addStudioControls();
      buildConsole();
      buildTabs();
      syncOutputs();
      document.addEventListener('input', syncOutputs);
      document.addEventListener('change', syncOutputs);
      window.dispatchEvent(new CustomEvent('sfx:studio-ui-ready'));
    } catch (error) {
      installed = false;
      console.error('[sfx-ui-studio] init failed', error);
    }
    return installed;
  }

  function waitForBase(tries = 0) {
    if (installOnce()) return;
    if (tries >= MAX_TRIES) {
      console.warn('[sfx-ui-studio] base UI not ready; skipped');
      return;
    }
    window.setTimeout(() => waitForBase(tries + 1), 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForBase());
  else waitForBase();
})();
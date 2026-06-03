(() => {
  const STYLE_ID = 'sfxProStudioStyle';

  function $(id) { return document.getElementById(id); }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-sfxMaker.sfx-pro-view .sfx-app { gap:14px; }
      #view-sfxMaker.sfx-pro-view .sfx-hero { padding:18px; border-radius:26px; position:sticky; top:10px; z-index:20; }
      #view-sfxMaker.sfx-pro-view .sfx-hero h1 { font-size:25px; margin:9px 0 5px; }
      #view-sfxMaker.sfx-pro-view .sfx-hero p { font-size:13px; max-width:640px; }
      #view-sfxMaker.sfx-pro-view .sfx-transport { align-items:stretch; }
      #view-sfxMaker.sfx-pro-view .sfx-big-button { min-width:104px; padding:12px 14px; border-radius:16px; }
      #view-sfxMaker.sfx-pro-view .sfx-main-grid { grid-template-columns:minmax(280px,.82fr) minmax(320px,1.18fr); gap:14px; }
      #view-sfxMaker.sfx-pro-view .sfx-card { border-radius:22px; }
      #view-sfxMaker.sfx-pro-view .sfx-card-body { padding:14px; }
      #view-sfxMaker.sfx-pro-view .sfx-preset-grid { display:flex; gap:10px; overflow-x:auto; overflow-y:hidden; max-height:none; padding:4px 4px 12px; scroll-snap-type:x proximity; }
      #view-sfxMaker.sfx-pro-view .sfx-preset { min-width:152px; scroll-snap-align:start; flex:0 0 auto; }
      #view-sfxMaker.sfx-pro-view .sfx-screen { padding:10px; }
      #view-sfxMaker.sfx-pro-view #sfxWaveCanvas { height:118px; }
      #view-sfxMaker.sfx-pro-view .sfx-readout { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .sfx-pro-toolbar { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .sfx-pro-tab { border:0; border-radius:999px; padding:10px 13px; font-weight:950; color:#334155; background:#e2e8f0; cursor:pointer; }
      .sfx-pro-tab.active { color:#fff; background:linear-gradient(135deg,#4f46e5,#06b6d4); box-shadow:0 10px 24px rgba(79,70,229,.22); }
      .sfx-pro-panel { display:none; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .sfx-pro-panel.active { display:grid; }
      .sfx-pro-panel .sfx-control.wide { grid-column:1/-1; }
      .sfx-pro-note { grid-column:1/-1; border:1px solid rgba(6,182,212,.22); border-radius:18px; padding:12px 14px; background:linear-gradient(135deg,rgba(6,182,212,.09),rgba(168,85,247,.08)); color:#475569; font-size:12px; line-height:1.45; }
      .sfx-pro-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 9px; border-radius:999px; background:linear-gradient(135deg,rgba(14,165,233,.18),rgba(16,185,129,.16)); color:#0369a1; font-size:11px; font-weight:950; border:1px solid rgba(14,165,233,.22); margin-right:6px; }
      .sfx-pro-mode-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; grid-column:1/-1; }
      .sfx-pro-mini { font-size:11px; color:#64748b; margin-top:8px; line-height:1.4; }
      #view-sfxMaker.sfx-pro-view .sfx-control { transition:transform .12s ease, border-color .12s ease; }
      #view-sfxMaker.sfx-pro-view .sfx-control:focus-within { transform:translateY(-1px); border-color:rgba(79,70,229,.45); box-shadow:0 8px 24px rgba(79,70,229,.1); }
      @media (max-width:960px) {
        #view-sfxMaker.sfx-pro-view .sfx-hero { position:relative; top:auto; }
        #view-sfxMaker.sfx-pro-view .sfx-main-grid { grid-template-columns:1fr; }
        #view-sfxMaker.sfx-pro-view .sfx-card:nth-of-type(2) { order:-1; }
      }
      @media (max-width:640px) {
        #view-sfxMaker.sfx-pro-view .sfx-hero { padding:15px; border-radius:20px; }
        #view-sfxMaker.sfx-pro-view .sfx-hero-top { display:grid; }
        #view-sfxMaker.sfx-pro-view .sfx-transport { display:grid; grid-template-columns:1fr 1fr; }
        #view-sfxMaker.sfx-pro-view #sfxRandomButton { grid-column:1/-1; }
        .sfx-pro-toolbar { overflow-x:auto; flex-wrap:nowrap; padding-bottom:4px; }
        .sfx-pro-tab { white-space:nowrap; flex:0 0 auto; }
        .sfx-pro-panel { grid-template-columns:1fr; }
        .sfx-pro-mode-row { grid-template-columns:1fr; }
        #view-sfxMaker.sfx-pro-view .sfx-preset { min-width:138px; }
      }
      @media (prefers-color-scheme: dark) {
        .sfx-pro-tab { color:#d1d5db; background:#374151; }
        .sfx-pro-note { color:#d1d5db; background:linear-gradient(135deg,rgba(6,182,212,.14),rgba(168,85,247,.12)); border-color:rgba(6,182,212,.3); }
        .sfx-pro-badge { color:#bae6fd; }
        .sfx-pro-mini { color:#9ca3af; }
      }
    `;
    document.head.append(style);
  }

  function html(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function makeRange(id, label, min, max, step, value) {
    return html(`<div class="sfx-control"><label>${label} <output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`);
  }

  function addProControls() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!grid || $('sfxProEngine')) return;

    const note = html(`<div class="sfx-pro-note"><span class="sfx-pro-badge">🎛️ Pro Studio</span>이 파일은 UI 배치만 담당합니다. 실제 재생/다운로드는 Mastering Studio 레이어가 단독 처리합니다.</div>`);
    const modeRow = html(`
      <div class="sfx-pro-mode-row">
        <div class="sfx-control"><label>엔진</label><select id="sfxProEngine"><option value="pro" selected>Pro Texture</option><option value="clean">Clean Digital</option><option value="impact">Impact Design</option><option value="air">Air / Whoosh</option></select><div class="sfx-pro-mini">최종 렌더러가 이 값을 기준으로 합성 경로를 선택합니다.</div></div>
        <div class="sfx-control"><label>질감 타입</label><select id="sfxTexture"><option value="auto" selected>Auto</option><option value="clean">Clean</option><option value="glass">Glass</option><option value="bell">Soft Bell</option><option value="impact">Impact</option><option value="whoosh">Whoosh</option><option value="hybrid">Hybrid</option></select><div class="sfx-pro-mini">프리셋/파형에 따라 Auto가 질감을 자동 선택합니다.</div></div>
      </div>
    `);

    grid.prepend(
      note,
      modeRow,
      makeRange('sfxRealism', '고급 질감', 0, 1, 0.01, 0.75),
      makeRange('sfxTransient', '트랜지언트', 0, 1, 0.01, 0.45),
      makeRange('sfxPolish', '매끄러움', 0, 1, 0.01, 0.62),
      makeRange('sfxAir', '공기감', 0, 1, 0.01, 0.38)
    );
  }

  function buildTabs() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    const cardBody = grid?.closest('.sfx-card-body');
    if (!grid || !cardBody || $('sfxProTabs')) return;

    const toolbar = html(`
      <div id="sfxProTabs" class="sfx-pro-toolbar">
        <button type="button" class="sfx-pro-tab active" data-tab="basic">기본</button>
        <button type="button" class="sfx-pro-tab" data-tab="texture">질감</button>
        <button type="button" class="sfx-pro-tab" data-tab="space">공간</button>
        <button type="button" class="sfx-pro-tab" data-tab="advanced">고급</button>
      </div>
    `);
    const panels = {
      basic: html('<div class="sfx-pro-panel active" data-panel="basic"></div>'),
      texture: html('<div class="sfx-pro-panel" data-panel="texture"></div>'),
      space: html('<div class="sfx-pro-panel" data-panel="space"></div>'),
      advanced: html('<div class="sfx-pro-panel" data-panel="advanced"></div>'),
    };

    cardBody.insertBefore(toolbar, grid);
    cardBody.insertBefore(panels.basic, grid);
    cardBody.insertBefore(panels.texture, grid);
    cardBody.insertBefore(panels.space, grid);
    cardBody.insertBefore(panels.advanced, grid);

    moveControls(grid, panels.basic, ['sfxWave', 'sfxNameInput', 'sfxDuration', 'sfxVolume', 'sfxStartFreq', 'sfxEndFreq']);
    moveControls(grid, panels.texture, ['sfxProEngine', 'sfxTexture', 'sfxRealism', 'sfxTransient', 'sfxPolish', 'sfxAir', 'sfxNoise', 'sfxFilter']);
    moveControls(grid, panels.space, ['sfxSoundStyle', 'sfxRenderQuality', 'sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub']);
    moveControls(grid, panels.advanced, ['sfxAttack', 'sfxDecay', 'sfxSustain', 'sfxRelease', 'sfxVibratoDepth', 'sfxVibratoRate', 'sfxPunch', 'sfxBitcrush', 'sfxArpeggio']);
    Array.from(grid.children).forEach((child) => panels.advanced.append(child));
    grid.remove();

    toolbar.addEventListener('click', (event) => {
      const button = event.target.closest('.sfx-pro-tab');
      if (!button) return;
      const tab = button.dataset.tab;
      toolbar.querySelectorAll('.sfx-pro-tab').forEach((item) => item.classList.toggle('active', item === button));
      Object.values(panels).forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab));
    });
  }

  function moveControls(sourceGrid, targetPanel, ids) {
    ids.forEach((id) => {
      const input = $(id);
      const control = input?.closest('.sfx-control, .sfx-pro-note, .sfx-pro-mode-row');
      if (control && sourceGrid.contains(control)) targetPanel.append(control);
    });
  }

  function applyAppClass() {
    $('view-sfxMaker')?.classList.add('sfx-pro-view');
  }

  function syncOutputs() {
    ['sfxRealism', 'sfxTransient', 'sfxPolish', 'sfxAir'].forEach((id) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (input && output) output.textContent = input.value;
    });
  }

  function bindOutputSync() {
    if (document.body.dataset.sfxProOutputSync === 'true') return;
    document.body.dataset.sfxProOutputSync = 'true';
    document.addEventListener('input', syncOutputs);
    document.addEventListener('change', syncOutputs);
  }

  function install() {
    ensureStyle();
    addProControls();
    buildTabs();
    applyAppClass();
    bindOutputSync();
    syncOutputs();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
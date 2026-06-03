(() => {
  const STYLE_ID = 'sfxProStudioStyle';
  let audioContext = null;
  let activeSource = null;
  let currentBuffer = null;
  let downloadUrl = '';
  let bound = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function readNum(id, fallback) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return Number.isFinite(value) ? value : fallback;
  }

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

  function addProControls() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!grid || $('sfxProEngine')) return;

    const note = html(`<div class="sfx-pro-note"><span class="sfx-pro-badge">🎛️ Pro Studio</span>고급 질감을 올릴수록 단순 파형 비중을 줄이고, FM/모달/공기감/코러스/마이크로 딜레이 레이어를 크게 늘립니다.</div>`);
    const modeRow = html(`
      <div class="sfx-pro-mode-row">
        <div class="sfx-control"><label>엔진</label><select id="sfxProEngine"><option value="pro" selected>Pro Texture</option><option value="clean">Clean Digital</option><option value="impact">Impact Design</option><option value="air">Air / Whoosh</option></select><div class="sfx-pro-mini">16비트 느낌을 줄이려면 Pro Texture 또는 Clean Digital 사용</div></div>
        <div class="sfx-control"><label>질감 타입</label><select id="sfxTexture"><option value="auto" selected>Auto</option><option value="clean">Clean</option><option value="glass">Glass</option><option value="bell">Soft Bell</option><option value="impact">Impact</option><option value="whoosh">Whoosh</option><option value="hybrid">Hybrid</option></select><div class="sfx-pro-mini">프리셋에 따라 Auto가 질감을 자동 선택</div></div>
      </div>
    `);
    const realism = makeRange('sfxRealism', '고급 질감', 0, 1, 0.01, 0.75);
    const transient = makeRange('sfxTransient', '트랜지언트', 0, 1, 0.01, 0.45);
    const polish = makeRange('sfxPolish', '매끄러움', 0, 1, 0.01, 0.62);
    const air = makeRange('sfxAir', '공기감', 0, 1, 0.01, 0.38);

    grid.prepend(note, modeRow, realism, transient, polish, air);
  }

  function makeRange(id, label, min, max, step, value) {
    return html(`<div class="sfx-control"><label>${label} <output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`);
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

    const basicIds = ['sfxWave', 'sfxNameInput', 'sfxDuration', 'sfxVolume', 'sfxStartFreq', 'sfxEndFreq'];
    const textureIds = ['sfxProEngine', 'sfxTexture', 'sfxRealism', 'sfxTransient', 'sfxPolish', 'sfxAir', 'sfxNoise', 'sfxFilter'];
    const spaceIds = ['sfxSoundStyle', 'sfxRenderQuality', 'sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub'];
    const advancedIds = ['sfxAttack', 'sfxDecay', 'sfxSustain', 'sfxRelease', 'sfxVibratoDepth', 'sfxVibratoRate', 'sfxPunch', 'sfxBitcrush', 'sfxArpeggio'];

    moveControls(grid, panels.basic, basicIds);
    moveControls(grid, panels.texture, textureIds);
    moveControls(grid, panels.space, spaceIds);
    moveControls(grid, panels.advanced, advancedIds);
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

  function getContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function inferTexture(id, engine) {
    const key = String(id).toLowerCase();
    if (engine === 'impact') return 'impact';
    if (engine === 'air') return 'whoosh';
    if (/hit|land|explosion|fail|impact/.test(key)) return 'impact';
    if (/heal|magic|success|notify|coin|pickup|power/.test(key)) return 'glass';
    if (/warning|portal|laser|glitch/.test(key)) return 'hybrid';
    if (/menu|click|confirm|cancel|typing/.test(key)) return 'clean';
    return 'hybrid';
  }

  function getParams() {
    const engine = $('sfxProEngine')?.value || 'pro';
    const id = $('sfxNameInput')?.value || 'sfx-pro';
    let texture = $('sfxTexture')?.value || 'auto';
    if (texture === 'auto') texture = inferTexture(id, engine);
    const realism = readNum('sfxRealism', 0.75);
    return {
      id,
      engine,
      texture,
      duration: readNum('sfxDuration', 0.25),
      volume: readNum('sfxVolume', 0.55),
      startFreq: readNum('sfxStartFreq', 600),
      endFreq: readNum('sfxEndFreq', 900),
      attack: readNum('sfxAttack', 0.004),
      decay: readNum('sfxDecay', 0.1),
      sustain: readNum('sfxSustain', 0.25),
      release: readNum('sfxRelease', 0.06),
      noise: readNum('sfxNoise', 0.05),
      filter: readNum('sfxFilter', 7000),
      vibratoDepth: readNum('sfxVibratoDepth', 0.01),
      vibratoRate: readNum('sfxVibratoRate', 8),
      punch: readNum('sfxPunch', 0.25),
      bitcrush: Math.min(readNum('sfxBitcrush', 0), 0.05 * (1 - realism)),
      arpeggio: parseArp($('sfxArpeggio')?.value || '0'),
      space: readNum('sfxSpace', 0.35),
      reverb: readNum('sfxReverb', 0.22),
      stereo: readNum('sfxStereo', 0.42),
      brightness: readNum('sfxBrightness', 0.55),
      sub: readNum('sfxSub', 0.18),
      realism,
      transient: readNum('sfxTransient', 0.45),
      polish: readNum('sfxPolish', 0.62),
      air: readNum('sfxAir', 0.38),
    };
  }

  function parseArp(text) {
    const values = String(text || '0').split(',').map((value) => Number.parseFloat(value.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function envelope(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) return lerp(1, p.sustain, (t - p.attack) / Math.max(0.0001, p.decay));
    if (t > p.duration - p.release) return Math.max(0, p.sustain * ((p.duration - t) / Math.max(0.0001, p.release)));
    return p.sustain;
  }

  function modalRatios(texture, realism) {
    const simple = [1, 2];
    const maps = {
      clean: [1, 2.003, 3.01, 4.02],
      glass: [1, 2.01, 2.72, 3.96, 5.41, 7.12, 9.2],
      bell: [1, 1.51, 2.23, 2.91, 4.18, 6.27, 8.9],
      impact: [0.5, 1, 1.32, 1.91, 2.8, 4.2],
      whoosh: [0.5, 0.75, 1.12, 1.8, 2.6],
      hybrid: [1, 1.49, 2.02, 2.98, 4.01, 5.97],
    };
    const complex = maps[texture] || maps.hybrid;
    const count = Math.round(lerp(simple.length, complex.length, realism));
    return complex.slice(0, count);
  }

  function textureConfig(texture, realism) {
    const r = realism;
    const base = {
      clean: { modal: 0.05 + r * 0.3, fm: 0.04 + r * 0.22, noise: 0.005 + r * 0.03, shimmer: r * 0.12, drive: 1.02 + r * 0.1 },
      glass: { modal: 0.12 + r * 0.72, fm: 0.08 + r * 0.55, noise: 0.006 + r * 0.05, shimmer: r * 0.32, drive: 1.04 + r * 0.15 },
      bell: { modal: 0.12 + r * 0.65, fm: 0.06 + r * 0.45, noise: 0.004 + r * 0.025, shimmer: r * 0.24, drive: 1.03 + r * 0.12 },
      impact: { modal: 0.06 + r * 0.35, fm: 0.04 + r * 0.28, noise: 0.18 + r * 0.62, shimmer: r * 0.05, drive: 1.12 + r * 0.55 },
      whoosh: { modal: r * 0.08, fm: r * 0.08, noise: 0.24 + r * 0.74, shimmer: r * 0.1, drive: 1.02 + r * 0.15 },
      hybrid: { modal: 0.08 + r * 0.52, fm: 0.08 + r * 0.5, noise: 0.05 + r * 0.18, shimmer: r * 0.22, drive: 1.05 + r * 0.22 },
    };
    return base[texture] || base.hybrid;
  }

  function synthesize(p) {
    const sampleRate = 48000;
    const tail = (0.05 + p.realism * 0.25) + p.reverb * (0.15 + p.realism * 0.8) + p.space * 0.12;
    const total = Math.max(1, Math.floor((p.duration + tail) * sampleRate));
    const dry = Math.max(1, Math.floor(p.duration * sampleRate));
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const ratios = modalRatios(p.texture, p.realism);
    const cfg = textureConfig(p.texture, p.realism);
    const modalPhase = ratios.map((_, index) => index * 1.923);
    const modalAmp = ratios.map((_, index) => Math.pow(1 / (1 + index * 0.62), lerp(2.0, 0.72, p.realism)));
    let carrier = 0.3;
    let mod = 1.1;
    let sub = 0;
    let air = 0;
    let airBand = 0;
    let prevAir = 0;

    for (let i = 0; i < dry; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, dry - 1);
      const arp = p.arpeggio[Math.min(p.arpeggio.length - 1, Math.floor(n * p.arpeggio.length))] || 0;
      const curve = p.texture === 'impact' ? Math.pow(n, 1.32) : Math.pow(n, lerp(0.64, 0.92, p.realism));
      const freq = Math.max(24, lerp(p.startFreq, p.endFreq, curve) * Math.pow(2, arp / 12));
      const vib = 1 + Math.sin(t * Math.PI * 2 * p.vibratoRate) * p.vibratoDepth * lerp(0.2, 0.8, p.realism);
      const f = freq * vib;
      const e = envelope(t, p);
      const snap = Math.exp(-n * lerp(45, 140, p.transient));
      const bodyDecay = Math.exp(-n * lerp(7.5, 1.35, p.realism));
      const quick = Math.exp(-n * (14 + p.transient * 45));
      const slow = Math.exp(-n * (1.4 + p.realism * 1.4));

      mod += (Math.PI * 2 * f * (1.7 + p.brightness * 1.8 + p.realism * 0.9)) / sampleRate;
      carrier += (Math.PI * 2 * f) / sampleRate;
      sub += (Math.PI * 2 * Math.max(22, f * 0.5)) / sampleRate;
      const fmIndex = cfg.fm * (0.25 + snap * 0.9 + p.realism * 0.9);
      const fm = Math.sin(carrier + Math.sin(mod) * fmIndex + Math.sin(mod * 0.503) * fmIndex * 0.37) * e;

      let modal = 0;
      for (let m = 0; m < ratios.length; m += 1) {
        const detune = 1 + Math.sin((m + 1) * 23.17 + p.space * 2) * p.realism * 0.005;
        modalPhase[m] += (Math.PI * 2 * f * ratios[m] * detune) / sampleRate;
        const decay = Math.exp(-n * lerp(7 + m * 2.3, 0.65 + m * 0.42, p.realism));
        modal += Math.sin(modalPhase[m]) * modalAmp[m] * decay;
      }
      modal *= cfg.modal * e * (0.4 + bodyDecay * 0.8);

      const raw = Math.random() * 2 - 1;
      const smoothRate = lerp(0.22, p.texture === 'whoosh' ? 0.018 : 0.055, p.realism);
      air += (raw - air) * smoothRate;
      airBand += ((air - prevAir) - airBand) * lerp(0.45, 0.13, p.realism);
      prevAir = air;
      const airLayer = (airBand * (0.5 + p.brightness) + air * 0.18) * (cfg.noise + p.noise * lerp(0.25, 0.85, p.realism) + p.air * 0.38) * (p.texture === 'whoosh' ? slow : quick * 0.7 + slow * 0.18);
      const shimmer = (Math.random() * 2 - 1) * cfg.shimmer * p.brightness * Math.exp(-n * lerp(20, 4, p.realism));
      const transient = transientLayer(n, p, sampleRate) * p.transient * lerp(0.45, 1.25, p.realism);
      const low = Math.sin(sub) * p.sub * (p.texture === 'impact' ? quick * 1.3 : slow * 0.35);

      const simpleCore = Math.sin(carrier) * e * lerp(0.75, 0.08, p.realism);
      let mono = simpleCore + fm * lerp(0.12, 1.0, p.realism) + modal + airLayer + shimmer + transient + low;
      mono *= p.volume * (1 + p.punch * quick * lerp(0.35, 1.4, p.realism));
      mono = Math.tanh(mono * cfg.drive) / Math.tanh(cfg.drive);
      mono = tone(mono, p, n);

      const pan = Math.sin(n * Math.PI * (1.1 + p.space * 2.2)) * p.stereo * lerp(0.08, 0.55, p.realism);
      const microWidth = raw * p.stereo * p.realism * 0.018;
      left[i] += mono * (0.94 - pan) + microWidth;
      right[i] += mono * (0.94 + pan) - microWidth;
    }

    applyFx(left, right, sampleRate, p);
    normalize(left, right, 0.92);
    return { left, right, sampleRate };
  }

  function transientLayer(n, p) {
    const click = (Math.random() * 2 - 1) * Math.exp(-n * 180) * 0.14;
    const tick = Math.sin(n * Math.PI * 2 * (90 + p.brightness * 260)) * Math.exp(-n * 95) * 0.11;
    const thump = Math.sin(n * Math.PI * 2 * 34) * Math.exp(-n * 36) * (p.texture === 'impact' ? 0.58 : 0.08);
    return click + tick + thump;
  }

  function tone(x, p, n) {
    const tailSoft = 1 - Math.max(0, n - 0.82) * p.polish * 0.36;
    const bright = 0.9 + p.brightness * lerp(0.08, 0.24, p.realism);
    return x * bright * tailSoft;
  }

  function applyFx(left, right, sampleRate, p) {
    const cutoff = clamp(p.filter * (0.38 + p.brightness * 0.95 + p.realism * 0.22), 180, 19000);
    const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
    let lpL = 0, lpR = 0, prevL = 0, prevR = 0;
    for (let i = 0; i < left.length; i += 1) {
      lpL += alpha * (left[i] - lpL);
      lpR += alpha * (right[i] - lpR);
      const hpL = left[i] - prevL;
      const hpR = right[i] - prevR;
      prevL = left[i]; prevR = right[i];
      left[i] = lpL * (0.78 + p.polish * 0.22) + hpL * p.brightness * p.realism * 0.08;
      right[i] = lpR * (0.78 + p.polish * 0.22) + hpR * p.brightness * p.realism * 0.08;
    }
    chorus(left, right, sampleRate, p.stereo * p.realism * (0.3 + p.polish * 0.8));
    reverb(left, right, sampleRate, p);
  }

  function chorus(left, right, sampleRate, amount) {
    if (amount <= 0.01) return;
    const a = new Float32Array(left);
    const b = new Float32Array(right);
    const depth = Math.floor(sampleRate * (0.0015 + amount * 0.006));
    const base = Math.floor(sampleRate * 0.0055);
    for (let i = base + depth; i < left.length; i += 1) {
      const wobble = Math.floor(Math.sin(i / sampleRate * Math.PI * 2 * 0.77) * depth);
      const delay = base + wobble;
      left[i] += b[i - delay] * amount * 0.1;
      right[i] += a[i - delay] * amount * 0.1;
    }
  }

  function reverb(left, right, sampleRate, p) {
    const amount = p.reverb * lerp(0.2, 1.15, p.realism);
    if (amount <= 0.01) return;
    const delays = [0.019, 0.031, 0.047, 0.073, 0.113, 0.167].map((sec) => Math.floor(sec * sampleRate * (0.8 + p.space * 0.65)));
    const gains = [0.24, 0.21, 0.17, 0.13, 0.09, 0.06].map((g) => g * amount);
    const a = new Float32Array(left);
    const b = new Float32Array(right);
    for (let k = 0; k < delays.length; k += 1) {
      const delay = delays[k];
      const gain = gains[k];
      for (let i = delay; i < left.length; i += 1) {
        const decay = Math.exp(-(i - delay) / (sampleRate * (0.18 + amount * 1.05)));
        left[i] += b[i - delay] * gain * decay;
        right[i] += a[i - delay] * gain * decay;
      }
    }
  }

  function normalize(left, right, target) {
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    if (peak < 0.001) return;
    const gain = Math.min(2.3, target / peak);
    for (let i = 0; i < left.length; i += 1) {
      left[i] = clamp(left[i] * gain, -1, 1);
      right[i] = clamp(right[i] * gain, -1, 1);
    }
  }

  function draw(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#38bdf8');
    gradient.addColorStop(0.48, '#34d399');
    gradient.addColorStop(1, '#f0abfc');
    ctx.strokeStyle = 'rgba(148,163,184,.14)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * buffer.left.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * buffer.left.length));
      let min = 1, max = -1;
      for (let i = start; i < end; i += 1) {
        const v = (buffer.left[i] + buffer.right[i]) * 0.5;
        min = Math.min(min, v); max = Math.max(max, v);
      }
      ctx.moveTo(x, height / 2 - max * height * 0.42);
      ctx.lineTo(x, height / 2 - min * height * 0.42);
    }
    ctx.stroke();
  }

  function encodeWav(buffer) {
    const channels = 2;
    const bytes = 2;
    const block = channels * bytes;
    const dataLength = buffer.left.length * block;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);
    write(view, 0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); write(view, 8, 'WAVE');
    write(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * block, true); view.setUint16(32, block, true); view.setUint16(34, 16, true);
    write(view, 36, 'data'); view.setUint32(40, dataLength, true);
    let offset = 44;
    for (let i = 0; i < buffer.left.length; i += 1) {
      view.setInt16(offset, toInt16(buffer.left[i]), true); offset += 2;
      view.setInt16(offset, toInt16(buffer.right[i]), true); offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function write(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function toInt16(value) {
    const sample = clamp(value, -1, 1);
    return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  function updateDownload(buffer, name) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(encodeWav(buffer));
    const safe = String(name || 'sfx-pro').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sfx-pro';
    link.href = downloadUrl;
    link.download = `${safe}-pro.wav`;
    link.classList.remove('hidden');
  }

  function updateOutputs() {
    ['sfxRealism', 'sfxTransient', 'sfxPolish', 'sfxAir'].forEach((id) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (input && output) output.textContent = input.value;
    });
  }

  function render() {
    const params = getParams();
    currentBuffer = synthesize(params);
    draw(currentBuffer);
    updateDownload(currentBuffer, params.id);
    updateOutputs();
    const status = $('sfxStatus');
    if (status) status.textContent = `Pro Texture 생성 완료: ${params.texture}, 고급 질감 ${params.realism.toFixed(2)}, 매끄러움 ${params.polish.toFixed(2)}`;
    const format = document.querySelector('#sfxDownloadLink')?.closest('.sfx-wave-wrap')?.querySelector('.sfx-readout .sfx-meter:nth-child(3) strong');
    if (format) format.textContent = 'Pro WAV';
  }

  async function play(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    stop(event);
    render();
    const context = getContext();
    if (context.state === 'suspended') await context.resume();
    const audioBuffer = context.createBuffer(2, currentBuffer.left.length, currentBuffer.sampleRate);
    audioBuffer.copyToChannel(currentBuffer.left, 0);
    audioBuffer.copyToChannel(currentBuffer.right, 1);
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.95;
    source.buffer = audioBuffer;
    source.connect(gain).connect(context.destination);
    activeSource = source;
    source.onended = () => { if (activeSource === source) activeSource = null; };
    source.start();
  }

  function stop(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    try { activeSource?.stop(); } catch (error) {}
    activeSource = null;
  }

  function randomize(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const textures = ['clean', 'glass', 'bell', 'impact', 'whoosh', 'hybrid'];
    const engines = ['pro', 'clean', 'impact', 'air'];
    setValue('sfxProEngine', engines[Math.floor(Math.random() * engines.length)]);
    setValue('sfxTexture', textures[Math.floor(Math.random() * textures.length)]);
    setValue('sfxRealism', (0.55 + Math.random() * 0.44).toFixed(2));
    setValue('sfxTransient', (0.25 + Math.random() * 0.65).toFixed(2));
    setValue('sfxPolish', (0.35 + Math.random() * 0.6).toFixed(2));
    setValue('sfxAir', (Math.random() * 0.75).toFixed(2));
    setValue('sfxSpace', (0.18 + Math.random() * 0.65).toFixed(2));
    setValue('sfxReverb', (Math.random() * 0.45).toFixed(2));
    setValue('sfxStereo', (0.24 + Math.random() * 0.65).toFixed(2));
    play(event);
  }

  function setValue(id, value) {
    const input = $(id);
    if (input) input.value = String(value);
  }

  function bind() {
    if (bound || !$('sfxPreviewButton') || !$('sfxProEngine')) return;
    bound = true;
    $('sfxPreviewButton').addEventListener('click', play, true);
    $('sfxStopButton')?.addEventListener('click', stop, true);
    $('sfxRandomButton')?.addEventListener('click', randomize, true);
    const ids = ['sfxProEngine', 'sfxTexture', 'sfxRealism', 'sfxTransient', 'sfxPolish', 'sfxAir', 'sfxDuration', 'sfxVolume', 'sfxStartFreq', 'sfxEndFreq', 'sfxNoise', 'sfxFilter', 'sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub'];
    ids.forEach((id) => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    setTimeout(render, 0);
  }

  function install() {
    ensureStyle();
    addProControls();
    buildTabs();
    applyAppClass();
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
(() => {
  const STYLE_ID = 'sfxMasteringStudioStyle';
  let audioContext = null;
  let activeSource = null;
  let lastRender = null;
  let downloadUrl = '';
  let installed = false;

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
      #view-sfxMaker.sfx-master-view .sfx-hero {
        background:
          radial-gradient(circle at 6% 8%, rgba(56,189,248,.32), transparent 30%),
          radial-gradient(circle at 86% 20%, rgba(168,85,247,.34), transparent 31%),
          linear-gradient(135deg,#020617,#111827 48%,#172554);
      }
      #view-sfxMaker.sfx-master-view .sfx-kicker::after { content:' MASTER'; opacity:.78; }
      .sfx-master-console {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin-top:14px;
      }
      .sfx-master-chip {
        border:1px solid rgba(255,255,255,.18);
        border-radius:16px;
        padding:10px 12px;
        background:rgba(15,23,42,.48);
        backdrop-filter:blur(14px);
        min-width:0;
      }
      .sfx-master-chip small {
        display:block;
        color:rgba(255,255,255,.58);
        font-size:10px;
        font-weight:900;
        letter-spacing:.04em;
        text-transform:uppercase;
      }
      .sfx-master-chip strong {
        display:block;
        margin-top:4px;
        color:#fff;
        font-size:13px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .sfx-master-strip {
        grid-column:1/-1;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:12px;
      }
      .sfx-master-note {
        grid-column:1/-1;
        padding:13px 14px;
        border-radius:18px;
        color:#334155;
        background:linear-gradient(135deg,rgba(14,165,233,.09),rgba(99,102,241,.08));
        border:1px solid rgba(14,165,233,.2);
        font-size:12px;
        line-height:1.45;
      }
      .sfx-master-note b { color:#0f172a; }
      .sfx-master-pill-row { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .sfx-master-pill {
        border:0;
        border-radius:999px;
        padding:8px 10px;
        font-size:11px;
        font-weight:950;
        color:#0f172a;
        background:#e0f2fe;
        cursor:pointer;
      }
      .sfx-master-pill:hover { transform:translateY(-1px); }
      #view-sfxMaker.sfx-master-view .sfx-card-head {
        background:linear-gradient(180deg,rgba(248,250,252,.96),rgba(255,255,255,.82));
      }
      #view-sfxMaker.sfx-master-view .sfx-preset.active {
        border-color:#06b6d4;
        box-shadow:0 0 0 3px rgba(6,182,212,.16), 0 16px 32px rgba(15,23,42,.13);
      }
      #view-sfxMaker.sfx-master-view .sfx-download {
        background:linear-gradient(135deg,#0891b2,#4f46e5,#a855f7);
      }
      @media (max-width:840px) {
        .sfx-master-console { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .sfx-master-strip { grid-template-columns:1fr; }
      }
      @media (max-width:560px) {
        .sfx-master-console { grid-template-columns:1fr 1fr; }
        .sfx-master-chip { padding:9px 10px; }
      }
      @media (prefers-color-scheme: dark) {
        .sfx-master-note { color:#d1d5db; background:linear-gradient(135deg,rgba(14,165,233,.13),rgba(99,102,241,.14)); border-color:rgba(14,165,233,.28); }
        .sfx-master-note b { color:#f8fafc; }
        .sfx-master-pill { color:#e0f2fe; background:#164e63; }
      }
    `;
    document.head.append(style);
  }

  function html(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild;
  }

  function rangeControl(id, label, value) {
    return html(`<div class="sfx-control"><label>${label} <output id="${id}Out">${value}</output></label><input id="${id}" type="range" min="0" max="1" step="0.01" value="${value}"></div>`);
  }

  function installUi() {
    const view = $('view-sfxMaker');
    if (!view || $('sfxMasterConsole')) return;
    view.classList.add('sfx-master-view');

    const heroTop = view.querySelector('.sfx-hero-top');
    if (heroTop) {
      const console = html(`
        <div id="sfxMasterConsole" class="sfx-master-console">
          <div class="sfx-master-chip"><small>Engine</small><strong id="sfxMasterEngineReadout">Pro Texture</strong></div>
          <div class="sfx-master-chip"><small>Texture</small><strong id="sfxMasterTextureReadout">Auto</strong></div>
          <div class="sfx-master-chip"><small>Render</small><strong id="sfxMasterRenderReadout">Studio WAV</strong></div>
          <div class="sfx-master-chip"><small>Peak</small><strong id="sfxMasterPeakReadout">-</strong></div>
        </div>
      `);
      heroTop.after(console);
    }

    const texturePanel = view.querySelector('[data-panel="texture"]') || view.querySelector('.sfx-pro-panel.active');
    if (texturePanel && !$('sfxMasterDepth')) {
      const note = html(`
        <div class="sfx-master-note">
          <b>Studio Mastering Layer</b> — 엔진/질감 선택에 따라 서로 다른 합성 경로를 사용합니다. 16비트 단일파형 느낌을 줄이려면 <b>Pro Texture + Glass</b> 또는 <b>Clean Digital + Clean</b> 조합을 추천합니다.
          <div class="sfx-master-pill-row">
            <button type="button" class="sfx-master-pill" data-master-preset="premium-ui">Premium UI</button>
            <button type="button" class="sfx-master-pill" data-master-preset="glass-bell">Glass Bell</button>
            <button type="button" class="sfx-master-pill" data-master-preset="cinematic-hit">Cinematic Hit</button>
            <button type="button" class="sfx-master-pill" data-master-preset="soft-whoosh">Soft Whoosh</button>
          </div>
        </div>
      `);
      texturePanel.prepend(note);
      texturePanel.append(
        rangeControl('sfxMasterDepth', '레이어 깊이', 0.78),
        rangeControl('sfxMasterBody', '바디', 0.46),
        rangeControl('sfxMasterShine', '샤인', 0.52),
        rangeControl('sfxMasterComp', '컴프레서', 0.58)
      );
    }

    const spacePanel = view.querySelector('[data-panel="space"]');
    if (spacePanel && !$('sfxMasterWidth')) {
      spacePanel.append(
        rangeControl('sfxMasterWidth', '마스터 폭', 0.58),
        rangeControl('sfxMasterTail', '테일', 0.34)
      );
    }
  }

  function getContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function parseArp(text) {
    const values = String(text || '0').split(',').map((v) => Number.parseFloat(v.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function inferTexture(id, engine) {
    const key = String(id || '').toLowerCase();
    if (engine === 'impact') return 'impact';
    if (engine === 'air') return 'whoosh';
    if (/hit|land|explosion|fail|impact/.test(key)) return 'impact';
    if (/heal|magic|success|notify|coin|pickup|power|bell/.test(key)) return 'glass';
    if (/warning|portal|laser|glitch/.test(key)) return 'hybrid';
    if (/menu|click|confirm|cancel|typing|ui/.test(key)) return 'clean';
    return 'hybrid';
  }

  function params() {
    const engine = $('sfxProEngine')?.value || 'pro';
    const id = $('sfxNameInput')?.value || 'studio-sfx';
    let texture = $('sfxTexture')?.value || 'auto';
    if (texture === 'auto') texture = inferTexture(id, engine);
    const realism = readNum('sfxRealism', 0.78);
    return {
      id,
      engine,
      texture,
      duration: readNum('sfxDuration', 0.25),
      volume: readNum('sfxVolume', 0.55),
      startFreq: readNum('sfxStartFreq', 640),
      endFreq: readNum('sfxEndFreq', 960),
      attack: readNum('sfxAttack', 0.004),
      decay: readNum('sfxDecay', 0.1),
      sustain: readNum('sfxSustain', 0.25),
      release: readNum('sfxRelease', 0.06),
      noise: readNum('sfxNoise', 0.04),
      filter: readNum('sfxFilter', 8200),
      vibratoDepth: readNum('sfxVibratoDepth', 0.01),
      vibratoRate: readNum('sfxVibratoRate', 8),
      punch: readNum('sfxPunch', 0.25),
      arpeggio: parseArp($('sfxArpeggio')?.value || '0'),
      space: readNum('sfxSpace', 0.34),
      reverb: readNum('sfxReverb', 0.22),
      stereo: readNum('sfxStereo', 0.42),
      brightness: readNum('sfxBrightness', 0.55),
      sub: readNum('sfxSub', 0.18),
      realism,
      transient: readNum('sfxTransient', 0.45),
      polish: readNum('sfxPolish', 0.68),
      air: readNum('sfxAir', 0.38),
      depth: readNum('sfxMasterDepth', 0.78),
      body: readNum('sfxMasterBody', 0.46),
      shine: readNum('sfxMasterShine', 0.52),
      comp: readNum('sfxMasterComp', 0.58),
      width: readNum('sfxMasterWidth', 0.58),
      tail: readNum('sfxMasterTail', 0.34),
    };
  }

  function envelope(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) return lerp(1, p.sustain, (t - p.attack) / Math.max(0.0001, p.decay));
    if (t > p.duration - p.release) return Math.max(0, p.sustain * ((p.duration - t) / Math.max(0.0001, p.release)));
    return p.sustain;
  }

  function engineProfile(p) {
    const profile = {
      clean: { modal: 0.18, fm: 0.16, noise: 0.018, sub: 0.05, air: 0.12, decay: 1.1, drive: 1.04 },
      pro: { modal: 0.58, fm: 0.48, noise: 0.08, sub: 0.16, air: 0.26, decay: 0.72, drive: 1.12 },
      impact: { modal: 0.28, fm: 0.22, noise: 0.66, sub: 0.72, air: 0.18, decay: 1.55, drive: 1.58 },
      air: { modal: 0.06, fm: 0.08, noise: 0.9, sub: 0.04, air: 0.88, decay: 0.55, drive: 1.02 },
    }[p.engine] || { modal: 0.5, fm: 0.42, noise: 0.1, sub: 0.16, air: 0.3, decay: 0.8, drive: 1.1 };
    const textureBoost = {
      clean: { modal: .65, fm: .65, noise: .35, sub: .5, air: .55 },
      glass: { modal: 1.45, fm: 1.2, noise: .45, sub: .5, air: .9 },
      bell: { modal: 1.35, fm: 1.0, noise: .25, sub: .42, air: .75 },
      impact: { modal: .7, fm: .7, noise: 1.55, sub: 1.65, air: .6 },
      whoosh: { modal: .18, fm: .25, noise: 1.75, sub: .22, air: 1.7 },
      hybrid: { modal: 1.05, fm: 1.05, noise: .85, sub: .8, air: 1.0 },
    }[p.texture] || { modal: 1, fm: 1, noise: 1, sub: 1, air: 1 };
    return {
      modal: profile.modal * textureBoost.modal * lerp(0.2, 1.25, p.depth),
      fm: profile.fm * textureBoost.fm * lerp(0.15, 1.3, p.realism),
      noise: profile.noise * textureBoost.noise * lerp(0.25, 1.25, p.air),
      sub: profile.sub * textureBoost.sub * (0.35 + p.body * 1.15),
      air: profile.air * textureBoost.air * (0.25 + p.shine * 1.25),
      decay: profile.decay,
      drive: profile.drive,
    };
  }

  function ratiosFor(texture, depth) {
    const banks = {
      clean: [1, 2.002, 3.004, 4.01],
      glass: [1, 2.01, 2.72, 3.95, 5.43, 7.16, 9.35, 12.1],
      bell: [1, 1.49, 2.22, 2.92, 4.19, 6.28, 8.72],
      impact: [0.5, 1, 1.31, 1.93, 2.84, 4.4],
      whoosh: [0.35, 0.7, 1.1, 1.72],
      hybrid: [1, 1.5, 2.01, 2.97, 4.03, 5.9, 8.1],
    };
    const source = banks[texture] || banks.hybrid;
    return source.slice(0, Math.max(2, Math.round(lerp(2, source.length, depth))));
  }

  function renderBuffer(p) {
    const sampleRate = 48000;
    const tail = 0.03 + p.tail * 0.5 + p.reverb * 0.55 + p.space * 0.12;
    const total = Math.max(1, Math.floor((p.duration + tail) * sampleRate));
    const dry = Math.max(1, Math.floor(p.duration * sampleRate));
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const prof = engineProfile(p);
    const ratios = ratiosFor(p.texture, p.depth);
    const phases = ratios.map((_, i) => i * 1.37 + 0.1);
    const amps = ratios.map((_, i) => Math.pow(1 / (1 + i * 0.55), lerp(1.8, 0.62, p.depth)));
    let car = 0.3, mod = 1.8, sub = 0, air = 0, airBand = 0, prevAir = 0;

    for (let i = 0; i < dry; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, dry - 1);
      const arp = p.arpeggio[Math.min(p.arpeggio.length - 1, Math.floor(n * p.arpeggio.length))] || 0;
      const pitchCurve = p.engine === 'impact' ? Math.pow(n, 1.28) : p.engine === 'air' ? Math.pow(n, 0.44) : Math.pow(n, lerp(0.58, 0.96, p.polish));
      const freq = Math.max(22, lerp(p.startFreq, p.endFreq, pitchCurve) * Math.pow(2, arp / 12));
      const vib = 1 + Math.sin(t * Math.PI * 2 * p.vibratoRate) * p.vibratoDepth * (0.2 + p.depth * 0.55);
      const f = freq * vib;
      const env = envelope(t, p);
      const snap = Math.exp(-n * lerp(48, 180, p.transient));
      const bodyDecay = Math.exp(-n * (prof.decay + 0.3 + ratios.length * 0.04));
      const slow = Math.exp(-n * lerp(1.1, 2.8, p.polish));
      const quick = Math.exp(-n * (12 + p.transient * 55));

      mod += (Math.PI * 2 * f * (1.35 + p.depth * 2.1 + p.shine * 1.2)) / sampleRate;
      car += (Math.PI * 2 * f) / sampleRate;
      sub += (Math.PI * 2 * Math.max(20, f * 0.5)) / sampleRate;

      const fmIndex = prof.fm * (0.2 + snap * 0.8 + p.depth * 0.9);
      const fm = Math.sin(car + Math.sin(mod) * fmIndex + Math.sin(mod * 0.497) * fmIndex * 0.42) * env;

      let modal = 0;
      for (let r = 0; r < ratios.length; r += 1) {
        const detune = 1 + Math.sin(r * 17.31 + p.width * 4.7) * p.depth * 0.006;
        phases[r] += (Math.PI * 2 * f * ratios[r] * detune) / sampleRate;
        const decay = Math.exp(-n * lerp(8 + r * 2.1, 0.5 + r * 0.35, p.depth));
        modal += Math.sin(phases[r]) * amps[r] * decay;
      }
      modal *= prof.modal * env * (0.32 + bodyDecay * 0.9);

      const raw = Math.random() * 2 - 1;
      const airRate = p.engine === 'air' ? lerp(0.04, 0.012, p.polish) : lerp(0.22, 0.055, p.polish);
      air += (raw - air) * airRate;
      airBand += ((air - prevAir) - airBand) * lerp(0.44, 0.11, p.polish);
      prevAir = air;
      const airLayer = (airBand * (0.55 + p.shine * 1.1) + air * 0.16) * (prof.noise + prof.air + p.noise * 0.45) * (p.engine === 'air' ? slow : quick * 0.65 + slow * 0.14);
      const shine = (Math.random() * 2 - 1) * p.shine * p.depth * 0.18 * Math.exp(-n * lerp(18, 4, p.depth));
      const transient = transientLayer(n, p) * p.transient * (0.45 + p.depth * 1.2);
      const low = Math.sin(sub) * p.sub * prof.sub * (p.engine === 'impact' ? quick * 1.8 : slow * 0.35);
      const cleanCore = Math.sin(car) * env * lerp(0.35, 0.02, p.depth);

      let mono = cleanCore + fm * lerp(0.22, 1.0, p.depth) + modal + airLayer + shine + transient + low;
      mono *= p.volume * (1 + p.punch * quick * lerp(0.25, 1.4, p.depth));
      mono = Math.tanh(mono * prof.drive) / Math.tanh(prof.drive);
      mono = tone(mono, p, n);

      const pan = Math.sin(n * Math.PI * (1.2 + p.space * 2.4)) * (p.stereo + p.width * 0.55) * 0.42;
      const micro = raw * p.width * p.depth * 0.02;
      left[i] += mono * (0.94 - pan) + micro;
      right[i] += mono * (0.94 + pan) - micro;
    }

    applyStudioFx(left, right, sampleRate, p);
    master(left, right, p);
    return { left, right, sampleRate };
  }

  function transientLayer(n, p) {
    const click = (Math.random() * 2 - 1) * Math.exp(-n * 220) * 0.12;
    const tick = Math.sin(n * Math.PI * 2 * (96 + p.shine * 340)) * Math.exp(-n * 105) * 0.1;
    const thump = Math.sin(n * Math.PI * 2 * 32) * Math.exp(-n * 38) * (p.texture === 'impact' || p.engine === 'impact' ? 0.7 : 0.08);
    return click + tick + thump;
  }

  function tone(x, p, n) {
    const tailSoft = 1 - Math.max(0, n - 0.82) * p.polish * 0.42;
    const bright = 0.88 + p.brightness * 0.15 + p.shine * 0.12;
    return x * bright * tailSoft;
  }

  function applyStudioFx(left, right, sampleRate, p) {
    const cutoff = clamp(p.filter * (0.32 + p.brightness * 0.92 + p.shine * 0.34), 160, 19000);
    const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
    let lpL = 0, lpR = 0, prevL = 0, prevR = 0;
    for (let i = 0; i < left.length; i += 1) {
      lpL += alpha * (left[i] - lpL);
      lpR += alpha * (right[i] - lpR);
      const hpL = left[i] - prevL;
      const hpR = right[i] - prevR;
      prevL = left[i]; prevR = right[i];
      left[i] = lpL * (0.72 + p.polish * 0.28) + hpL * p.shine * 0.08;
      right[i] = lpR * (0.72 + p.polish * 0.28) + hpR * p.shine * 0.08;
    }
    stereoWidener(left, right, sampleRate, clamp(p.width + p.stereo * 0.5, 0, 1));
    reverb(left, right, sampleRate, p);
  }

  function stereoWidener(left, right, sampleRate, amount) {
    if (amount <= 0.01) return;
    const l = new Float32Array(left);
    const r = new Float32Array(right);
    const base = Math.floor(sampleRate * 0.004);
    const depth = Math.floor(sampleRate * (0.001 + amount * 0.006));
    for (let i = base + depth; i < left.length; i += 1) {
      const wobble = Math.floor(Math.sin(i / sampleRate * Math.PI * 2 * 0.73) * depth);
      const d = base + wobble;
      left[i] += r[i - d] * amount * 0.09;
      right[i] += l[i - d] * amount * 0.09;
    }
  }

  function reverb(left, right, sampleRate, p) {
    const amount = p.reverb * (0.15 + p.tail * 1.35);
    if (amount <= 0.01) return;
    const delays = [0.017, 0.029, 0.043, 0.071, 0.109, 0.163].map((sec) => Math.floor(sec * sampleRate * (0.85 + p.space * 0.75)));
    const gains = [0.23, 0.2, 0.17, 0.13, 0.09, 0.06].map((g) => g * amount);
    const l = new Float32Array(left);
    const r = new Float32Array(right);
    for (let k = 0; k < delays.length; k += 1) {
      const delay = delays[k];
      const gain = gains[k];
      for (let i = delay; i < left.length; i += 1) {
        const decay = Math.exp(-(i - delay) / (sampleRate * (0.16 + amount * 1.15)));
        left[i] += r[i - delay] * gain * decay;
        right[i] += l[i - delay] * gain * decay;
      }
    }
  }

  function master(left, right, p) {
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const makeup = peak > 0.001 ? Math.min(2.4, 0.92 / peak) : 1;
    const comp = clamp(p.comp, 0, 1);
    for (let i = 0; i < left.length; i += 1) {
      left[i] = compressor(left[i] * makeup, comp);
      right[i] = compressor(right[i] * makeup, comp);
    }
  }

  function compressor(x, amount) {
    const threshold = lerp(0.92, 0.48, amount);
    const ratio = lerp(1.1, 4.8, amount);
    const sign = Math.sign(x);
    const a = Math.abs(x);
    if (a <= threshold) return clamp(x, -1, 1);
    const over = a - threshold;
    const compressed = threshold + over / ratio;
    return clamp(Math.tanh(compressed * 1.08) * sign, -1, 1);
  }

  function draw(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#67e8f9');
    grad.addColorStop(0.42, '#818cf8');
    grad.addColorStop(1, '#f0abfc');
    ctx.strokeStyle = 'rgba(148,163,184,.14)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < w; x += 1) {
      const a = Math.floor((x / w) * buffer.left.length);
      const b = Math.max(a + 1, Math.floor(((x + 1) / w) * buffer.left.length));
      let min = 1, max = -1;
      for (let i = a; i < b; i += 1) {
        const v = (buffer.left[i] + buffer.right[i]) * 0.5;
        min = Math.min(min, v); max = Math.max(max, v);
      }
      ctx.moveTo(x, h / 2 - max * h * 0.42);
      ctx.lineTo(x, h / 2 - min * h * 0.42);
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

  function toInt16(v) {
    const sample = clamp(v, -1, 1);
    return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  function write(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function updateDownload(buffer, name) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(encodeWav(buffer));
    const safe = String(name || 'studio-sfx').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'studio-sfx';
    link.href = downloadUrl;
    link.download = `${safe}-studio.wav`;
    link.classList.remove('hidden');
  }

  function render() {
    const p = params();
    lastRender = renderBuffer(p);
    draw(lastRender);
    updateDownload(lastRender, p.id);
    updateReadout(p, lastRender);
    return { p, buffer: lastRender };
  }

  function updateReadout(p, buffer) {
    const engineLabel = $('sfxProEngine')?.selectedOptions?.[0]?.textContent || p.engine;
    const textureLabel = $('sfxTexture')?.selectedOptions?.[0]?.textContent || p.texture;
    if ($('sfxMasterEngineReadout')) $('sfxMasterEngineReadout').textContent = engineLabel;
    if ($('sfxMasterTextureReadout')) $('sfxMasterTextureReadout').textContent = textureLabel === 'Auto' ? p.texture : textureLabel;
    if ($('sfxMasterRenderReadout')) $('sfxMasterRenderReadout').textContent = '48kHz Stereo';
    let peak = 0;
    for (let i = 0; i < buffer.left.length; i += 1) peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
    const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
    if ($('sfxMasterPeakReadout')) $('sfxMasterPeakReadout').textContent = `${db.toFixed(1)} dB`;
    const status = $('sfxStatus');
    if (status) status.textContent = `Studio Render: ${engineLabel} / ${p.texture}, depth ${p.depth.toFixed(2)}, body ${p.body.toFixed(2)}, shine ${p.shine.toFixed(2)}`;
    const format = document.querySelector('#sfxDownloadLink')?.closest('.sfx-wave-wrap')?.querySelector('.sfx-readout .sfx-meter:nth-child(3) strong');
    if (format) format.textContent = 'Studio WAV';
    ['sfxMasterDepth','sfxMasterBody','sfxMasterShine','sfxMasterComp','sfxMasterWidth','sfxMasterTail'].forEach((id) => {
      const input = $(id);
      const out = $(`${id}Out`);
      if (input && out) out.textContent = input.value;
    });
  }

  async function play(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    stop(event);
    const { buffer } = render();
    const ctx = getContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const audioBuffer = ctx.createBuffer(2, buffer.left.length, buffer.sampleRate);
    audioBuffer.copyToChannel(buffer.left, 0);
    audioBuffer.copyToChannel(buffer.right, 1);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = 0.96;
    source.buffer = audioBuffer;
    source.connect(gain).connect(ctx.destination);
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

  function set(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = String(value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyMasterPreset(name) {
    if (name === 'premium-ui') {
      set('sfxProEngine', 'clean'); set('sfxTexture', 'clean'); set('sfxRealism', 0.82); set('sfxMasterDepth', 0.68); set('sfxMasterBody', 0.24); set('sfxMasterShine', 0.42); set('sfxMasterComp', 0.42); set('sfxReverb', 0.08); set('sfxMasterTail', 0.12);
    } else if (name === 'glass-bell') {
      set('sfxProEngine', 'pro'); set('sfxTexture', 'glass'); set('sfxRealism', 0.94); set('sfxMasterDepth', 0.92); set('sfxMasterBody', 0.32); set('sfxMasterShine', 0.78); set('sfxReverb', 0.28); set('sfxMasterTail', 0.42);
    } else if (name === 'cinematic-hit') {
      set('sfxProEngine', 'impact'); set('sfxTexture', 'impact'); set('sfxRealism', 0.9); set('sfxMasterDepth', 0.76); set('sfxMasterBody', 0.82); set('sfxMasterShine', 0.2); set('sfxMasterComp', 0.82); set('sfxReverb', 0.18); set('sfxMasterTail', 0.26);
    } else if (name === 'soft-whoosh') {
      set('sfxProEngine', 'air'); set('sfxTexture', 'whoosh'); set('sfxRealism', 0.88); set('sfxMasterDepth', 0.84); set('sfxMasterBody', 0.18); set('sfxMasterShine', 0.58); set('sfxAir', 0.82); set('sfxReverb', 0.24); set('sfxMasterTail', 0.38);
    }
    render();
  }

  function randomize(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const combos = [
      ['clean', 'clean'], ['pro', 'glass'], ['pro', 'bell'], ['impact', 'impact'], ['air', 'whoosh'], ['pro', 'hybrid'],
    ];
    const [engine, texture] = combos[Math.floor(Math.random() * combos.length)];
    set('sfxProEngine', engine);
    set('sfxTexture', texture);
    set('sfxRealism', (0.62 + Math.random() * 0.36).toFixed(2));
    set('sfxMasterDepth', (0.45 + Math.random() * 0.52).toFixed(2));
    set('sfxMasterBody', (0.18 + Math.random() * 0.72).toFixed(2));
    set('sfxMasterShine', (0.18 + Math.random() * 0.74).toFixed(2));
    set('sfxMasterWidth', (0.25 + Math.random() * 0.68).toFixed(2));
    set('sfxMasterTail', (Math.random() * 0.55).toFixed(2));
    play(event);
  }

  function bind() {
    if (installed || !$('sfxPreviewButton') || !$('sfxProEngine')) return;
    installed = true;
    $('sfxPreviewButton').addEventListener('click', play, true);
    $('sfxStopButton')?.addEventListener('click', stop, true);
    $('sfxRandomButton')?.addEventListener('click', randomize, true);
    document.addEventListener('click', (event) => {
      const preset = event.target?.closest?.('[data-master-preset]');
      if (!preset) return;
      applyMasterPreset(preset.dataset.masterPreset);
    });
    const ids = ['sfxProEngine','sfxTexture','sfxRealism','sfxTransient','sfxPolish','sfxAir','sfxDuration','sfxVolume','sfxStartFreq','sfxEndFreq','sfxNoise','sfxFilter','sfxSpace','sfxReverb','sfxStereo','sfxBrightness','sfxSub','sfxMasterDepth','sfxMasterBody','sfxMasterShine','sfxMasterComp','sfxMasterWidth','sfxMasterTail','sfxAttack','sfxDecay','sfxSustain','sfxRelease','sfxVibratoDepth','sfxVibratoRate','sfxPunch','sfxArpeggio'];
    ids.forEach((id) => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    setTimeout(render, 0);
  }

  function install() {
    ensureStyle();
    installUi();
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
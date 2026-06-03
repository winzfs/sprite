(() => {
  const STYLE_ID = 'sfxModernTextureStyle';
  let audioContext = null;
  let sourceNode = null;
  let rendered = null;
  let downloadUrl = '';
  let bound = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function readNum(id, fallback) {
    const n = Number.parseFloat($(id)?.value || String(fallback));
    return Number.isFinite(n) ? n : fallback;
  }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sfx-modern-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 9px; border-radius:999px; background:linear-gradient(135deg,rgba(14,165,233,.16),rgba(16,185,129,.16)); color:#0369a1; font-size:11px; font-weight:950; border:1px solid rgba(14,165,233,.22); }
      .sfx-modern-note { grid-column:1/-1; border:1px solid rgba(14,165,233,.22); border-radius:18px; padding:12px 14px; background:linear-gradient(135deg,rgba(14,165,233,.08),rgba(16,185,129,.08)); color:#475569; font-size:12px; line-height:1.45; }
      @media (prefers-color-scheme: dark) { .sfx-modern-badge { color:#bae6fd; } .sfx-modern-note { color:#d1d5db; background:linear-gradient(135deg,rgba(14,165,233,.14),rgba(16,185,129,.1)); border-color:rgba(14,165,233,.32); } }
    `;
    document.head.append(style);
  }

  function addTextureControls() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!grid || $('sfxTexture')) return;
    const note = document.createElement('div');
    note.className = 'sfx-modern-note';
    note.innerHTML = `<span class="sfx-modern-badge">🎚️ Modern Texture Engine</span> 단순 16비트 파형 대신 FM, 모달 공진, 부드러운 노이즈, 트랜지언트 레이어로 더 현대적인 효과음을 만듭니다.`;
    const texture = document.createElement('div');
    texture.className = 'sfx-control';
    texture.innerHTML = `<label>질감</label><select id="sfxTexture"><option value="auto" selected>Auto</option><option value="clean">Clean</option><option value="glass">Glass</option><option value="bell">Soft Bell</option><option value="impact">Impact</option><option value="whoosh">Whoosh</option><option value="hybrid">Hybrid</option></select>`;
    const realism = html(`<div class="sfx-control"><label>고급 질감 <output id="sfxRealismOut">0.75</output></label><input id="sfxRealism" type="range" min="0" max="1" step="0.01" value="0.75"></div>`);
    const transient = html(`<div class="sfx-control"><label>트랜지언트 <output id="sfxTransientOut">0.45</output></label><input id="sfxTransient" type="range" min="0" max="1" step="0.01" value="0.45"></div>`);
    grid.append(note, texture, realism, transient);
  }

  function html(text) {
    const t = document.createElement('template');
    t.innerHTML = text.trim();
    return t.content.firstElementChild;
  }

  function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function getParams() {
    const style = $('sfxSoundStyle')?.value || 'modern';
    const id = $('sfxNameInput')?.value || 'modern-sfx';
    let texture = $('sfxTexture')?.value || 'auto';
    if (texture === 'auto') texture = inferTexture(id, style);
    return {
      id,
      texture,
      style,
      duration: readNum('sfxDuration', 0.28),
      volume: readNum('sfxVolume', 0.5),
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
      arpeggio: parseArp($('sfxArpeggio')?.value || '0'),
      space: readNum('sfxSpace', 0.35),
      reverb: readNum('sfxReverb', 0.22),
      stereo: readNum('sfxStereo', 0.42),
      brightness: readNum('sfxBrightness', 0.55),
      sub: readNum('sfxSub', 0.18),
      realism: readNum('sfxRealism', 0.75),
      transient: readNum('sfxTransient', 0.45),
    };
  }

  function inferTexture(id, style) {
    const key = String(id).toLowerCase();
    if (style === 'retro') return 'hybrid';
    if (/hit|land|explosion|fail|impact/.test(key)) return 'impact';
    if (/heal|magic|success|notify|coin|pickup|power/.test(key)) return 'glass';
    if (/warning|portal|laser|glitch/.test(key)) return 'hybrid';
    if (/menu|click|confirm|cancel|typing/.test(key)) return 'clean';
    return 'hybrid';
  }

  function parseArp(text) {
    const values = String(text).split(',').map((x) => Number.parseFloat(x.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function env(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) return lerp(1, p.sustain, (t - p.attack) / Math.max(0.0001, p.decay));
    if (t > p.duration - p.release) return Math.max(0, p.sustain * ((p.duration - t) / Math.max(0.0001, p.release)));
    return p.sustain;
  }

  function synthesize(p) {
    const sampleRate = 48000;
    const tail = p.reverb * (p.texture === 'impact' ? 0.25 : 0.65) + p.space * 0.18;
    const length = Math.max(1, Math.floor((p.duration + tail) * sampleRate));
    const dry = Math.max(1, Math.floor(p.duration * sampleRate));
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    const modal = modalRatios(p.texture);
    const modalPhase = modal.map((_, i) => i * 1.618);
    const modalAmp = modal.map((_, i) => 1 / (1 + i * 0.8));
    let fmPhase = 0;
    let carrierPhase = 0.4;
    let subPhase = 0;
    let noiseLp = 0;
    let noiseBp = 0;
    let lastNoiseLp = 0;

    for (let i = 0; i < dry; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, dry - 1);
      const arp = p.arpeggio[Math.min(p.arpeggio.length - 1, Math.floor(n * p.arpeggio.length))] || 0;
      const pitch = lerp(p.startFreq, p.endFreq, Math.pow(n, p.texture === 'impact' ? 1.25 : 0.78)) * Math.pow(2, arp / 12);
      const vibrato = 1 + Math.sin(t * Math.PI * 2 * p.vibratoRate) * p.vibratoDepth * 0.55;
      const freq = Math.max(24, pitch * vibrato);
      const e = env(t, p);
      const quick = Math.exp(-n * (12 + p.transient * 30));
      const slow = Math.exp(-n * (2.2 + p.realism * 2));

      fmPhase += (Math.PI * 2 * freq * (1.5 + p.brightness * 1.2)) / sampleRate;
      carrierPhase += (Math.PI * 2 * freq) / sampleRate;
      subPhase += (Math.PI * 2 * Math.max(24, freq * 0.5)) / sampleRate;
      const fmIndex = textureFm(p.texture) * p.realism * (0.2 + quick * 0.8);
      const fm = Math.sin(carrierPhase + Math.sin(fmPhase) * fmIndex) * e;

      let body = 0;
      for (let m = 0; m < modal.length; m += 1) {
        const ratio = modal[m];
        const detune = 1 + Math.sin(m * 12.989 + p.space) * 0.003 * p.realism;
        modalPhase[m] += (Math.PI * 2 * freq * ratio * detune) / sampleRate;
        const decay = Math.exp(-n * (1.5 + m * 1.4 + (p.texture === 'glass' ? 0.2 : 1.0)));
        body += Math.sin(modalPhase[m]) * modalAmp[m] * decay;
      }
      body *= modalMix(p.texture) * e;

      const rawNoise = Math.random() * 2 - 1;
      noiseLp += (rawNoise - noiseLp) * (p.texture === 'whoosh' ? 0.025 : 0.08 + p.brightness * 0.1);
      noiseBp += ((noiseLp - lastNoiseLp) - noiseBp) * 0.25;
      lastNoiseLp = noiseLp;
      const air = (noiseBp * (0.16 + p.brightness * 0.24) + noiseLp * 0.08) * (p.noise + textureNoise(p.texture)) * (p.texture === 'whoosh' ? slow : quick);

      const transient = transientLayer(n, p) * p.transient;
      const sub = Math.sin(subPhase) * p.sub * (p.texture === 'impact' ? quick : slow * 0.45);
      let mono = (fm * fmMix(p.texture) + body + air + transient + sub) * p.volume * (1 + p.punch * quick * 1.4);
      mono = saturate(mono, p.texture === 'impact' ? 1.45 : 1.12);
      mono = toneShape(mono, p, n);

      const pan = Math.sin(n * Math.PI * 1.7 + p.space * 2.4) * p.stereo * 0.5;
      const widthNoise = rawNoise * p.stereo * 0.012 * p.realism;
      left[i] += mono * (0.92 - pan) + widthNoise;
      right[i] += mono * (0.92 + pan) - widthNoise;
    }

    applyModernFx(left, right, sampleRate, p);
    normalize(left, right, 0.92);
    return { left, right, sampleRate };
  }

  function modalRatios(texture) {
    if (texture === 'glass') return [1, 2.01, 2.72, 3.96, 5.41, 7.12];
    if (texture === 'bell') return [1, 1.51, 2.23, 2.91, 4.18, 6.27];
    if (texture === 'impact') return [0.5, 1, 1.32, 1.91, 2.8];
    if (texture === 'whoosh') return [0.5, 0.75, 1.12, 1.8];
    if (texture === 'clean') return [1, 2, 3.01];
    return [1, 1.49, 2.02, 2.98, 4.01];
  }

  function textureFm(texture) {
    return { clean: 0.18, glass: 1.1, bell: 0.78, impact: 0.35, whoosh: 0.12, hybrid: 0.65 }[texture] ?? 0.5;
  }

  function modalMix(texture) {
    return { clean: 0.14, glass: 0.48, bell: 0.42, impact: 0.22, whoosh: 0.08, hybrid: 0.28 }[texture] ?? 0.25;
  }

  function fmMix(texture) {
    return { clean: 0.24, glass: 0.18, bell: 0.16, impact: 0.2, whoosh: 0.08, hybrid: 0.28 }[texture] ?? 0.22;
  }

  function textureNoise(texture) {
    return { clean: 0.02, glass: 0.03, bell: 0.015, impact: 0.42, whoosh: 0.62, hybrid: 0.1 }[texture] ?? 0.06;
  }

  function transientLayer(n, p) {
    const snap = Math.exp(-n * 120) * (Math.random() * 2 - 1) * 0.18;
    const tick = Math.sin(n * Math.PI * 2 * (80 + p.brightness * 180)) * Math.exp(-n * 85) * 0.12;
    const thump = Math.sin(n * Math.PI * 2 * 36) * Math.exp(-n * 34) * (p.texture === 'impact' ? 0.46 : 0.08);
    return snap + tick + thump;
  }

  function saturate(x, drive) {
    return Math.tanh(x * drive) / Math.tanh(drive);
  }

  function toneShape(x, p, n) {
    const soft = p.texture === 'clean' || p.texture === 'bell' || p.texture === 'glass';
    const brightness = soft ? p.brightness * 0.12 : p.brightness * 0.2;
    return x * (0.92 + brightness) * (1 - Math.max(0, n - 0.88) * 0.3);
  }

  function applyModernFx(left, right, sampleRate, p) {
    const cutoff = clamp(p.filter * (0.55 + p.brightness * 0.85), 200, 19000);
    const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
    let lpL = 0, lpR = 0, prevL = 0, prevR = 0;
    for (let i = 0; i < left.length; i += 1) {
      lpL += alpha * (left[i] - lpL);
      lpR += alpha * (right[i] - lpR);
      const hpL = left[i] - prevL;
      const hpR = right[i] - prevR;
      prevL = left[i]; prevR = right[i];
      left[i] = lpL + hpL * p.brightness * 0.08;
      right[i] = lpR + hpR * p.brightness * 0.08;
    }
    chorus(left, right, sampleRate, p.stereo * p.realism);
    reverb(left, right, sampleRate, p);
  }

  function chorus(left, right, sampleRate, amount) {
    if (amount <= 0.01) return;
    const copyL = new Float32Array(left);
    const copyR = new Float32Array(right);
    const depth = Math.floor(sampleRate * (0.002 + amount * 0.004));
    const base = Math.floor(sampleRate * 0.006);
    for (let i = base + depth; i < left.length; i += 1) {
      const wobble = Math.floor(Math.sin(i / sampleRate * Math.PI * 2 * 0.85) * depth);
      const d = base + wobble;
      left[i] += copyR[i - d] * amount * 0.08;
      right[i] += copyL[i - d] * amount * 0.08;
    }
  }

  function reverb(left, right, sampleRate, p) {
    const amount = p.reverb;
    if (amount <= 0.01) return;
    const delays = [0.023, 0.037, 0.061, 0.097, 0.149].map((s) => Math.floor(s * sampleRate * (0.8 + p.space * 0.55)));
    const gains = [0.26, 0.21, 0.16, 0.11, 0.08].map((g) => g * amount);
    const copyL = new Float32Array(left);
    const copyR = new Float32Array(right);
    for (let k = 0; k < delays.length; k += 1) {
      const d = delays[k];
      const g = gains[k];
      for (let i = d; i < left.length; i += 1) {
        const decay = Math.exp(-(i - d) / (sampleRate * (0.22 + amount * 0.9)));
        left[i] += copyR[i - d] * g * decay;
        right[i] += copyL[i - d] * g * decay;
      }
    }
  }

  function normalize(left, right, target) {
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    if (peak < 0.001) return;
    const gain = Math.min(2.2, target / peak);
    for (let i = 0; i < left.length; i += 1) {
      left[i] = clamp(left[i] * gain, -1, 1);
      right[i] = clamp(right[i] * gain, -1, 1);
    }
  }

  function draw(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#34d399');
    grad.addColorStop(1, '#f0abfc');
    ctx.strokeStyle = 'rgba(148,163,184,.14)';
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

  function wav(buffer) {
    const channels = 2, bytes = 2, block = channels * bytes;
    const dataLength = buffer.left.length * block;
    const ab = new ArrayBuffer(44 + dataLength);
    const view = new DataView(ab);
    write(view, 0, 'RIFF'); view.setUint32(4, 36 + dataLength, true); write(view, 8, 'WAVE');
    write(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * block, true); view.setUint16(32, block, true); view.setUint16(34, 16, true);
    write(view, 36, 'data'); view.setUint32(40, dataLength, true);
    let off = 44;
    for (let i = 0; i < buffer.left.length; i += 1) {
      view.setInt16(off, to16(buffer.left[i]), true); off += 2;
      view.setInt16(off, to16(buffer.right[i]), true); off += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function to16(v) {
    const s = clamp(v, -1, 1);
    return s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  function write(view, off, str) {
    for (let i = 0; i < str.length; i += 1) view.setUint8(off + i, str.charCodeAt(i));
  }

  function download(buffer, id) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(wav(buffer));
    const safe = String(id || 'modern-sfx').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'modern-sfx';
    link.href = downloadUrl;
    link.download = `${safe}-modern.wav`;
    link.classList.remove('hidden');
  }

  function render() {
    const p = getParams();
    rendered = synthesize(p);
    draw(rendered);
    download(rendered, p.id);
    updateOutputs();
    const status = $('sfxStatus');
    if (status) status.textContent = `Modern Texture 생성 완료: ${p.texture}, FM/modal/noise layered stereo WAV`;
    const format = document.querySelector('#sfxDownloadLink')?.closest('.sfx-wave-wrap')?.querySelector('.sfx-readout .sfx-meter:nth-child(3) strong');
    if (format) format.textContent = 'Modern WAV';
  }

  async function play(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    stop(event);
    render();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const audio = ctx.createBuffer(2, rendered.left.length, rendered.sampleRate);
    audio.copyToChannel(rendered.left, 0);
    audio.copyToChannel(rendered.right, 1);
    const src = ctx.createBufferSource();
    src.buffer = audio;
    const gain = ctx.createGain();
    gain.gain.value = 0.95;
    src.connect(gain).connect(ctx.destination);
    sourceNode = src;
    src.onended = () => { if (sourceNode === src) sourceNode = null; };
    src.start();
  }

  function stop(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    try { sourceNode?.stop(); } catch (e) {}
    sourceNode = null;
  }

  function random(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const textures = ['clean', 'glass', 'bell', 'impact', 'whoosh', 'hybrid'];
    if ($('sfxTexture')) $('sfxTexture').value = textures[Math.floor(Math.random() * textures.length)];
    set('sfxRealism', (0.55 + Math.random() * 0.42).toFixed(2));
    set('sfxTransient', (0.25 + Math.random() * 0.65).toFixed(2));
    set('sfxSpace', (0.22 + Math.random() * 0.6).toFixed(2));
    set('sfxReverb', (Math.random() * 0.45).toFixed(2));
    set('sfxStereo', (0.25 + Math.random() * 0.65).toFixed(2));
    set('sfxBrightness', (0.35 + Math.random() * 0.55).toFixed(2));
    play(event);
  }

  function set(id, value) { const el = $(id); if (el) el.value = String(value); }

  function updateOutputs() {
    ['sfxRealism', 'sfxTransient'].forEach((id) => {
      const input = $(id), out = $(`${id}Out`);
      if (input && out) out.textContent = input.value;
    });
  }

  function bind() {
    if (bound || !$('sfxPreviewButton') || !$('sfxTexture')) return;
    bound = true;
    $('sfxPreviewButton').addEventListener('click', play, true);
    $('sfxStopButton')?.addEventListener('click', stop, true);
    $('sfxRandomButton')?.addEventListener('click', random, true);
    ['sfxTexture', 'sfxRealism', 'sfxTransient'].forEach((id) => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    setTimeout(render, 0);
  }

  function install() {
    ensureStyle();
    addTextureControls();
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
(() => {
  let audioContext = null;
  let activeSource = null;
  let lastBuffer = null;
  let downloadUrl = '';
  let bound = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function num(id, fallback) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return Number.isFinite(value) ? value : fallback;
  }
  function set(id, value) {
    const input = $(id);
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function parseArp(text) {
    const values = String(text || '0').split(',').map((item) => Number.parseFloat(item.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function inferTexture(name, engine) {
    const key = String(name || '').toLowerCase();
    if (engine === 'impact') return 'impact';
    if (engine === 'air') return 'whoosh';
    if (/hit|land|explosion|fail|impact|wood|thump/.test(key)) return 'impact';
    if (/heal|magic|success|notify|coin|pickup|power|bell|glass|chime|crystal/.test(key)) return 'glass';
    if (/warning|portal|laser|glitch|zap/.test(key)) return 'hybrid';
    if (/menu|click|confirm|cancel|typing|ui|pluck|blip/.test(key)) return 'clean';
    return 'hybrid';
  }

  function params() {
    const engine = $('sfxStudioEngine')?.value || 'pro';
    const id = $('sfxNameInput')?.value || 'studio-sfx';
    let texture = $('sfxStudioTexture')?.value || 'auto';
    if (texture === 'auto') texture = inferTexture(id, engine);
    return {
      id,
      engine,
      texture,
      wave: $('sfxWave')?.value || 'sine',
      duration: num('sfxDuration', 0.25),
      volume: num('sfxVolume', 0.55),
      startFreq: num('sfxStartFreq', 640),
      endFreq: num('sfxEndFreq', 960),
      attack: num('sfxAttack', 0.004),
      decay: num('sfxDecay', 0.1),
      sustain: num('sfxSustain', 0.25),
      release: num('sfxRelease', 0.06),
      noise: num('sfxNoise', 0.04),
      filter: num('sfxFilter', 8200),
      vibratoDepth: num('sfxVibratoDepth', 0.01),
      vibratoRate: num('sfxVibratoRate', 8),
      punch: num('sfxPunch', 0.25),
      arpeggio: parseArp($('sfxArpeggio')?.value || '0'),
      space: num('sfxSpace', 0.34),
      reverb: num('sfxReverb', 0.22),
      stereo: num('sfxStereo', 0.42),
      brightness: num('sfxBrightness', 0.55),
      sub: num('sfxSub', 0.18),
      depth: num('sfxStudioDepth', 0.78),
      body: num('sfxStudioBody', 0.46),
      shine: num('sfxStudioShine', 0.52),
      comp: num('sfxStudioComp', 0.58),
      width: num('sfxStudioWidth', 0.58),
      tail: num('sfxStudioTail', 0.34),
      air: num('sfxStudioAir', 0.38),
    };
  }

  function envelope(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) return lerp(1, p.sustain, (t - p.attack) / Math.max(0.0001, p.decay));
    if (t > p.duration - p.release) return Math.max(0, p.sustain * ((p.duration - t) / Math.max(0.0001, p.release)));
    return p.sustain;
  }

  function profile(p) {
    const engine = {
      clean: { modal: 0.16, fm: 0.14, noise: 0.018, sub: 0.04, air: 0.1, decay: 1.1, drive: 1.04 },
      pro: { modal: 0.56, fm: 0.46, noise: 0.08, sub: 0.14, air: 0.24, decay: 0.72, drive: 1.12 },
      impact: { modal: 0.28, fm: 0.22, noise: 0.66, sub: 0.75, air: 0.16, decay: 1.55, drive: 1.58 },
      air: { modal: 0.05, fm: 0.08, noise: 0.9, sub: 0.035, air: 0.88, decay: 0.55, drive: 1.02 },
    }[p.engine] || { modal: 0.5, fm: 0.4, noise: 0.1, sub: 0.14, air: 0.28, decay: 0.8, drive: 1.1 };
    const texture = {
      clean: { modal: .62, fm: .62, noise: .32, sub: .45, air: .5 },
      glass: { modal: 1.5, fm: 1.2, noise: .4, sub: .45, air: .92 },
      bell: { modal: 1.35, fm: 1.0, noise: .25, sub: .38, air: .75 },
      impact: { modal: .7, fm: .7, noise: 1.55, sub: 1.75, air: .55 },
      whoosh: { modal: .16, fm: .22, noise: 1.75, sub: .2, air: 1.75 },
      hybrid: { modal: 1.05, fm: 1.05, noise: .85, sub: .75, air: 1.0 },
    }[p.texture] || { modal: 1, fm: 1, noise: 1, sub: 1, air: 1 };
    return {
      modal: engine.modal * texture.modal * lerp(0.2, 1.25, p.depth),
      fm: engine.fm * texture.fm * lerp(0.2, 1.25, p.depth),
      noise: engine.noise * texture.noise + p.noise * (0.2 + p.air),
      sub: engine.sub * texture.sub * (0.3 + p.body * 1.2),
      air: engine.air * texture.air * (0.25 + p.shine * 1.25),
      decay: engine.decay,
      drive: engine.drive,
    };
  }

  function ratios(texture, wave, depth) {
    const banks = {
      clean: [1, 2.002, 3.004, 4.01], glass: [1, 2.01, 2.72, 3.95, 5.43, 7.16, 9.35, 12.1],
      bell: [1, 1.49, 2.22, 2.92, 4.19, 6.28, 8.72], impact: [0.5, 1, 1.31, 1.93, 2.84, 4.4],
      whoosh: [0.35, 0.7, 1.1, 1.72], hybrid: [1, 1.5, 2.01, 2.97, 4.03, 5.9, 8.1],
    };
    if (wave === 'metallic') return [1, 1.37, 2.71, 4.33, 6.89, 9.2];
    if (wave === 'crystal') return [1, 2.13, 3.01, 5.72, 8.8, 13.1];
    if (wave === 'water-drop') return [1, 1.61, 2.41, 3.7];
    const source = banks[texture] || banks.hybrid;
    return source.slice(0, Math.max(2, Math.round(lerp(2, source.length, depth))));
  }

  function renderBuffer(p) {
    const sampleRate = 48000;
    const total = Math.max(1, Math.floor((p.duration + 0.03 + p.tail * 0.5 + p.reverb * 0.55 + p.space * 0.12) * sampleRate));
    const dry = Math.max(1, Math.floor(p.duration * sampleRate));
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const prof = profile(p);
    const rs = ratios(p.texture, p.wave, p.depth);
    const phases = rs.map((_, i) => i * 1.37 + 0.1);
    const amps = rs.map((_, i) => Math.pow(1 / (1 + i * 0.55), lerp(1.8, 0.62, p.depth)));
    let car = 0.3, mod = 1.8, sub = 0, air = 0, airBand = 0, prevAir = 0;
    for (let i = 0; i < dry; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, dry - 1);
      const arp = p.arpeggio[Math.min(p.arpeggio.length - 1, Math.floor(n * p.arpeggio.length))] || 0;
      const curve = p.engine === 'impact' ? Math.pow(n, 1.28) : p.engine === 'air' ? Math.pow(n, 0.44) : Math.pow(n, 0.82);
      const freq = Math.max(22, lerp(p.startFreq, p.endFreq, curve) * Math.pow(2, arp / 12));
      const vib = 1 + Math.sin(t * Math.PI * 2 * p.vibratoRate) * p.vibratoDepth * (0.2 + p.depth * 0.55);
      const f = freq * vib;
      const e = envelope(t, p);
      const snap = Math.exp(-n * lerp(48, 180, p.depth));
      const quick = Math.exp(-n * (12 + p.depth * 55));
      const slow = Math.exp(-n * (1.1 + p.depth * 1.4));
      mod += (Math.PI * 2 * f * (1.35 + p.depth * 2.1 + p.shine * 1.2)) / sampleRate;
      car += (Math.PI * 2 * f) / sampleRate;
      sub += (Math.PI * 2 * Math.max(20, f * 0.5)) / sampleRate;
      const fmIndex = prof.fm * (0.2 + snap * 0.8 + p.depth * 0.9);
      const fm = Math.sin(car + Math.sin(mod) * fmIndex + Math.sin(mod * 0.497) * fmIndex * 0.42) * e;
      let modal = 0;
      for (let r = 0; r < rs.length; r += 1) {
        phases[r] += (Math.PI * 2 * f * rs[r] * (1 + Math.sin(r * 17.31 + p.width * 4.7) * p.depth * 0.006)) / sampleRate;
        modal += Math.sin(phases[r]) * amps[r] * Math.exp(-n * lerp(8 + r * 2.1, 0.5 + r * 0.35, p.depth));
      }
      modal *= prof.modal * e;
      const raw = Math.random() * 2 - 1;
      const airRate = p.engine === 'air' ? lerp(0.04, 0.012, p.depth) : lerp(0.22, 0.055, p.depth);
      air += (raw - air) * airRate;
      airBand += ((air - prevAir) - airBand) * lerp(0.44, 0.11, p.depth);
      prevAir = air;
      const airLayer = (airBand * (0.55 + p.shine * 1.1) + air * 0.16) * (prof.noise + prof.air) * (p.engine === 'air' ? slow : quick * 0.65 + slow * 0.14);
      const shine = raw * p.shine * p.depth * 0.16 * Math.exp(-n * lerp(18, 4, p.depth));
      const thump = Math.sin(n * Math.PI * 2 * 32) * Math.exp(-n * 38) * (p.texture === 'impact' || p.engine === 'impact' ? 0.7 : 0.08);
      const tick = Math.sin(n * Math.PI * 2 * (96 + p.shine * 340)) * Math.exp(-n * 105) * 0.1;
      const transient = ((raw * Math.exp(-n * 220) * 0.12) + tick + thump) * p.depth;
      const low = Math.sin(sub) * p.sub * prof.sub * (p.engine === 'impact' ? quick * 1.8 : slow * 0.35);
      const cleanCore = Math.sin(car) * e * lerp(0.35, 0.02, p.depth);
      let mono = cleanCore + fm * lerp(0.22, 1.0, p.depth) + modal + airLayer + shine + transient + low;
      mono *= p.volume * (1 + p.punch * quick * lerp(0.25, 1.4, p.depth));
      mono = Math.tanh(mono * prof.drive) / Math.tanh(prof.drive);
      const pan = Math.sin(n * Math.PI * (1.2 + p.space * 2.4)) * (p.stereo + p.width * 0.55) * 0.42;
      const micro = raw * p.width * p.depth * 0.02;
      left[i] += mono * (0.94 - pan) + micro;
      right[i] += mono * (0.94 + pan) - micro;
    }
    applyFx(left, right, sampleRate, p);
    master(left, right, p);
    return { left, right, sampleRate };
  }

  function applyFx(left, right, sampleRate, p) {
    const cutoff = clamp(p.filter * (0.32 + p.brightness * 0.92 + p.shine * 0.34), 160, 19000);
    const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
    let lpL = 0, lpR = 0, prevL = 0, prevR = 0;
    for (let i = 0; i < left.length; i += 1) {
      lpL += alpha * (left[i] - lpL); lpR += alpha * (right[i] - lpR);
      const hpL = left[i] - prevL, hpR = right[i] - prevR; prevL = left[i]; prevR = right[i];
      left[i] = lpL * 0.9 + hpL * p.shine * 0.06;
      right[i] = lpR * 0.9 + hpR * p.shine * 0.06;
    }
    const amount = p.reverb * (0.15 + p.tail * 1.35);
    if (amount > 0.01) {
      const delays = [0.017, 0.029, 0.043, 0.071, 0.109].map((s) => Math.floor(s * sampleRate * (0.85 + p.space * 0.75)));
      const a = new Float32Array(left), b = new Float32Array(right);
      delays.forEach((delay, k) => {
        const gain = [0.23, 0.2, 0.17, 0.13, 0.09][k] * amount;
        for (let i = delay; i < left.length; i += 1) {
          const decay = Math.exp(-(i - delay) / (sampleRate * (0.16 + amount * 1.15)));
          left[i] += b[i - delay] * gain * decay;
          right[i] += a[i - delay] * gain * decay;
        }
      });
    }
  }

  function master(left, right, p) {
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    const makeup = peak > 0.001 ? Math.min(2.4, 0.92 / peak) : 1;
    for (let i = 0; i < left.length; i += 1) {
      left[i] = compress(left[i] * makeup, p.comp);
      right[i] = compress(right[i] * makeup, p.comp);
    }
  }

  function compress(x, amount) {
    const threshold = lerp(0.92, 0.48, amount);
    const ratio = lerp(1.1, 4.8, amount);
    const sign = Math.sign(x), a = Math.abs(x);
    if (a <= threshold) return clamp(x, -1, 1);
    return clamp(Math.tanh((threshold + (a - threshold) / ratio) * 1.08) * sign, -1, 1);
  }

  function draw(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#67e8f9'); grad.addColorStop(0.42, '#818cf8'); grad.addColorStop(1, '#f0abfc');
    ctx.strokeStyle = 'rgba(148,163,184,.14)'; ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = grad; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x < w; x += 1) {
      const a = Math.floor((x / w) * buffer.left.length);
      const b = Math.max(a + 1, Math.floor(((x + 1) / w) * buffer.left.length));
      let min = 1, max = -1;
      for (let i = a; i < b; i += 1) { const v = (buffer.left[i] + buffer.right[i]) * 0.5; min = Math.min(min, v); max = Math.max(max, v); }
      ctx.moveTo(x, h / 2 - max * h * 0.42); ctx.lineTo(x, h / 2 - min * h * 0.42);
    }
    ctx.stroke();
  }

  function wav(buffer) {
    const channels = 2, bytes = 2, block = channels * bytes;
    const len = buffer.left.length * block;
    const ab = new ArrayBuffer(44 + len);
    const view = new DataView(ab);
    write(view, 0, 'RIFF'); view.setUint32(4, 36 + len, true); write(view, 8, 'WAVE');
    write(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * block, true); view.setUint16(32, block, true); view.setUint16(34, 16, true);
    write(view, 36, 'data'); view.setUint32(40, len, true);
    let off = 44;
    for (let i = 0; i < buffer.left.length; i += 1) { view.setInt16(off, to16(buffer.left[i]), true); off += 2; view.setInt16(off, to16(buffer.right[i]), true); off += 2; }
    return new Blob([view], { type: 'audio/wav' });
  }
  function write(view, offset, text) { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); }
  function to16(v) { const s = clamp(v, -1, 1); return s < 0 ? s * 0x8000 : s * 0x7fff; }

  function updateDownload(buffer, name) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(wav(buffer));
    const safe = String(name || 'studio-sfx').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'studio-sfx';
    link.href = downloadUrl; link.download = `${safe}-studio.wav`; link.classList.remove('hidden');
  }

  function updateReadout(p, buffer) {
    const engineText = $('sfxStudioEngine')?.selectedOptions?.[0]?.textContent || p.engine;
    const textureText = $('sfxStudioTexture')?.selectedOptions?.[0]?.textContent || p.texture;
    if ($('sfxStudioEngineReadout')) $('sfxStudioEngineReadout').textContent = engineText;
    if ($('sfxStudioTextureReadout')) $('sfxStudioTextureReadout').textContent = textureText === 'Auto' ? p.texture : textureText;
    if ($('sfxStudioRenderReadout')) $('sfxStudioRenderReadout').textContent = '48kHz Stereo';
    let peak = 0;
    for (let i = 0; i < buffer.left.length; i += 1) peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
    if ($('sfxStudioPeakReadout')) $('sfxStudioPeakReadout').textContent = `${(20 * Math.log10(Math.max(peak, 0.00001))).toFixed(1)} dB`;
    const status = $('sfxStatus');
    if (status) status.textContent = `Studio Render: ${engineText} / ${p.texture}, ${p.wave}, depth ${p.depth.toFixed(2)}`;
  }

  function render() {
    const p = params();
    lastBuffer = renderBuffer(p);
    draw(lastBuffer);
    updateDownload(lastBuffer, p.id);
    updateReadout(p, lastBuffer);
    return lastBuffer;
  }

  async function play(event) {
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    stop(event);
    const buffer = render();
    const ctx = getContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const audio = ctx.createBuffer(2, buffer.left.length, buffer.sampleRate);
    audio.copyToChannel(buffer.left, 0); audio.copyToChannel(buffer.right, 1);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain(); gain.gain.value = 0.96;
    source.buffer = audio; source.connect(gain).connect(ctx.destination);
    activeSource = source; source.onended = () => { if (activeSource === source) activeSource = null; };
    source.start();
  }

  function stop(event) {
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    try { activeSource?.stop(); } catch (error) {}
    activeSource = null;
  }

  function applyWaveProfile() {
    const data = window.SFXStudioPresets;
    const profile = data?.waveformProfiles?.[$('sfxWave')?.value];
    if (!profile) return;
    set('sfxStudioEngine', profile.engine); set('sfxStudioTexture', profile.texture); set('sfxStudioDepth', profile.depth); set('sfxStudioBody', profile.body);
    set('sfxStudioShine', profile.shine); set('sfxStudioAir', profile.air); set('sfxTransient', profile.transient); set('sfxNoise', profile.noise); set('sfxFilter', profile.filter);
    render();
  }

  function applyMasterPreset(name) {
    const preset = window.SFXStudioPresets?.masterPresets?.[name];
    if (!preset) return;
    set('sfxStudioEngine', preset.engine); set('sfxStudioTexture', preset.texture); set('sfxWave', preset.wave); set('sfxStudioDepth', preset.depth); set('sfxStudioBody', preset.body);
    set('sfxStudioShine', preset.shine); set('sfxStudioComp', preset.comp); set('sfxReverb', preset.reverb); set('sfxStudioTail', preset.tail);
    render();
  }

  function randomize(event) {
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    const combos = [['clean','clean'], ['pro','glass'], ['pro','bell'], ['impact','impact'], ['air','whoosh'], ['pro','hybrid']];
    const [engine, texture] = combos[Math.floor(Math.random() * combos.length)];
    set('sfxStudioEngine', engine); set('sfxStudioTexture', texture); set('sfxStudioDepth', (0.45 + Math.random() * 0.52).toFixed(2)); set('sfxStudioBody', (0.18 + Math.random() * 0.72).toFixed(2));
    set('sfxStudioShine', (0.18 + Math.random() * 0.74).toFixed(2)); set('sfxStudioWidth', (0.25 + Math.random() * 0.68).toFixed(2)); set('sfxStudioTail', (Math.random() * 0.55).toFixed(2));
    play(event);
  }

  function bind() {
    if (bound || !$('sfxPreviewButton') || !$('sfxStudioEngine')) return;
    bound = true;
    $('sfxPreviewButton').addEventListener('click', play, true);
    $('sfxStopButton')?.addEventListener('click', stop, true);
    $('sfxRandomButton')?.addEventListener('click', randomize, true);
    $('sfxWave')?.addEventListener('change', applyWaveProfile);
    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-sfx-studio-preset]');
      if (button) applyMasterPreset(button.dataset.sfxStudioPreset);
    });
    ['sfxStudioEngine','sfxStudioTexture','sfxStudioDepth','sfxStudioBody','sfxStudioShine','sfxStudioComp','sfxStudioWidth','sfxStudioTail','sfxStudioAir','sfxDuration','sfxVolume','sfxStartFreq','sfxEndFreq','sfxNoise','sfxFilter','sfxSpace','sfxReverb','sfxStereo','sfxBrightness','sfxSub','sfxAttack','sfxDecay','sfxSustain','sfxRelease','sfxVibratoDepth','sfxVibratoRate','sfxPunch','sfxArpeggio'].forEach((id) => {
      $(id)?.addEventListener('input', render);
      $(id)?.addEventListener('change', render);
    });
    setTimeout(render, 0);
  }

  function install() { bind(); }
  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
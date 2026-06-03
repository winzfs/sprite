(() => {
  const MAX_TRIES = 40;
  let audioContext = null;
  let activeSource = null;
  let downloadUrl = '';
  let bound = false;
  let lastRenderMs = 0;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function readNum(id, fallback) {
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

  function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function parseArpeggio(text) {
    const values = String(text || '0')
      .split(',')
      .map((item) => Number.parseFloat(item.trim()))
      .filter(Number.isFinite);
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

  function getParams() {
    const engine = $('sfxStudioEngine')?.value || 'pro';
    const id = $('sfxNameInput')?.value || 'studio-sfx';
    let texture = $('sfxStudioTexture')?.value || 'auto';
    if (texture === 'auto') texture = inferTexture(id, engine);
    return {
      id,
      engine,
      texture,
      wave: $('sfxWave')?.value || 'sine',
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
      arpeggio: parseArpeggio($('sfxArpeggio')?.value || '0'),
      space: readNum('sfxSpace', 0.34),
      reverb: readNum('sfxReverb', 0.22),
      stereo: readNum('sfxStereo', 0.42),
      brightness: readNum('sfxBrightness', 0.55),
      sub: readNum('sfxSub', 0.18),
      depth: readNum('sfxStudioDepth', 0.78),
      body: readNum('sfxStudioBody', 0.46),
      shine: readNum('sfxStudioShine', 0.52),
      comp: readNum('sfxStudioComp', 0.58),
      width: readNum('sfxStudioWidth', 0.58),
      tail: readNum('sfxStudioTail', 0.34),
      air: readNum('sfxStudioAir', 0.38),
    };
  }

  function engineProfile(p) {
    const engineMap = {
      clean: { modal: 0.16, fm: 0.14, noise: 0.018, sub: 0.04, air: 0.1, drive: 1.04 },
      pro: { modal: 0.56, fm: 0.46, noise: 0.08, sub: 0.14, air: 0.24, drive: 1.12 },
      impact: { modal: 0.28, fm: 0.22, noise: 0.66, sub: 0.75, air: 0.16, drive: 1.58 },
      air: { modal: 0.05, fm: 0.08, noise: 0.9, sub: 0.035, air: 0.88, drive: 1.02 },
    };
    const textureMap = {
      clean: { modal: 0.62, fm: 0.62, noise: 0.32, sub: 0.45, air: 0.5 },
      glass: { modal: 1.5, fm: 1.2, noise: 0.4, sub: 0.45, air: 0.92 },
      bell: { modal: 1.35, fm: 1.0, noise: 0.25, sub: 0.38, air: 0.75 },
      impact: { modal: 0.7, fm: 0.7, noise: 1.55, sub: 1.75, air: 0.55 },
      whoosh: { modal: 0.16, fm: 0.22, noise: 1.75, sub: 0.2, air: 1.75 },
      hybrid: { modal: 1.05, fm: 1.05, noise: 0.85, sub: 0.75, air: 1.0 },
    };
    const engine = engineMap[p.engine] || engineMap.pro;
    const texture = textureMap[p.texture] || textureMap.hybrid;
    return {
      modal: engine.modal * texture.modal * lerp(0.2, 1.25, p.depth),
      fm: engine.fm * texture.fm * lerp(0.2, 1.25, p.depth),
      noise: engine.noise * texture.noise + p.noise * (0.2 + p.air),
      sub: engine.sub * texture.sub * (0.3 + p.body * 1.2),
      air: engine.air * texture.air * (0.25 + p.shine * 1.25),
      drive: engine.drive,
    };
  }

  function modalRatios(texture, wave, depth) {
    if (wave === 'metallic') return [1, 1.37, 2.71, 4.33, 6.89, 9.2];
    if (wave === 'crystal') return [1, 2.13, 3.01, 5.72, 8.8, 13.1];
    if (wave === 'water-drop') return [1, 1.61, 2.41, 3.7];
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

  function envelope(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) return lerp(1, p.sustain, (t - p.attack) / Math.max(0.0001, p.decay));
    if (t > p.duration - p.release) return Math.max(0, p.sustain * ((p.duration - t) / Math.max(0.0001, p.release)));
    return p.sustain;
  }

  function synthesize(p) {
    const sampleRate = 48000;
    const duration = clamp(p.duration, 0.03, 2.0);
    const total = Math.max(1, Math.floor((duration + 0.03 + p.tail * 0.5 + p.reverb * 0.55 + p.space * 0.12) * sampleRate));
    const dry = Math.max(1, Math.floor(duration * sampleRate));
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const prof = engineProfile(p);
    const ratios = modalRatios(p.texture, p.wave, p.depth);
    const phases = ratios.map((_, i) => i * 1.37 + 0.1);
    const amps = ratios.map((_, i) => Math.pow(1 / (1 + i * 0.55), lerp(1.8, 0.62, p.depth)));
    let carrier = 0.3;
    let mod = 1.8;
    let sub = 0;
    let air = 0;
    let airBand = 0;
    let prevAir = 0;

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
      carrier += (Math.PI * 2 * f) / sampleRate;
      sub += (Math.PI * 2 * Math.max(20, f * 0.5)) / sampleRate;
      const fmIndex = prof.fm * (0.2 + snap * 0.8 + p.depth * 0.9);
      const fm = Math.sin(carrier + Math.sin(mod) * fmIndex + Math.sin(mod * 0.497) * fmIndex * 0.42) * e;
      let modal = 0;
      for (let r = 0; r < ratios.length; r += 1) {
        phases[r] += (Math.PI * 2 * f * ratios[r] * (1 + Math.sin(r * 17.31 + p.width * 4.7) * p.depth * 0.006)) / sampleRate;
        modal += Math.sin(phases[r]) * amps[r] * Math.exp(-n * lerp(8 + r * 2.1, 0.5 + r * 0.35, p.depth));
      }
      modal *= prof.modal * e;
      const raw = Math.random() * 2 - 1;
      const airRate = p.engine === 'air' ? lerp(0.04, 0.012, p.depth) : lerp(0.22, 0.055, p.depth);
      air += (raw - air) * airRate;
      airBand += ((air - prevAir) - airBand) * lerp(0.44, 0.11, p.depth);
      prevAir = air;
      const airLayer = (airBand * (0.55 + p.shine * 1.1) + air * 0.16) * (prof.noise + prof.air) * (p.engine === 'air' ? slow : quick * 0.65 + slow * 0.14);
      const shimmer = raw * p.shine * p.depth * 0.16 * Math.exp(-n * lerp(18, 4, p.depth));
      const thump = Math.sin(n * Math.PI * 2 * 32) * Math.exp(-n * 38) * (p.texture === 'impact' || p.engine === 'impact' ? 0.7 : 0.08);
      const tick = Math.sin(n * Math.PI * 2 * (96 + p.shine * 340)) * Math.exp(-n * 105) * 0.1;
      const transient = ((raw * Math.exp(-n * 220) * 0.12) + tick + thump) * p.depth;
      const low = Math.sin(sub) * p.sub * prof.sub * (p.engine === 'impact' ? quick * 1.8 : slow * 0.35);
      const cleanCore = Math.sin(carrier) * e * lerp(0.35, 0.02, p.depth);
      let mono = cleanCore + fm * lerp(0.22, 1.0, p.depth) + modal + airLayer + shimmer + transient + low;
      mono *= p.volume * (1 + p.punch * quick * lerp(0.25, 1.4, p.depth));
      mono = Math.tanh(mono * prof.drive) / Math.tanh(prof.drive);
      const pan = Math.sin(n * Math.PI * (1.2 + p.space * 2.4)) * (p.stereo + p.width * 0.55) * 0.42;
      const micro = raw * p.width * p.depth * 0.02;
      left[i] += mono * (0.94 - pan) + micro;
      right[i] += mono * (0.94 + pan) - micro;
    }
    applyEffects(left, right, sampleRate, p);
    master(left, right, p);
    return { left, right, sampleRate };
  }

  function applyEffects(left, right, sampleRate, p) {
    const cutoff = clamp(p.filter * (0.32 + p.brightness * 0.92 + p.shine * 0.34), 160, 19000);
    const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
    let lpL = 0;
    let lpR = 0;
    let prevL = 0;
    let prevR = 0;
    for (let i = 0; i < left.length; i += 1) {
      lpL += alpha * (left[i] - lpL);
      lpR += alpha * (right[i] - lpR);
      const hpL = left[i] - prevL;
      const hpR = right[i] - prevR;
      prevL = left[i];
      prevR = right[i];
      left[i] = lpL * 0.9 + hpL * p.shine * 0.06;
      right[i] = lpR * 0.9 + hpR * p.shine * 0.06;
    }
    const amount = p.reverb * (0.15 + p.tail * 1.35);
    if (amount <= 0.01) return;
    const delays = [0.017, 0.029, 0.043, 0.071, 0.109].map((seconds) => Math.floor(seconds * sampleRate * (0.85 + p.space * 0.75)));
    const copyL = new Float32Array(left);
    const copyR = new Float32Array(right);
    delays.forEach((delay, index) => {
      const gain = [0.23, 0.2, 0.17, 0.13, 0.09][index] * amount;
      for (let i = delay; i < left.length; i += 1) {
        const decay = Math.exp(-(i - delay) / (sampleRate * (0.16 + amount * 1.15)));
        left[i] += copyR[i - delay] * gain * decay;
        right[i] += copyL[i - delay] * gain * decay;
      }
    });
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
    const sign = Math.sign(x);
    const abs = Math.abs(x);
    if (abs <= threshold) return clamp(x, -1, 1);
    return clamp(Math.tanh((threshold + (abs - threshold) / ratio) * 1.08) * sign, -1, 1);
  }

  function draw(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#67e8f9');
    gradient.addColorStop(0.42, '#818cf8');
    gradient.addColorStop(1, '#f0abfc');
    ctx.strokeStyle = 'rgba(148,163,184,.14)';
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * buffer.left.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * buffer.left.length));
      let min = 1;
      let max = -1;
      for (let i = start; i < end; i += 1) {
        const value = (buffer.left[i] + buffer.right[i]) * 0.5;
        min = Math.min(min, value);
        max = Math.max(max, value);
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
    const length = buffer.left.length * block;
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);
    write(view, 0, 'RIFF'); view.setUint32(4, 36 + length, true); write(view, 8, 'WAVE');
    write(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * block, true); view.setUint16(32, block, true); view.setUint16(34, 16, true);
    write(view, 36, 'data'); view.setUint32(40, length, true);
    let offset = 44;
    for (let i = 0; i < buffer.left.length; i += 1) {
      view.setInt16(offset, to16(buffer.left[i]), true); offset += 2;
      view.setInt16(offset, to16(buffer.right[i]), true); offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }
  function write(view, offset, text) { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); }
  function to16(value) { const sample = clamp(value, -1, 1); return sample < 0 ? sample * 0x8000 : sample * 0x7fff; }

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

  function updateReadout(p, buffer) {
    const engineText = $('sfxStudioEngine')?.selectedOptions?.[0]?.textContent || p.engine;
    const textureText = $('sfxStudioTexture')?.selectedOptions?.[0]?.textContent || p.texture;
    if ($('sfxStudioEngineReadout')) $('sfxStudioEngineReadout').textContent = engineText;
    if ($('sfxStudioTextureReadout')) $('sfxStudioTextureReadout').textContent = textureText === 'Auto' ? p.texture : textureText;
    if ($('sfxStudioRenderReadout')) $('sfxStudioRenderReadout').textContent = `${lastRenderMs.toFixed(0)}ms`;
    let peak = 0;
    for (let i = 0; i < buffer.left.length; i += 1) peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
    if ($('sfxStudioPeakReadout')) $('sfxStudioPeakReadout').textContent = `${(20 * Math.log10(Math.max(peak, 0.00001))).toFixed(1)} dB`;
    const status = $('sfxStatus');
    if (status) status.textContent = `Studio Render: ${engineText} / ${p.texture}, ${p.wave}, ${lastRenderMs.toFixed(0)}ms. 옵션 변경 시 자동 렌더링하지 않습니다.`;
  }

  function render() {
    const start = performance.now();
    const p = getParams();
    const buffer = synthesize(p);
    lastRenderMs = performance.now() - start;
    draw(buffer);
    updateDownload(buffer, p.id);
    updateReadout(p, buffer);
    return { p, buffer };
  }

  async function play(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    stop(event);
    try {
      const { buffer } = render();
      const context = getAudioContext();
      if (context.state === 'suspended') await context.resume();
      const audio = context.createBuffer(2, buffer.left.length, buffer.sampleRate);
      audio.copyToChannel(buffer.left, 0);
      audio.copyToChannel(buffer.right, 1);
      const source = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.96;
      source.buffer = audio;
      source.connect(gain).connect(context.destination);
      activeSource = source;
      source.onended = () => { if (activeSource === source) activeSource = null; };
      source.start();
    } catch (error) {
      console.error('[sfx-engine-core] render failed', error);
      const status = $('sfxStatus');
      if (status) status.textContent = '렌더링 실패: 설정값을 줄이거나 기본 모드로 전환해 주세요.';
    }
  }

  function stop(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    try { activeSource?.stop(); } catch (error) {}
    activeSource = null;
  }

  function applyWaveProfile() {
    const profile = window.SFXStudioPresets?.waveformProfiles?.[$('sfxWave')?.value];
    if (!profile) return;
    setValue('sfxStudioEngine', profile.engine);
    setValue('sfxStudioTexture', profile.texture);
    setValue('sfxStudioDepth', profile.depth);
    setValue('sfxStudioBody', profile.body);
    setValue('sfxStudioShine', profile.shine);
    setValue('sfxStudioAir', profile.air);
    setValue('sfxTransient', profile.transient);
    setValue('sfxNoise', profile.noise);
    setValue('sfxFilter', profile.filter);
    updatePreviewOnly();
  }

  function applyMasterPreset(name) {
    const preset = window.SFXStudioPresets?.masterPresets?.[name];
    if (!preset) return;
    setValue('sfxStudioEngine', preset.engine);
    setValue('sfxStudioTexture', preset.texture);
    setValue('sfxWave', preset.wave);
    setValue('sfxStudioDepth', preset.depth);
    setValue('sfxStudioBody', preset.body);
    setValue('sfxStudioShine', preset.shine);
    setValue('sfxStudioComp', preset.comp);
    setValue('sfxReverb', preset.reverb);
    setValue('sfxStudioTail', preset.tail);
    updatePreviewOnly();
  }

  function randomize(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const combos = [['clean', 'clean'], ['pro', 'glass'], ['pro', 'bell'], ['impact', 'impact'], ['air', 'whoosh'], ['pro', 'hybrid']];
    const [engine, texture] = combos[Math.floor(Math.random() * combos.length)];
    setValue('sfxStudioEngine', engine);
    setValue('sfxStudioTexture', texture);
    setValue('sfxStudioDepth', (0.45 + Math.random() * 0.52).toFixed(2));
    setValue('sfxStudioBody', (0.18 + Math.random() * 0.72).toFixed(2));
    setValue('sfxStudioShine', (0.18 + Math.random() * 0.74).toFixed(2));
    setValue('sfxStudioWidth', (0.25 + Math.random() * 0.68).toFixed(2));
    setValue('sfxStudioTail', (Math.random() * 0.55).toFixed(2));
    play(event);
  }

  function updatePreviewOnly() {
    const status = $('sfxStatus');
    if (status) status.textContent = '설정이 변경되었습니다. 미리듣기를 눌러 새 사운드를 렌더링하세요.';
  }

  function bindOnce() {
    if (bound) return true;
    if (!$('sfxPreviewButton') || !$('sfxStudioEngine') || !$('sfxWaveCanvas')) return false;
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
      $(id)?.addEventListener('input', updatePreviewOnly);
      $(id)?.addEventListener('change', updatePreviewOnly);
    });
    updatePreviewOnly();
    return true;
  }

  function waitForUi(tries = 0) {
    if (bindOnce()) return;
    if (tries >= MAX_TRIES) {
      console.warn('[sfx-engine-core] studio UI not ready; skipped');
      return;
    }
    window.setTimeout(() => waitForUi(tries + 1), 50);
  }

  window.addEventListener('sfx:studio-ui-ready', () => waitForUi());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => waitForUi());
  else waitForUi();
})();
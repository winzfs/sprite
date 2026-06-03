(() => {
  const STYLE_ID = 'sfxPremiumEngineStyle';
  let audioContext = null;
  let currentSource = null;
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
      .sfx-premium-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 9px; border-radius:999px; background:linear-gradient(135deg,rgba(251,191,36,.18),rgba(168,85,247,.18)); color:#7c3aed; font-size:11px; font-weight:950; border:1px solid rgba(168,85,247,.22); }
      .sfx-premium-note { grid-column:1/-1; border:1px solid rgba(168,85,247,.2); border-radius:18px; padding:12px 14px; background:linear-gradient(135deg,rgba(168,85,247,.09),rgba(6,182,212,.08)); color:#475569; font-size:12px; line-height:1.45; }
      @media (prefers-color-scheme: dark) { .sfx-premium-badge { color:#ddd6fe; } .sfx-premium-note { color:#d1d5db; background:linear-gradient(135deg,rgba(168,85,247,.16),rgba(6,182,212,.12)); border-color:rgba(168,85,247,.3); } }
    `;
    document.head.append(style);
  }

  function rangeControl(id, label, min, max, step, value, unit = '') {
    return `<div class="sfx-control"><label>${label} <output id="${id}Out">${value}${unit}</output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
  }

  function installPremiumControls() {
    const grid = document.querySelector('#view-sfxMaker .sfx-control-grid');
    if (!grid || $('sfxSoundStyle')) return;
    const note = document.createElement('div');
    note.className = 'sfx-premium-note';
    note.innerHTML = `<span class="sfx-premium-badge">💎 Premium Engine</span> 16비트 단일 파형 느낌을 줄이고, 레이어·스테레오·리버브·공간감을 더해 고급스러운 UI/게임 효과음으로 합성합니다.`;

    const styleControl = document.createElement('div');
    styleControl.className = 'sfx-control';
    styleControl.innerHTML = `<label>사운드 스타일</label><select id="sfxSoundStyle"><option value="modern" selected>Modern Clean</option><option value="soft">Soft UI</option><option value="cinematic">Cinematic</option><option value="arcade">Arcade Polish</option><option value="retro">Retro Raw</option></select>`;

    const qualityControl = document.createElement('div');
    qualityControl.className = 'sfx-control';
    qualityControl.innerHTML = `<label>렌더 품질</label><select id="sfxRenderQuality"><option value="standard">Standard</option><option value="premium" selected>Premium Stereo</option><option value="wide">Wide Stereo</option></select>`;

    grid.append(
      note,
      styleControl,
      qualityControl,
      htmlToElement(rangeControl('sfxSpace', '공간감', 0, 1, 0.01, 0.35)),
      htmlToElement(rangeControl('sfxReverb', '리버브', 0, 1, 0.01, 0.22)),
      htmlToElement(rangeControl('sfxStereo', '스테레오 폭', 0, 1, 0.01, 0.42)),
      htmlToElement(rangeControl('sfxBrightness', '밝기', 0, 1, 0.01, 0.55)),
      htmlToElement(rangeControl('sfxSub', '서브 저역', 0, 1, 0.01, 0.18))
    );
  }

  function htmlToElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function waveSample(type, phase) {
    const p = phase % (Math.PI * 2);
    if (type === 'square') return Math.sin(p) >= 0 ? 1 : -1;
    if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p));
    if (type === 'sawtooth') return 2 * (p / (Math.PI * 2)) - 1;
    if (type === 'noise') return Math.random() * 2 - 1;
    return Math.sin(p);
  }

  function envelopeAt(t, p) {
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) {
      const k = (t - p.attack) / Math.max(0.0001, p.decay);
      return lerp(1, p.sustain, k);
    }
    if (t > p.duration - p.release) {
      const k = (p.duration - t) / Math.max(0.0001, p.release);
      return Math.max(0, p.sustain * k);
    }
    return p.sustain;
  }

  function parseArpeggio(text) {
    const values = String(text || '0').split(',').map((item) => Number.parseFloat(item.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function getParams() {
    const style = $('sfxSoundStyle')?.value || 'modern';
    const quality = $('sfxRenderQuality')?.value || 'premium';
    return {
      id: $('sfxNameInput')?.value || 'premium-sfx',
      wave: $('sfxWave')?.value || 'sine',
      duration: readNum('sfxDuration', 0.25),
      volume: readNum('sfxVolume', 0.5),
      startFreq: readNum('sfxStartFreq', 600),
      endFreq: readNum('sfxEndFreq', 900),
      attack: readNum('sfxAttack', 0.004),
      decay: readNum('sfxDecay', 0.08),
      sustain: readNum('sfxSustain', 0.3),
      release: readNum('sfxRelease', 0.05),
      noise: readNum('sfxNoise', 0.05),
      filter: readNum('sfxFilter', 7000),
      vibratoDepth: readNum('sfxVibratoDepth', 0.01),
      vibratoRate: readNum('sfxVibratoRate', 8),
      punch: readNum('sfxPunch', 0.2),
      bitcrush: style === 'retro' ? readNum('sfxBitcrush', 0.1) : Math.min(readNum('sfxBitcrush', 0), style === 'arcade' ? 0.14 : 0.04),
      arpeggio: $('sfxArpeggio')?.value || '0',
      style,
      quality,
      space: readNum('sfxSpace', 0.35),
      reverb: readNum('sfxReverb', 0.22),
      stereo: quality === 'wide' ? Math.max(readNum('sfxStereo', 0.42), 0.72) : readNum('sfxStereo', 0.42),
      brightness: readNum('sfxBrightness', 0.55),
      sub: readNum('sfxSub', 0.18),
    };
  }

  function styleProfile(style) {
    if (style === 'soft') return { harmonic: 0.16, shimmer: 0.18, noiseSmooth: 0.45, drive: 0.08, tail: 0.24, lowpass: 0.78 };
    if (style === 'cinematic') return { harmonic: 0.32, shimmer: 0.22, noiseSmooth: 0.62, drive: 0.16, tail: 0.48, lowpass: 0.68 };
    if (style === 'arcade') return { harmonic: 0.28, shimmer: 0.2, noiseSmooth: 0.18, drive: 0.22, tail: 0.16, lowpass: 0.9 };
    if (style === 'retro') return { harmonic: 0.05, shimmer: 0.02, noiseSmooth: 0.02, drive: 0.08, tail: 0.02, lowpass: 1 };
    return { harmonic: 0.24, shimmer: 0.2, noiseSmooth: 0.35, drive: 0.12, tail: 0.28, lowpass: 0.86 };
  }

  function synthesizePremium(p) {
    const sampleRate = 48000;
    const profile = styleProfile(p.style);
    const total = Math.max(1, Math.floor((p.duration + p.reverb * profile.tail) * sampleRate));
    const dryLength = Math.max(1, Math.floor(p.duration * sampleRate));
    const left = new Float32Array(total);
    const right = new Float32Array(total);
    const arp = parseArpeggio(p.arpeggio);
    let phaseA = 0;
    let phaseB = 1.7;
    let phaseSub = 0.5;
    let smoothNoise = 0;
    let lpL = 0;
    let lpR = 0;
    let hpL = 0;
    let hpR = 0;
    let lastL = 0;
    let lastR = 0;
    const crushStep = Math.max(1, Math.round(1 + p.bitcrush * 36));
    let hold = 0;
    let heldL = 0;
    let heldR = 0;

    for (let i = 0; i < dryLength; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, dryLength - 1);
      const arpIndex = Math.min(arp.length - 1, Math.floor(n * arp.length));
      const semitone = arp[arpIndex] || 0;
      const pitchCurve = Math.pow(n, p.style === 'cinematic' ? 0.95 : 0.78);
      const baseFreq = lerp(p.startFreq, p.endFreq, pitchCurve) * Math.pow(2, semitone / 12);
      const vibrato = 1 + Math.sin(t * Math.PI * 2 * p.vibratoRate) * p.vibratoDepth;
      const freq = baseFreq * vibrato;
      const detune = 1 + 0.004 + p.space * 0.006;
      phaseA += (Math.PI * 2 * freq) / sampleRate;
      phaseB += (Math.PI * 2 * freq * detune) / sampleRate;
      phaseSub += (Math.PI * 2 * Math.max(28, freq * 0.5)) / sampleRate;

      const env = envelopeAt(t, p);
      const punch = 1 + p.punch * Math.exp(-n * 18);
      const main = waveSample(p.wave, phaseA);
      const second = waveSample(p.wave === 'noise' ? 'sine' : p.wave, phaseB) * 0.55;
      const harmonic = Math.sin(phaseA * 2.01) * profile.harmonic + Math.sin(phaseA * 3.005) * profile.shimmer * p.brightness;
      const sub = Math.sin(phaseSub) * p.sub * (1 - Math.min(0.75, n));
      smoothNoise += ((Math.random() * 2 - 1) - smoothNoise) * (p.style === 'retro' ? 1 : 0.08 + profile.noiseSmooth * 0.08);
      const noise = smoothNoise * p.noise;
      const sparkle = (Math.random() * 2 - 1) * p.noise * p.brightness * profile.shimmer * Math.exp(-n * 7);
      let mono = (main * 0.72 + second * 0.22 + harmonic + sub + noise + sparkle) * env * p.volume * punch;
      mono = Math.tanh(mono * (1 + profile.drive * 1.6));

      const pan = Math.sin(n * Math.PI * 2.2 + p.space * 1.6) * p.stereo * 0.45;
      let l = mono * (0.92 - pan);
      let r = mono * (0.92 + pan);

      const cutoff = clamp(p.filter * (0.55 + p.brightness * 0.85) * profile.lowpass, 160, 18000);
      const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.002, 0.99);
      lpL += alpha * (l - lpL);
      lpR += alpha * (r - lpR);
      const highMix = p.brightness * 0.18;
      hpL = l - lastL; hpR = r - lastR;
      lastL = l; lastR = r;
      l = lpL + hpL * highMix;
      r = lpR + hpR * highMix;

      if (p.bitcrush > 0) {
        if (hold % crushStep === 0) { heldL = l; heldR = r; }
        hold += 1;
        const levels = Math.max(8, Math.round(512 - p.bitcrush * 448));
        l = Math.round(heldL * levels) / levels;
        r = Math.round(heldR * levels) / levels;
      }

      left[i] += l;
      right[i] += r;
    }

    applyReverb(left, right, sampleRate, p, profile);
    normalizeStereo(left, right, 0.93);
    return { left, right, sampleRate };
  }

  function applyReverb(left, right, sampleRate, p, profile) {
    const amount = clamp(p.reverb, 0, 1);
    if (amount <= 0.001) return;
    const delays = [0.029, 0.043, 0.071, 0.113].map((sec) => Math.floor(sec * sampleRate * (0.7 + p.space * 0.7)));
    const gains = [0.34, 0.26, 0.18, 0.12].map((g) => g * amount * (0.8 + profile.tail));
    const copyL = new Float32Array(left);
    const copyR = new Float32Array(right);
    for (let d = 0; d < delays.length; d += 1) {
      const delay = delays[d];
      const gain = gains[d];
      for (let i = delay; i < left.length; i += 1) {
        const decay = Math.exp(-(i - delay) / (sampleRate * (0.35 + amount * 0.9)));
        left[i] += copyR[i - delay] * gain * decay;
        right[i] += copyL[i - delay] * gain * decay;
      }
    }
  }

  function normalizeStereo(left, right, peakTarget) {
    let peak = 0;
    for (let i = 0; i < left.length; i += 1) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    if (peak <= 0.001) return;
    const gain = Math.min(1.8, peakTarget / peak);
    for (let i = 0; i < left.length; i += 1) {
      left[i] = clamp(left[i] * gain, -1, 1);
      right[i] = clamp(right[i] * gain, -1, 1);
    }
  }

  function drawWave(buffer) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#67e8f9');
    gradient.addColorStop(0.45, '#c084fc');
    gradient.addColorStop(1, '#fda4af');
    ctx.strokeStyle = 'rgba(148,163,184,.14)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const samples = buffer.left;
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * samples.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * samples.length));
      let min = 1, max = -1;
      for (let i = start; i < end; i += 1) {
        const v = (buffer.left[i] + buffer.right[i]) * 0.5;
        min = Math.min(min, v); max = Math.max(max, v);
      }
      ctx.moveTo(x, height / 2 - max * height * 0.42);
      ctx.lineTo(x, height / 2 - min * height * 0.42);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  }

  function encodeStereoWav(buffer) {
    const { left, right, sampleRate } = buffer;
    const channels = 2;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataLength = left.length * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(arrayBuffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    let offset = 44;
    for (let i = 0; i < left.length; i += 1) {
      view.setInt16(offset, floatToInt16(left[i]), true); offset += 2;
      view.setInt16(offset, floatToInt16(right[i]), true); offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function floatToInt16(value) {
    const sample = clamp(value, -1, 1);
    return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  function writeString(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function updateDownload(buffer, name) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const blob = encodeStereoWav(buffer);
    downloadUrl = URL.createObjectURL(blob);
    const safeName = String(name || 'premium-sfx').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'premium-sfx';
    link.href = downloadUrl;
    link.download = `${safeName}-premium.wav`;
    link.classList.remove('hidden');
  }

  function updateOutputs() {
    ['sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub'].forEach((id) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (input && output) output.textContent = input.value;
    });
  }

  function renderPremium() {
    const p = getParams();
    currentBuffer = synthesizePremium(p);
    drawWave(currentBuffer);
    updateDownload(currentBuffer, p.id);
    updateOutputs();
    const status = $('sfxStatus');
    if (status) status.textContent = `프리미엄 생성 완료: ${p.style}, stereo WAV, 공간감 ${p.space.toFixed(2)}, 리버브 ${p.reverb.toFixed(2)}`;
    const format = document.querySelector('#sfxDownloadLink')?.closest('.sfx-wave-wrap')?.querySelector('.sfx-readout .sfx-meter:nth-child(3) strong');
    if (format) format.textContent = 'Stereo WAV';
  }

  async function playPremium(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    stopPremium();
    renderPremium();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const audioBuffer = ctx.createBuffer(2, currentBuffer.left.length, currentBuffer.sampleRate);
    audioBuffer.copyToChannel(currentBuffer.left, 0);
    audioBuffer.copyToChannel(currentBuffer.right, 1);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.95;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => { if (currentSource === source) currentSource = null; };
    currentSource = source;
    source.start();
  }

  function stopPremium(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    try { currentSource?.stop(); } catch (error) {}
    currentSource = null;
  }

  function randomPremium(event) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    const styles = ['modern', 'soft', 'cinematic', 'arcade'];
    const style = styles[Math.floor(Math.random() * styles.length)];
    if ($('sfxSoundStyle')) $('sfxSoundStyle').value = style;
    if ($('sfxRenderQuality')) $('sfxRenderQuality').value = Math.random() > 0.45 ? 'premium' : 'wide';
    setValue('sfxSpace', (0.18 + Math.random() * 0.65).toFixed(2));
    setValue('sfxReverb', (style === 'cinematic' ? 0.32 + Math.random() * 0.45 : Math.random() * 0.35).toFixed(2));
    setValue('sfxStereo', (0.24 + Math.random() * 0.65).toFixed(2));
    setValue('sfxBrightness', (0.35 + Math.random() * 0.6).toFixed(2));
    setValue('sfxSub', (Math.random() * 0.35).toFixed(2));
    playPremium(event);
  }

  function setValue(id, value) {
    const input = $(id);
    if (input) input.value = String(value);
  }

  function bindPremium() {
    if (bound || !$('sfxPreviewButton') || !$('sfxSoundStyle')) return;
    bound = true;
    $('sfxPreviewButton').addEventListener('click', playPremium, true);
    $('sfxStopButton')?.addEventListener('click', stopPremium, true);
    $('sfxRandomButton')?.addEventListener('click', randomPremium, true);
    ['sfxSoundStyle', 'sfxRenderQuality', 'sfxSpace', 'sfxReverb', 'sfxStereo', 'sfxBrightness', 'sfxSub'].forEach((id) => {
      $(id)?.addEventListener('input', renderPremium);
      $(id)?.addEventListener('change', renderPremium);
    });
    renderPremium();
  }

  function install() {
    ensureStyle();
    installPremiumControls();
    bindPremium();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
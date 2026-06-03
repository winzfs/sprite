(() => {
  const CONTROL_ID = 'pixelArtUltraDetailControls';
  let pendingTimer = null;
  let sourceUrl = '';
  let downloadUrl = '';

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function readNum(id, fallback, min, max) {
    const n = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(n) ? n : fallback, min, max);
  }
  function isEnabled() { return Boolean($('pixelArtUltraDetail')?.checked); }
  function setStatus(text) { const status = $('pixelArtStatus'); if (status) status.textContent = text; }

  function installControls() {
    if ($(CONTROL_ID)) return;
    const smartRow = $('pixelArtSmartDetailControls');
    const parent = smartRow?.parentElement;
    if (!smartRow || !parent) return;

    const row = document.createElement('div');
    row.id = CONTROL_ID;
    row.className = 'grid-2';
    row.innerHTML = `
      <label class="check-label"><input id="pixelArtUltraDetail" type="checkbox" checked> 초저해상도 디테일 압축</label>
      <label>미세 디테일 <input id="pixelArtMicroDetail" type="range" min="0" max="100" value="72"></label>
      <label>명암 패턴 <input id="pixelArtTonePattern" type="range" min="0" max="100" value="46"></label>
      <label>특징점 강조 <input id="pixelArtFeatureBoost" type="range" min="0" max="100" value="64"></label>
    `;
    parent.insertBefore(row, smartRow.nextSibling);

    const help = document.createElement('div');
    help.className = 'status';
    help.textContent = '초저해상도 디테일 압축은 32×32/64×64에서 사라지기 쉬운 눈·입·경계·작은 명암을 픽셀 패턴으로 압축해 더 알아보기 쉽게 만듭니다.';
    row.after(help);

    ['pixelArtUltraDetail', 'pixelArtMicroDetail', 'pixelArtTonePattern', 'pixelArtFeatureBoost'].forEach((id) => {
      $(id)?.addEventListener('input', scheduleRun);
      $(id)?.addEventListener('change', scheduleRun);
    });
  }

  function loadImage() {
    const file = $('pixelArtInput')?.files?.[0];
    if (!file) return Promise.reject(new Error('NO_FILE'));
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ img, file });
      img.onerror = reject;
      img.src = sourceUrl;
    });
  }

  function adjust(data, contrast, saturation) {
    const c = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const sat = 1 + saturation / 100;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      const r = clamp(c * (data[i] - 128) + 128, 0, 255);
      const g = clamp(c * (data[i + 1] - 128) + 128, 0, 255);
      const b = clamp(c * (data[i + 2] - 128) + 128, 0, 255);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clamp(gray + (r - gray) * sat, 0, 255);
      data[i + 1] = clamp(gray + (g - gray) * sat, 0, 255);
      data[i + 2] = clamp(gray + (b - gray) * sat, 0, 255);
    }
  }

  function lum(data, w, h, x, y) {
    const xx = clamp(x, 0, w - 1);
    const yy = clamp(y, 0, h - 1);
    const i = (yy * w + xx) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function buildImportance(data, w, h) {
    const importance = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4;
        const a = data[i + 3] / 255;
        if (a <= 0.02) continue;
        const center = lum(data, w, h, x, y);
        const gx = Math.abs(lum(data, w, h, x - 1, y) - lum(data, w, h, x + 1, y));
        const gy = Math.abs(lum(data, w, h, x, y - 1) - lum(data, w, h, x, y + 1));
        const diag = Math.abs(lum(data, w, h, x - 1, y - 1) - lum(data, w, h, x + 1, y + 1));
        const contrast = Math.max(gx, gy, diag);
        const darkFeature = center < 92 ? (92 - center) / 92 : 0;
        const brightFeature = center > 190 ? (center - 190) / 65 : 0;
        importance[y * w + x] = a * clamp(contrast / 70 + darkFeature * 0.45 + brightFeature * 0.2, 0, 2.4);
      }
    }
    return importance;
  }

  function sampleCompressed(data, importance, sw, sh, tw, th, tx, ty, opt) {
    const sx0 = Math.floor((tx / tw) * sw);
    const sx1 = Math.max(sx0 + 1, Math.ceil(((tx + 1) / tw) * sw));
    const sy0 = Math.floor((ty / th) * sh);
    const sy1 = Math.max(sy0 + 1, Math.ceil(((ty + 1) / th) * sh));
    const cx = ((tx + 0.5) / tw) * sw;
    const cy = ((ty + 0.5) / th) * sh;

    let ar = 0, ag = 0, ab = 0, aa = 0, aw = 0;
    let fr = 0, fg = 0, fb = 0, fa = 0, fw = 0;
    let minLum = 255, maxLum = 0;
    let dark = null;
    let light = null;

    for (let y = sy0; y < Math.min(sh, sy1); y += 1) {
      for (let x = sx0; x < Math.min(sw, sx1); x += 1) {
        const i = (y * sw + x) * 4;
        const alpha = data[i + 3] / 255;
        if (alpha <= 0.02) continue;
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const center = 1 / (1 + dist * 0.18);
        const imp = importance[y * sw + x];
        const w = alpha * center;
        const featureW = w * (1 + imp * opt.featureBoost * 5.5);
        ar += data[i] * w; ag += data[i + 1] * w; ab += data[i + 2] * w; aa += data[i + 3] * w; aw += w;
        fr += data[i] * featureW; fg += data[i + 1] * featureW; fb += data[i + 2] * featureW; fa += data[i + 3] * featureW; fw += featureW;
        if (l < minLum) { minLum = l; dark = [data[i], data[i + 1], data[i + 2], data[i + 3]]; }
        if (l > maxLum) { maxLum = l; light = [data[i], data[i + 1], data[i + 2], data[i + 3]]; }
      }
    }

    if (!aw) return [0, 0, 0, 0];
    const avg = [ar / aw, ag / aw, ab / aw, aa / aw];
    const feat = fw ? [fr / fw, fg / fw, fb / fw, fa / fw] : avg;
    const micro = clamp(opt.microDetail, 0, 1);
    let out = [
      avg[0] * (1 - micro * 0.55) + feat[0] * micro * 0.55,
      avg[1] * (1 - micro * 0.55) + feat[1] * micro * 0.55,
      avg[2] * (1 - micro * 0.55) + feat[2] * micro * 0.55,
      Math.max(avg[3], feat[3] * 0.88),
    ];

    const toneRange = maxLum - minLum;
    if (toneRange > 42 && dark && light && opt.tonePattern > 0.05) {
      const checker = ((tx + ty) & 1) === 0;
      const chosen = checker ? dark : light;
      const mix = clamp(opt.tonePattern * Math.min(1, toneRange / 120) * 0.38, 0, 0.38);
      out = [
        out[0] * (1 - mix) + chosen[0] * mix,
        out[1] * (1 - mix) + chosen[1] * mix,
        out[2] * (1 - mix) + chosen[2] * mix,
        out[3],
      ];
    }
    return out.map((v, idx) => idx === 3 ? Math.round(clamp(v, 0, 255)) : Math.round(clamp(v, 0, 255)));
  }

  function renderSmall(img, tw, th, opt) {
    const source = document.createElement('canvas');
    const maxSource = Math.max(tw * 18, 768);
    const scale = Math.min(1, maxSource / Math.max(img.naturalWidth, img.naturalHeight));
    source.width = Math.max(tw, Math.round(img.naturalWidth * scale));
    source.height = Math.max(th, Math.round(img.naturalHeight * scale));
    const sctx = source.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, 0, 0, source.width, source.height);
    const sdata = sctx.getImageData(0, 0, source.width, source.height);
    adjust(sdata.data, opt.contrast, opt.saturation);
    const importance = buildImportance(sdata.data, source.width, source.height);

    const small = document.createElement('canvas');
    small.width = tw;
    small.height = th;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const out = ctx.createImageData(tw, th);
    for (let y = 0; y < th; y += 1) {
      for (let x = 0; x < tw; x += 1) {
        const c = sampleCompressed(sdata.data, importance, source.width, source.height, tw, th, x, y, opt);
        const i = (y * tw + x) * 4;
        out.data[i] = c[0]; out.data[i + 1] = c[1]; out.data[i + 2] = c[2]; out.data[i + 3] = c[3];
      }
    }
    ctx.putImageData(out, 0, 0);
    return small;
  }

  function palette(data, count) {
    const map = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const r = Math.round(data[i] / 8) * 8;
      const g = Math.round(data[i + 1] / 8) * 8;
      const b = Math.round(data[i + 2] / 8) * 8;
      const key = `${r},${g},${b}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, count).map(([key]) => key.split(',').map(Number));
  }

  function nearest(r, g, b, pal) {
    let best = pal[0] || [r, g, b], dist = Infinity;
    for (const c of pal) {
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < dist) { dist = d; best = c; }
    }
    return best;
  }

  function quantize(data, pal, amount) {
    const mix = clamp(amount, 0, 1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const c = nearest(data[i], data[i + 1], data[i + 2], pal);
      data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
      data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
      data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
    }
  }

  function accentDetails(data, w, h, amount) {
    const copy = new Uint8ClampedArray(data);
    const a = clamp(amount, 0, 1);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = (y * w + x) * 4;
        if (copy[i + 3] < 16) continue;
        const l = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        let maxDiff = 0;
        [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
          const ni = ((y + dy) * w + (x + dx)) * 4;
          const nl = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
          maxDiff = Math.max(maxDiff, Math.abs(l - nl));
        });
        if (maxDiff > 24) {
          const sign = l < 128 ? -1 : 1;
          const boost = clamp(maxDiff / 90, 0, 1) * a * 22;
          data[i] = clamp(data[i] + sign * boost, 0, 255);
          data[i + 1] = clamp(data[i + 1] + sign * boost, 0, 255);
          data[i + 2] = clamp(data[i + 2] + sign * boost, 0, 255);
        }
      }
    }
  }

  function fillBackground(ctx, w, h) {
    const bg = $('pixelArtBackground')?.value || 'transparent';
    if (bg === 'transparent') return;
    const colors = { white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128] };
    const c = colors[bg] || colors.white;
    const image = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] === 0) {
        image.data[i] = c[0]; image.data[i + 1] = c[1]; image.data[i + 2] = c[2]; image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function renderPalette(pal) {
    const box = $('pixelArtPalette');
    if (!box) return;
    box.innerHTML = '';
    pal.forEach((c) => {
      const hex = `#${c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = hex; b.title = hex;
      b.style.cssText = `background:${hex};color:${(c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 140 ? '#111' : '#fff'};border:1px solid rgba(0,0,0,.18);border-radius:8px;padding:6px 8px;font-size:11px;`;
      b.addEventListener('click', () => navigator.clipboard?.writeText(hex));
      box.append(b);
    });
  }

  function updateDownload(canvas, file) {
    const link = $('pixelArtDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const name = file?.name?.replace(/\.[^.]+$/, '') || 'pixel-art';
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = `${name}-ultra-detail-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  async function runUltra() {
    if (!isEnabled()) return false;
    const { img, file } = await loadImage();
    const tw = Math.round(readNum('pixelArtWidth', 64, 8, 512));
    const th = Math.round(readNum('pixelArtHeight', 64, 8, 512));
    const scale = Math.round(readNum('pixelArtScale', tw <= 32 ? 14 : 8, 1, 64));
    const count = Math.round(readNum('pixelArtColors', tw <= 32 ? 64 : 96, 4, 256));
    const opt = {
      microDetail: readNum('pixelArtMicroDetail', 72, 0, 100) / 100,
      tonePattern: readNum('pixelArtTonePattern', 46, 0, 100) / 100,
      featureBoost: readNum('pixelArtFeatureBoost', 64, 0, 100) / 100,
      contrast: readNum('pixelArtContrast', 8, -100, 100),
      saturation: readNum('pixelArtSaturation', 8, -100, 120),
    };

    const small = renderSmall(img, tw, th, opt);
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, tw, th);
    const pal = palette(image.data, count);
    quantize(image.data, pal, clamp(0.5 + opt.microDetail * 0.18, 0.5, 0.72));
    accentDetails(image.data, tw, th, opt.featureBoost);
    ctx.putImageData(image, 0, 0);
    fillBackground(ctx, tw, th);

    const result = $('pixelArtResultCanvas');
    result.width = tw * scale;
    result.height = th * scale;
    result.style.maxWidth = '100%';
    result.style.imageRendering = 'pixelated';
    const rctx = result.getContext('2d', { willReadFrequently: true });
    rctx.imageSmoothingEnabled = false;
    rctx.clearRect(0, 0, result.width, result.height);
    rctx.drawImage(small, 0, 0, result.width, result.height);

    renderPalette(pal);
    updateDownload(result, file);
    setStatus(`초저해상도 디테일 압축 완료: ${tw}x${th}, ${pal.length}색, 미세 디테일 ${Math.round(opt.microDetail * 100)}`);
    return true;
  }

  function scheduleRun() {
    if (!isEnabled() || !$('pixelArtInput')?.files?.[0] || !$('pixelArtAutoRun')?.checked) return;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => runUltra().catch(() => {}), 140);
  }

  function intercept() {
    const button = $('pixelArtRunButton');
    if (!button || button.dataset.ultraDetailBound === 'true') return;
    button.dataset.ultraDetailBound = 'true';
    button.addEventListener('click', (event) => {
      if (!isEnabled()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      runUltra().catch(() => setStatus('초저해상도 디테일 압축에 실패했습니다.'));
    }, true);
  }

  function bindAuto() {
    ['pixelArtInput', 'pixelArtWidth', 'pixelArtHeight', 'pixelArtColors', 'pixelArtScale', 'pixelArtContrast', 'pixelArtSaturation', 'pixelArtBackground', 'pixelArtUltraDetail', 'pixelArtMicroDetail', 'pixelArtTonePattern', 'pixelArtFeatureBoost'].forEach((id) => {
      const el = $(id);
      if (!el || el.dataset.ultraAutoBound === 'true') return;
      el.dataset.ultraAutoBound = 'true';
      el.addEventListener('input', scheduleRun);
      el.addEventListener('change', scheduleRun);
    });
  }

  function install() {
    installControls();
    intercept();
    bindAuto();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
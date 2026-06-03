(() => {
  const CONTROL_ID = 'pixelArtUnifiedModeControls';
  let sourceUrl = '';
  let downloadUrl = '';
  let pendingTimer = null;
  let running = false;

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function readNum(id, fallback, min, max) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  }
  function setStatus(text) { const s = $('pixelArtStatus'); if (s) s.textContent = text; }
  function ultraOn() { return Boolean($('pixelArtUltraDetail')?.checked); }
  function smartOn() { return Boolean($('pixelArtSmartDetail')?.checked); }
  function activeMode() { return ultraOn() ? 'ultra' : smartOn() ? 'smart' : 'base'; }

  function installControls() {
    if ($(CONTROL_ID)) return;
    const target = $('pixelArtPreset')?.closest('.grid-2');
    const parent = target?.parentElement;
    if (!target || !parent) return;

    const row = document.createElement('div');
    row.id = CONTROL_ID;
    row.className = 'grid-2';
    row.innerHTML = `
      <label class="check-label"><input id="pixelArtSmartDetail" type="checkbox"> 스마트 원형 보존</label>
      <label class="check-label"><input id="pixelArtUltraDetail" type="checkbox"> 초저해상도 디테일 압축</label>
      <label>원형 보존 <input id="pixelArtShapePreserve" type="range" min="0" max="100" value="72"></label>
      <label>디테일 강도 <input id="pixelArtDetailPower" type="range" min="0" max="100" value="48"></label>
      <label>미세 디테일 <input id="pixelArtMicroDetail" type="range" min="0" max="100" value="72"></label>
      <label>명암 패턴 <input id="pixelArtTonePattern" type="range" min="0" max="100" value="46"></label>
      <label>특징점 강조 <input id="pixelArtFeatureBoost" type="range" min="0" max="100" value="64"></label>
      <label>선명도 <input id="pixelArtSharpness" type="range" min="0" max="100" value="34"></label>
      <label>형태 단순화 <input id="pixelArtShapeSimplify" type="range" min="0" max="100" value="22"></label>
    `;
    parent.insertBefore(row, target.nextSibling);

    const colors = $('pixelArtColors');
    if (colors) colors.max = '256';

    const help = document.createElement('div');
    help.className = 'status';
    help.textContent = '스마트/초저해상도 모드는 꺼진 상태로 시작합니다. 초저해상도 디테일 압축이 켜져 있으면 그 모드가 우선 적용됩니다.';
    row.after(help);
  }

  function syncFloating() {
    const pairs = [
      ['pixelArtSmartDetail', 'pixelFloatingSmart'],
      ['pixelArtUltraDetail', 'pixelFloatingUltra'],
      ['pixelArtAutoRun', 'pixelFloatingAuto'],
    ];
    pairs.forEach(([a, b]) => {
      const source = $(a);
      const floating = $(b);
      if (source && floating) floating.checked = source.checked;
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

  function drawSourcePreview(img) {
    const canvas = $('pixelArtSourceCanvas');
    if (!canvas) return;
    const max = 420;
    const ratio = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

  function lum(data, width, height, x, y) {
    const xx = clamp(x, 0, width - 1);
    const yy = clamp(y, 0, height - 1);
    const i = (yy * width + xx) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function buildImportance(data, width, height) {
    const edge = new Float32Array(width * height);
    const mass = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const a = data[i + 3] / 255;
        if (a <= 0.02) continue;
        const center = lum(data, width, height, x, y);
        const dx = Math.abs(lum(data, width, height, x - 1, y) - lum(data, width, height, x + 1, y));
        const dy = Math.abs(lum(data, width, height, x, y - 1) - lum(data, width, height, x, y + 1));
        const contrast = Math.max(dx, dy);
        const darkFeature = center < 90 ? (90 - center) / 90 : 0;
        const brightFeature = center > 190 ? (center - 190) / 65 : 0;
        edge[y * width + x] = a * clamp(contrast / 72 + darkFeature * 0.5 + brightFeature * 0.2, 0, 2.5);
        mass[y * width + x] = a * (0.55 + Math.min(0.45, center / 255));
      }
    }
    return { edge, mass };
  }

  function bucketKey(r, g, b, size = 18) {
    return `${Math.round(r / size) * size},${Math.round(g / size) * size},${Math.round(b / size) * size}`;
  }

  function samplePixel(data, edge, mass, sw, sh, tw, th, tx, ty, mode, options) {
    const sx0 = Math.floor((tx / tw) * sw);
    const sx1 = Math.max(sx0 + 1, Math.ceil(((tx + 1) / tw) * sw));
    const sy0 = Math.floor((ty / th) * sh);
    const sy1 = Math.max(sy0 + 1, Math.ceil(((ty + 1) / th) * sh));
    const cx = ((tx + 0.5) / tw) * sw;
    const cy = ((ty + 0.5) / th) * sh;

    let ar = 0, ag = 0, ab = 0, aa = 0, aw = 0;
    let fr = 0, fg = 0, fb = 0, fa = 0, fw = 0;
    let minL = 255, maxL = 0, dark = null, light = null;
    const buckets = new Map();

    for (let y = sy0; y < Math.min(sh, sy1); y += 1) {
      for (let x = sx0; x < Math.min(sw, sx1); x += 1) {
        const i = (y * sw + x) * 4;
        const alpha = data[i + 3] / 255;
        if (alpha <= 0.02) continue;
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const centerWeight = 1 / (1 + dist * 0.16);
        const e = edge[y * sw + x];
        const m = mass[y * sw + x];
        const shapeW = mode === 'smart' ? options.shapePreserve * 2.9 : options.shapePreserve * 1.6;
        const detailW = mode === 'ultra' ? options.featureBoost * 5.8 + options.microDetail * 2.4 : options.detailPower * 1.7;
        const weight = alpha * centerWeight * (1 + m * shapeW);
        const featureWeight = weight * (1 + e * detailW);

        ar += data[i] * weight; ag += data[i + 1] * weight; ab += data[i + 2] * weight; aa += data[i + 3] * weight; aw += weight;
        fr += data[i] * featureWeight; fg += data[i + 1] * featureWeight; fb += data[i + 2] * featureWeight; fa += data[i + 3] * featureWeight; fw += featureWeight;

        const key = bucketKey(data[i], data[i + 1], data[i + 2]);
        const prev = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0 };
        prev.r += data[i] * weight; prev.g += data[i + 1] * weight; prev.b += data[i + 2] * weight; prev.w += weight;
        buckets.set(key, prev);

        if (l < minL) { minL = l; dark = [data[i], data[i + 1], data[i + 2], data[i + 3]]; }
        if (l > maxL) { maxL = l; light = [data[i], data[i + 1], data[i + 2], data[i + 3]]; }
      }
    }

    if (!aw) return [0, 0, 0, 0];
    const avg = [ar / aw, ag / aw, ab / aw, aa / aw];
    const feat = fw ? [fr / fw, fg / fw, fb / fw, fa / fw] : avg;
    const dominant = Array.from(buckets.values()).sort((a, b) => b.w - a.w)[0];
    const dom = dominant ? [dominant.r / dominant.w, dominant.g / dominant.w, dominant.b / dominant.w] : avg;

    const featureMix = mode === 'ultra' ? clamp(options.microDetail * 0.55, 0, 0.6) : clamp(options.detailPower * 0.22, 0, 0.28);
    const domMix = mode === 'smart' ? clamp(0.18 + options.shapePreserve * 0.28, 0.18, 0.46) : clamp(0.14 + options.shapePreserve * 0.16, 0.14, 0.32);
    let out = [
      avg[0] * (1 - featureMix - domMix) + feat[0] * featureMix + dom[0] * domMix,
      avg[1] * (1 - featureMix - domMix) + feat[1] * featureMix + dom[1] * domMix,
      avg[2] * (1 - featureMix - domMix) + feat[2] * featureMix + dom[2] * domMix,
      Math.max(avg[3], feat[3] * 0.82),
    ];

    const toneRange = maxL - minL;
    if (mode === 'ultra' && toneRange > 42 && dark && light && options.tonePattern > 0.05) {
      const chosen = ((tx + ty) & 1) === 0 ? dark : light;
      const mix = clamp(options.tonePattern * Math.min(1, toneRange / 120) * 0.34, 0, 0.34);
      out[0] = out[0] * (1 - mix) + chosen[0] * mix;
      out[1] = out[1] * (1 - mix) + chosen[1] * mix;
      out[2] = out[2] * (1 - mix) + chosen[2] * mix;
    }

    return out.map((v) => Math.round(clamp(v, 0, 255)));
  }

  function renderSmall(img, targetWidth, targetHeight, mode, options) {
    const source = document.createElement('canvas');
    const sourceMax = Math.max(targetWidth * (mode === 'ultra' ? 18 : 14), mode === 'ultra' ? 768 : 640);
    const sourceScale = Math.min(1, sourceMax / Math.max(img.naturalWidth, img.naturalHeight));
    source.width = Math.max(targetWidth, Math.round(img.naturalWidth * sourceScale));
    source.height = Math.max(targetHeight, Math.round(img.naturalHeight * sourceScale));
    const sctx = source.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(img, 0, 0, source.width, source.height);
    const sdata = sctx.getImageData(0, 0, source.width, source.height);
    adjust(sdata.data, options.contrast, options.saturation);
    const { edge, mass } = buildImportance(sdata.data, source.width, source.height);

    const small = document.createElement('canvas');
    small.width = targetWidth;
    small.height = targetHeight;
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const output = ctx.createImageData(targetWidth, targetHeight);
    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const c = samplePixel(sdata.data, edge, mass, source.width, source.height, targetWidth, targetHeight, x, y, mode, options);
        const i = (y * targetWidth + x) * 4;
        output.data[i] = c[0]; output.data[i + 1] = c[1]; output.data[i + 2] = c[2]; output.data[i + 3] = c[3];
      }
    }
    ctx.putImageData(output, 0, 0);
    return small;
  }

  function makePalette(data, count) {
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

  function nearest(r, g, b, palette) {
    let best = palette[0] || [r, g, b];
    let bestD = Infinity;
    for (const c of palette) {
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function quantize(data, palette, amount) {
    const mix = clamp(amount, 0, 1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const c = nearest(data[i], data[i + 1], data[i + 2], palette);
      data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
      data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
      data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
    }
  }

  function refine(data, width, height, sharpness, outline, simplify) {
    const copy = new Uint8ClampedArray(data);
    const s = sharpness / 100;
    const o = outline / 100;
    const simple = simplify / 100;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] < 16) continue;
        let nr = 0, ng = 0, nb = 0, n = 0, edge = 0;
        const center = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        for (let yy = y - 1; yy <= y + 1; yy += 1) {
          for (let xx = x - 1; xx <= x + 1; xx += 1) {
            if (xx === x && yy === y) continue;
            const ni = (yy * width + xx) * 4;
            nr += copy[ni]; ng += copy[ni + 1]; nb += copy[ni + 2]; n += 1;
            const l = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
            edge = Math.max(edge, Math.abs(center - l));
          }
        }
        const avgR = nr / n, avgG = ng / n, avgB = nb / n;
        const e = clamp(edge / 75, 0, 1);
        data[i] = clamp(data[i] * (1 - simple * 0.28) + avgR * simple * 0.28 + (copy[i] - avgR) * s * 0.55 * e, 0, 255);
        data[i + 1] = clamp(data[i + 1] * (1 - simple * 0.28) + avgG * simple * 0.28 + (copy[i + 1] - avgG) * s * 0.55 * e, 0, 255);
        data[i + 2] = clamp(data[i + 2] * (1 - simple * 0.28) + avgB * simple * 0.28 + (copy[i + 2] - avgB) * s * 0.55 * e, 0, 255);
        if (edge > 35 && o > 0) {
          const darken = 1 - o * 0.24 * e;
          data[i] *= darken; data[i + 1] *= darken; data[i + 2] *= darken;
        }
      }
    }
  }

  function fillBackground(ctx, width, height) {
    const bg = $('pixelArtBackground')?.value || 'transparent';
    if (bg === 'transparent') return;
    const map = { white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128] };
    const color = map[bg] || map.white;
    const image = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < image.data.length; i += 4) {
      if (image.data[i + 3] === 0) {
        image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function drawPalette(palette) {
    const box = $('pixelArtPalette');
    if (!box) return;
    box.innerHTML = '';
    palette.forEach((c) => {
      const hex = `#${c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.textContent = hex;
      swatch.title = hex;
      swatch.style.cssText = `background:${hex};color:${(c[0] * 299 + c[1] * 587 + c[2] * 114) / 1000 > 140 ? '#111' : '#fff'};border:1px solid rgba(0,0,0,.18);border-radius:8px;padding:6px 8px;font-size:11px;`;
      swatch.addEventListener('click', () => navigator.clipboard?.writeText(hex));
      box.append(swatch);
    });
  }

  function updateDownload(canvas, file, mode) {
    const link = $('pixelArtDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const name = file?.name?.replace(/\.[^.]+$/, '') || 'pixel-art';
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = `${name}-${mode}-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  async function runMode(mode) {
    if (running) return;
    running = true;
    try {
      const { img, file } = await loadImage();
      drawSourcePreview(img);
      const targetWidth = Math.round(readNum('pixelArtWidth', 64, 8, 512));
      const targetHeight = Math.round(readNum('pixelArtHeight', 64, 8, 512));
      const scale = Math.round(readNum('pixelArtScale', targetWidth <= 32 ? 14 : 8, 1, 64));
      const colorCount = Math.round(readNum('pixelArtColors', targetWidth <= 32 ? 64 : 96, 4, 256));
      const options = {
        shapePreserve: readNum('pixelArtShapePreserve', 72, 0, 100) / 100,
        detailPower: readNum('pixelArtDetailPower', 48, 0, 100) / 100,
        microDetail: readNum('pixelArtMicroDetail', 72, 0, 100) / 100,
        tonePattern: readNum('pixelArtTonePattern', 46, 0, 100) / 100,
        featureBoost: readNum('pixelArtFeatureBoost', 64, 0, 100) / 100,
        contrast: readNum('pixelArtContrast', 8, -100, 100),
        saturation: readNum('pixelArtSaturation', 8, -100, 120),
      };
      const small = renderSmall(img, targetWidth, targetHeight, mode, options);
      const ctx = small.getContext('2d', { willReadFrequently: true });
      const image = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const palette = makePalette(image.data, colorCount);
      quantize(image.data, palette, mode === 'ultra' ? 0.66 : 0.55);
      refine(image.data, targetWidth, targetHeight, readNum('pixelArtSharpness', 34, 0, 100), readNum('pixelArtOutline', 10, 0, 100), readNum('pixelArtShapeSimplify', 22, 0, 100));
      ctx.putImageData(image, 0, 0);
      fillBackground(ctx, targetWidth, targetHeight);

      const result = $('pixelArtResultCanvas');
      result.width = targetWidth * scale;
      result.height = targetHeight * scale;
      result.style.maxWidth = '100%';
      result.style.imageRendering = 'pixelated';
      const out = result.getContext('2d', { willReadFrequently: true });
      out.imageSmoothingEnabled = false;
      out.clearRect(0, 0, result.width, result.height);
      out.drawImage(small, 0, 0, result.width, result.height);

      drawPalette(palette);
      updateDownload(result, file, mode);
      setStatus(`${mode === 'ultra' ? '초저해상도 디테일 압축' : '스마트 원형 보존'} 완료: ${targetWidth}x${targetHeight}, ${palette.length}색, ${scale}x 확대`);
    } catch (error) {
      setStatus('변환에 실패했습니다. 이미지를 다시 선택해 주세요.');
    } finally {
      running = false;
    }
  }

  function scheduleRun() {
    if (!$('pixelArtAutoRun')?.checked || !$('pixelArtInput')?.files?.[0]) return;
    const mode = activeMode();
    if (mode === 'base') return;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => runMode(mode), 140);
  }

  function interceptRunButton() {
    const button = $('pixelArtRunButton');
    if (!button || button.dataset.unifiedModesBound === 'true') return;
    button.dataset.unifiedModesBound = 'true';
    button.addEventListener('click', (event) => {
      const mode = activeMode();
      if (mode === 'base') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      runMode(mode);
    }, true);
  }

  function bindControls() {
    const ids = [
      'pixelArtInput', 'pixelArtWidth', 'pixelArtHeight', 'pixelArtColors', 'pixelArtScale',
      'pixelArtContrast', 'pixelArtSaturation', 'pixelArtOutline', 'pixelArtBackground',
      'pixelArtSmartDetail', 'pixelArtUltraDetail', 'pixelArtShapePreserve', 'pixelArtDetailPower',
      'pixelArtMicroDetail', 'pixelArtTonePattern', 'pixelArtFeatureBoost', 'pixelArtSharpness', 'pixelArtShapeSimplify',
    ];
    ids.forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.unifiedModesAutoBound === 'true') return;
      element.dataset.unifiedModesAutoBound = 'true';
      element.addEventListener('input', () => { syncFloating(); scheduleRun(); });
      element.addEventListener('change', () => { syncFloating(); scheduleRun(); });
    });
  }

  function install() {
    installControls();
    interceptRunButton();
    bindControls();
    syncFloating();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
(() => {
  const CONTROL_ID = 'pixelArtSmartDetailControls';
  let sourceUrl = '';
  let downloadUrl = '';
  let pendingTimer = null;

  function $(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function readNumber(id, fallback, min, max) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  }
  function setStatus(text) { const status = $('pixelArtStatus'); if (status) status.textContent = text; }
  function isSmartEnabled() { return Boolean($('pixelArtSmartDetail')?.checked); }

  function loadImageFromInput() {
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

  function installControls() {
    if ($(CONTROL_ID)) return;
    const target = $('pixelArtPreset')?.closest('.grid-2');
    const parent = target?.parentElement;
    if (!target || !parent) return;

    const row = document.createElement('div');
    row.id = CONTROL_ID;
    row.className = 'grid-2';
    row.innerHTML = `
      <label class="check-label"><input id="pixelArtSmartDetail" type="checkbox" checked> 스마트 원형 보존</label>
      <label>원형 보존 <input id="pixelArtShapePreserve" type="range" min="0" max="100" value="72"></label>
      <label>디테일 강도 <input id="pixelArtDetailPower" type="range" min="0" max="100" value="48"></label>
      <label>선명도 <input id="pixelArtSharpness" type="range" min="0" max="100" value="34"></label>
      <label>형태 단순화 <input id="pixelArtShapeSimplify" type="range" min="0" max="100" value="22"></label>
    `;
    parent.insertBefore(row, target.nextSibling);

    const colors = $('pixelArtColors');
    if (colors) {
      colors.max = '256';
      if (Number(colors.value) < 48) colors.value = '64';
      const colorText = $('pixelArtColorsText');
      if (colorText) colorText.value = colors.value;
    }

    const help = document.createElement('div');
    help.className = 'status';
    help.textContent = '32×32/64×64에서는 모든 세부 묘사를 담을 수 없으므로, 스마트 원형 보존은 실루엣·큰 명암 덩어리·중요 경계를 우선 살려 자연스러운 픽셀풍으로 변환합니다.';
    row.after(help);

    ['pixelArtSmartDetail', 'pixelArtShapePreserve', 'pixelArtDetailPower', 'pixelArtSharpness', 'pixelArtShapeSimplify'].forEach((id) => {
      $(id)?.addEventListener('input', smartConvertSoon);
      $(id)?.addEventListener('change', smartConvertSoon);
    });
  }

  function smartConvertSoon() {
    if (!$('pixelArtAutoRun')?.checked || !$('pixelArtInput')?.files?.[0] || !isSmartEnabled()) return;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => smartConvert().catch(() => {}), 120);
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

  function adjustColors(data, contrast, saturation) {
    const c = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const sat = 1 + saturation / 100;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      let r = clamp(c * (data[i] - 128) + 128, 0, 255);
      let g = clamp(c * (data[i + 1] - 128) + 128, 0, 255);
      let b = clamp(c * (data[i + 2] - 128) + 128, 0, 255);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clamp(gray + (r - gray) * sat, 0, 255);
      data[i + 1] = clamp(gray + (g - gray) * sat, 0, 255);
      data[i + 2] = clamp(gray + (b - gray) * sat, 0, 255);
    }
  }

  function lumAt(data, width, height, x, y) {
    const xx = clamp(x, 0, width - 1);
    const yy = clamp(y, 0, height - 1);
    const i = (yy * width + xx) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function buildMaps(data, width, height) {
    const edge = new Float32Array(width * height);
    const mass = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const alpha = data[i + 3] / 255;
        const l = lumAt(data, width, height, x, y);
        const dx = Math.abs(l - lumAt(data, width, height, x - 1, y)) + Math.abs(l - lumAt(data, width, height, x + 1, y));
        const dy = Math.abs(l - lumAt(data, width, height, x, y - 1)) + Math.abs(l - lumAt(data, width, height, x, y + 1));
        edge[y * width + x] = clamp((dx + dy) / 2, 0, 255);
        mass[y * width + x] = alpha * (0.55 + Math.min(0.45, l / 255));
      }
    }
    return { edge, mass };
  }

  function bucketKey(r, g, b, size = 20) {
    return `${Math.round(r / size) * size},${Math.round(g / size) * size},${Math.round(b / size) * size}`;
  }

  function sampleShapePreserving(data, edge, mass, srcWidth, srcHeight, targetWidth, targetHeight, tx, ty, options) {
    const startX = Math.floor((tx / targetWidth) * srcWidth);
    const endX = Math.max(startX + 1, Math.ceil(((tx + 1) / targetWidth) * srcWidth));
    const startY = Math.floor((ty / targetHeight) * srcHeight);
    const endY = Math.max(startY + 1, Math.ceil(((ty + 1) / targetHeight) * srcHeight));
    const cx = ((tx + 0.5) / targetWidth) * srcWidth;
    const cy = ((ty + 0.5) / targetHeight) * srcHeight;

    let wr = 0; let wg = 0; let wb = 0; let wa = 0; let total = 0;
    let maxAlpha = 0;
    const buckets = new Map();
    const detailWeight = options.detailPower * 1.9;
    const shapeWeight = options.shapePreserve * 2.8;

    for (let y = startY; y < Math.min(srcHeight, endY); y += 1) {
      for (let x = startX; x < Math.min(srcWidth, endX); x += 1) {
        const i = (y * srcWidth + x) * 4;
        const alpha = data[i + 3] / 255;
        if (alpha <= 0.02) continue;
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const center = 1 / (1 + dist * 0.16);
        const e = edge[y * srcWidth + x] / 255;
        const m = mass[y * srcWidth + x];
        const weight = alpha * center * (1 + m * shapeWeight + e * detailWeight * 0.55);
        wr += data[i] * weight;
        wg += data[i + 1] * weight;
        wb += data[i + 2] * weight;
        wa += data[i + 3] * weight;
        total += weight;
        maxAlpha = Math.max(maxAlpha, data[i + 3]);

        const key = bucketKey(data[i], data[i + 1], data[i + 2]);
        const prev = buckets.get(key) || { r: 0, g: 0, b: 0, w: 0 };
        prev.r += data[i] * weight;
        prev.g += data[i + 1] * weight;
        prev.b += data[i + 2] * weight;
        prev.w += weight;
        buckets.set(key, prev);
      }
    }

    if (!total) return [0, 0, 0, 0];
    const avg = [wr / total, wg / total, wb / total, wa / total];
    const dominant = Array.from(buckets.values()).sort((a, b) => b.w - a.w)[0];
    const dom = dominant ? [dominant.r / dominant.w, dominant.g / dominant.w, dominant.b / dominant.w] : avg;
    const domMix = clamp(0.18 + options.shapePreserve * 0.28, 0.18, 0.46);
    const alpha = options.shapePreserve > 0.55 ? Math.max(avg[3], maxAlpha * options.shapePreserve * 0.82) : avg[3];
    return [
      Math.round(avg[0] * (1 - domMix) + dom[0] * domMix),
      Math.round(avg[1] * (1 - domMix) + dom[1] * domMix),
      Math.round(avg[2] * (1 - domMix) + dom[2] * domMix),
      Math.round(clamp(alpha, 0, 255)),
    ];
  }

  function shapeDownscale(img, targetWidth, targetHeight, options) {
    const sourceCanvas = document.createElement('canvas');
    const maxSource = Math.max(targetWidth * 14, 640);
    const sourceScale = Math.min(1, maxSource / Math.max(img.naturalWidth, img.naturalHeight));
    sourceCanvas.width = Math.max(targetWidth, Math.round(img.naturalWidth * sourceScale));
    sourceCanvas.height = Math.max(targetHeight, Math.round(img.naturalHeight * sourceScale));
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = 'high';
    sourceCtx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const sourceData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    adjustColors(sourceData.data, options.contrast, options.saturation);
    const { edge, mass } = buildMaps(sourceData.data, sourceCanvas.width, sourceCanvas.height);

    const result = document.createElement('canvas');
    result.width = targetWidth;
    result.height = targetHeight;
    const ctx = result.getContext('2d', { willReadFrequently: true });
    const out = ctx.createImageData(targetWidth, targetHeight);

    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const color = sampleShapePreserving(sourceData.data, edge, mass, sourceCanvas.width, sourceCanvas.height, targetWidth, targetHeight, x, y, options);
        const i = (y * targetWidth + x) * 4;
        out.data[i] = color[0]; out.data[i + 1] = color[1]; out.data[i + 2] = color[2]; out.data[i + 3] = color[3];
      }
    }
    ctx.putImageData(out, 0, 0);
    return result;
  }

  function averageBucket(bucket) {
    let r = 0; let g = 0; let b = 0; let w = 0;
    bucket.forEach((p) => { r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; w += p[3]; });
    w = Math.max(1, w);
    return [Math.round(r / w), Math.round(g / w), Math.round(b / w)];
  }

  function medianCut(pixels, count) {
    if (!pixels.length) return [[0, 0, 0]];
    let buckets = [pixels.slice()];
    while (buckets.length < count) {
      buckets.sort((a, b) => b.length - a.length);
      const bucket = buckets.shift();
      if (!bucket || bucket.length <= 1) { if (bucket) buckets.push(bucket); break; }
      const ranges = [0, 1, 2].map((ch) => Math.max(...bucket.map((p) => p[ch])) - Math.min(...bucket.map((p) => p[ch])));
      const channel = ranges.indexOf(Math.max(...ranges));
      bucket.sort((a, b) => a[channel] - b[channel]);
      const mid = Math.floor(bucket.length / 2);
      buckets.push(bucket.slice(0, mid), bucket.slice(mid));
    }
    return buckets.filter(Boolean).map(averageBucket).slice(0, count);
  }

  function extractPalette(data, count) {
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      pixels.push([data[i], data[i + 1], data[i + 2], data[i + 3] / 255]);
    }
    return medianCut(pixels, count);
  }

  function nearestColor(r, g, b, palette) {
    let best = palette[0] || [r, g, b];
    let bestDistance = Infinity;
    palette.forEach((color) => {
      const dr = r - color[0]; const dg = g - color[1]; const db = b - color[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDistance) { bestDistance = dist; best = color; }
    });
    return best;
  }

  function quantizeSoft(data, palette, amount) {
    const mix = clamp(amount, 0, 1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const c = nearestColor(data[i], data[i + 1], data[i + 2], palette);
      data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
      data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
      data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
    }
  }

  function refineNaturalEdges(data, width, height, sharpness, outline) {
    const copy = new Uint8ClampedArray(data);
    const s = sharpness / 100;
    const o = outline / 100;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] < 16) continue;
        const center = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        let edge = 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const lum = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
          edge = Math.max(edge, Math.abs(center - lum));
        });
        const t = clamp(edge / 90, 0, 1);
        data[i] = clamp(copy[i] + (copy[i] - 128) * s * t * 0.22, 0, 255);
        data[i + 1] = clamp(copy[i + 1] + (copy[i + 1] - 128) * s * t * 0.22, 0, 255);
        data[i + 2] = clamp(copy[i + 2] + (copy[i + 2] - 128) * s * t * 0.22, 0, 255);
        if (edge > 45 && o > 0) {
          const darken = 1 - o * 0.18;
          data[i] *= darken; data[i + 1] *= darken; data[i + 2] *= darken;
        }
      }
    }
  }

  function simplifyShapes(data, width, height, amount) {
    if (amount <= 0) return;
    const copy = new Uint8ClampedArray(data);
    const mix = clamp(amount * 0.55, 0, 0.55);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        const counts = new Map();
        for (let ny = y - 1; ny <= y + 1; ny += 1) {
          for (let nx = x - 1; nx <= x + 1; nx += 1) {
            const ni = (ny * width + nx) * 4;
            if (copy[ni + 3] < 16) continue;
            const key = bucketKey(copy[ni], copy[ni + 1], copy[ni + 2], 18);
            const prev = counts.get(key) || { r: 0, g: 0, b: 0, n: 0 };
            prev.r += copy[ni]; prev.g += copy[ni + 1]; prev.b += copy[ni + 2]; prev.n += 1;
            counts.set(key, prev);
          }
        }
        const best = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
        if (best && best.n >= 4) {
          data[i] = Math.round(data[i] * (1 - mix) + (best.r / best.n) * mix);
          data[i + 1] = Math.round(data[i + 1] * (1 - mix) + (best.g / best.n) * mix);
          data[i + 2] = Math.round(data[i + 2] * (1 - mix) + (best.b / best.n) * mix);
        }
      }
    }
  }

  function fillBackground(ctx, width, height) {
    const bg = $('pixelArtBackground')?.value || 'transparent';
    if (bg === 'transparent') return;
    const map = { white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128] };
    const color = map[bg] || map.white;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) { data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255; }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function renderPalette(palette) {
    const box = $('pixelArtPalette');
    if (!box) return;
    box.innerHTML = '';
    palette.forEach((color) => {
      const hex = `#${color.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
      const swatch = document.createElement('button');
      swatch.type = 'button'; swatch.textContent = hex; swatch.title = hex;
      swatch.style.cssText = `background:${hex};color:${(color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000 > 140 ? '#111' : '#fff'};border:1px solid rgba(0,0,0,.18);border-radius:8px;padding:6px 8px;font-size:11px;`;
      swatch.addEventListener('click', () => navigator.clipboard?.writeText(hex));
      box.append(swatch);
    });
  }

  function updateDownload(canvas, file) {
    const link = $('pixelArtDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const sourceName = file?.name?.replace(/\.[^.]+$/, '') || 'pixel-art';
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = `${sourceName}-shape-preserved-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  async function smartConvert() {
    if (!isSmartEnabled()) return false;
    const { img, file } = await loadImageFromInput();
    drawSourcePreview(img);

    const targetWidth = Math.round(readNumber('pixelArtWidth', 64, 8, 512));
    const targetHeight = Math.round(readNumber('pixelArtHeight', 64, 8, 512));
    const scale = Math.round(readNumber('pixelArtScale', 8, 1, 48));
    const colors = Math.round(readNumber('pixelArtColors', targetWidth <= 32 ? 48 : 72, 4, 256));
    const shapePreserve = readNumber('pixelArtShapePreserve', 72, 0, 100) / 100;
    const detailPower = readNumber('pixelArtDetailPower', 48, 0, 100) / 100;
    const sharpness = readNumber('pixelArtSharpness', 34, 0, 100);
    const simplify = readNumber('pixelArtShapeSimplify', 22, 0, 100) / 100;
    const contrast = readNumber('pixelArtContrast', 8, -100, 100);
    const saturation = readNumber('pixelArtSaturation', 8, -100, 120);
    const outline = readNumber('pixelArtOutline', 12, 0, 100);

    const small = shapeDownscale(img, targetWidth, targetHeight, { shapePreserve, detailPower, contrast, saturation });
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const palette = extractPalette(imageData.data, colors);
    quantizeSoft(imageData.data, palette, clamp(0.48 + simplify * 0.22, 0.42, 0.72));
    simplifyShapes(imageData.data, targetWidth, targetHeight, simplify);
    refineNaturalEdges(imageData.data, targetWidth, targetHeight, sharpness, outline);
    ctx.putImageData(imageData, 0, 0);
    fillBackground(ctx, targetWidth, targetHeight);

    const result = $('pixelArtResultCanvas');
    result.width = targetWidth * scale;
    result.height = targetHeight * scale;
    result.style.maxWidth = '100%';
    result.style.imageRendering = 'pixelated';
    const outCtx = result.getContext('2d', { willReadFrequently: true });
    outCtx.imageSmoothingEnabled = false;
    outCtx.clearRect(0, 0, result.width, result.height);
    outCtx.drawImage(small, 0, 0, result.width, result.height);

    renderPalette(palette);
    updateDownload(result, file);
    setStatus(`원형 보존 픽셀 변환 완료: ${targetWidth}x${targetHeight}, ${palette.length}색, ${scale}x 확대`);
    return true;
  }

  function interceptRunButton() {
    const button = $('pixelArtRunButton');
    if (!button || button.dataset.smartDetailBound === 'true') return;
    button.dataset.smartDetailBound = 'true';
    button.addEventListener('click', (event) => {
      if (!isSmartEnabled()) return;
      event.preventDefault(); event.stopImmediatePropagation();
      smartConvert().catch(() => setStatus('원형 보존 픽셀 변환에 실패했습니다.'));
    }, true);
  }

  function installAutoHooks() {
    ['pixelArtInput', 'pixelArtWidth', 'pixelArtHeight', 'pixelArtColors', 'pixelArtScale', 'pixelArtContrast', 'pixelArtSaturation', 'pixelArtOutline', 'pixelArtBackground', 'pixelArtSmartDetail', 'pixelArtShapePreserve', 'pixelArtDetailPower', 'pixelArtSharpness', 'pixelArtShapeSimplify'].forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.smartAutoBound === 'true') return;
      element.dataset.smartAutoBound = 'true';
      element.addEventListener('input', smartConvertSoon);
      element.addEventListener('change', smartConvertSoon);
    });
  }

  function install() {
    installControls();
    interceptRunButton();
    installAutoHooks();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
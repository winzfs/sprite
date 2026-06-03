(() => {
  const CONTROL_ID = 'pixelArtSmartDetailControls';
  let sourceUrl = '';
  let downloadUrl = '';

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function readNumber(id, fallback, min, max) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  }

  function setStatus(text) {
    const status = $('pixelArtStatus');
    if (status) status.textContent = text;
  }

  function isSmartEnabled() {
    return Boolean($('pixelArtSmartDetail')?.checked);
  }

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
      <label class="check-label"><input id="pixelArtSmartDetail" type="checkbox" checked> 스마트 디테일 보존</label>
      <label>디테일 강도 <input id="pixelArtDetailPower" type="range" min="0" max="100" value="72"></label>
      <label>선명도 <input id="pixelArtSharpness" type="range" min="0" max="100" value="58"></label>
      <label>형태 단순화 <input id="pixelArtShapeSimplify" type="range" min="0" max="100" value="28"></label>
    `;
    parent.insertBefore(row, target.nextSibling);

    $('pixelArtWidth').value = $('pixelArtWidth').value || '64';
    $('pixelArtHeight').value = $('pixelArtHeight').value || '64';
    $('pixelArtColors').max = '256';
    if (Number($('pixelArtColors').value) < 48) $('pixelArtColors').value = '64';
    const colorText = $('pixelArtColorsText');
    if (colorText) colorText.value = $('pixelArtColors').value;

    ['pixelArtSmartDetail', 'pixelArtDetailPower', 'pixelArtSharpness', 'pixelArtShapeSimplify'].forEach((id) => {
      $(id)?.addEventListener('input', () => {
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) smartConvertSoon();
      });
      $(id)?.addEventListener('change', () => {
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) smartConvertSoon();
      });
    });

    const help = document.createElement('div');
    help.className = 'status';
    help.textContent = '32×32/64×64에서는 모든 세부 묘사를 보존할 수는 없지만, 스마트 디테일 보존을 켜면 선·명암·큰 형태를 우선 살려 더 알아보기 쉽게 변환합니다.';
    row.after(help);
  }

  let pendingTimer = null;
  function smartConvertSoon() {
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => smartConvert().catch(() => {}), 80);
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

  function luminance(data, width, x, y) {
    const xx = clamp(x, 0, width - 1);
    const yy = Math.max(0, y);
    const i = (yy * width + xx) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  function buildEdgeMap(data, width, height) {
    const edge = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const gx = -luminance(data, width, x - 1, y - 1) - 2 * luminance(data, width, x - 1, y) - luminance(data, width, x - 1, y + 1)
          + luminance(data, width, x + 1, y - 1) + 2 * luminance(data, width, x + 1, y) + luminance(data, width, x + 1, y + 1);
        const gy = -luminance(data, width, x - 1, y - 1) - 2 * luminance(data, width, x, y - 1) - luminance(data, width, x + 1, y - 1)
          + luminance(data, width, x - 1, y + 1) + 2 * luminance(data, width, x, y + 1) + luminance(data, width, x + 1, y + 1);
        edge[y * width + x] = Math.min(255, Math.hypot(gx, gy) / 4);
      }
    }
    return edge;
  }

  function sampleSmart(data, edge, srcWidth, srcHeight, targetWidth, targetHeight, tx, ty, detailPower) {
    const startX = Math.floor((tx / targetWidth) * srcWidth);
    const endX = Math.max(startX + 1, Math.ceil(((tx + 1) / targetWidth) * srcWidth));
    const startY = Math.floor((ty / targetHeight) * srcHeight);
    const endY = Math.max(startY + 1, Math.ceil(((ty + 1) / targetHeight) * srcHeight));
    const cx = ((tx + 0.5) / targetWidth) * srcWidth;
    const cy = ((ty + 0.5) / targetHeight) * srcHeight;

    let wr = 0; let wg = 0; let wb = 0; let wa = 0; let total = 0;
    let bestIndex = -1;
    let bestScore = -1;
    const edgeWeight = 1 + detailPower * 5;

    for (let y = startY; y < Math.min(srcHeight, endY); y += 1) {
      for (let x = startX; x < Math.min(srcWidth, endX); x += 1) {
        const i = (y * srcWidth + x) * 4;
        const a = data[i + 3] / 255;
        if (a <= 0.02) continue;
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        const centerWeight = 1 / (1 + dist * 0.12);
        const e = edge[y * srcWidth + x] / 255;
        const weight = a * centerWeight * (1 + e * edgeWeight);
        wr += data[i] * weight;
        wg += data[i + 1] * weight;
        wb += data[i + 2] * weight;
        wa += data[i + 3] * weight;
        total += weight;
        const score = e * detailPower + centerWeight * 0.35 + a * 0.2;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    }

    if (!total || bestIndex < 0) return [0, 0, 0, 0];
    const avg = [wr / total, wg / total, wb / total, wa / total];
    const mix = clamp(detailPower * 0.42, 0, 0.42);
    return [
      Math.round(avg[0] * (1 - mix) + data[bestIndex] * mix),
      Math.round(avg[1] * (1 - mix) + data[bestIndex + 1] * mix),
      Math.round(avg[2] * (1 - mix) + data[bestIndex + 2] * mix),
      Math.round(avg[3]),
    ];
  }

  function smartDownscale(img, targetWidth, targetHeight, options) {
    const sourceCanvas = document.createElement('canvas');
    const maxSource = Math.max(targetWidth * 10, 512);
    const sourceScale = Math.min(1, maxSource / Math.max(img.naturalWidth, img.naturalHeight));
    sourceCanvas.width = Math.max(targetWidth, Math.round(img.naturalWidth * sourceScale));
    sourceCanvas.height = Math.max(targetHeight, Math.round(img.naturalHeight * sourceScale));
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = 'high';
    sourceCtx.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);

    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    adjustColors(sourceImageData.data, options.contrast, options.saturation);
    const edge = buildEdgeMap(sourceImageData.data, sourceCanvas.width, sourceCanvas.height);

    const result = document.createElement('canvas');
    result.width = targetWidth;
    result.height = targetHeight;
    const ctx = result.getContext('2d', { willReadFrequently: true });
    const out = ctx.createImageData(targetWidth, targetHeight);

    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const color = sampleSmart(sourceImageData.data, edge, sourceCanvas.width, sourceCanvas.height, targetWidth, targetHeight, x, y, options.detailPower);
        const i = (y * targetWidth + x) * 4;
        out.data[i] = color[0];
        out.data[i + 1] = color[1];
        out.data[i + 2] = color[2];
        out.data[i + 3] = color[3];
      }
    }

    ctx.putImageData(out, 0, 0);
    return result;
  }

  function extractPalette(data, count) {
    const map = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const r = Math.round(data[i] / 8) * 8;
      const g = Math.round(data[i + 1] / 8) * 8;
      const b = Math.round(data[i + 2] / 8) * 8;
      const key = `${r},${g},${b}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([key]) => key.split(',').map(Number));
  }

  function nearestColor(r, g, b, palette) {
    let best = palette[0] || [r, g, b];
    let bestDistance = Infinity;
    palette.forEach((color) => {
      const dr = r - color[0];
      const dg = g - color[1];
      const db = b - color[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDistance) {
        bestDistance = dist;
        best = color;
      }
    });
    return best;
  }

  function quantize(data, palette, strength) {
    const mix = clamp(strength, 0, 1);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const c = nearestColor(data[i], data[i + 1], data[i + 2], palette);
      data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
      data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
      data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
    }
  }

  function sharpenAndOutline(data, width, height, sharpness, outline) {
    const copy = new Uint8ClampedArray(data);
    const s = sharpness / 100;
    const o = outline / 100;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] < 16) continue;
        let edge = 0;
        const center = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const lum = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
          edge = Math.max(edge, Math.abs(center - lum));
        });
        const boost = clamp(edge / 80, 0, 1);
        data[i] = clamp(copy[i] + (copy[i] - 128) * s * boost * 0.38, 0, 255);
        data[i + 1] = clamp(copy[i + 1] + (copy[i + 1] - 128) * s * boost * 0.38, 0, 255);
        data[i + 2] = clamp(copy[i + 2] + (copy[i + 2] - 128) * s * boost * 0.38, 0, 255);
        if (edge > 38 && o > 0) {
          const darken = 1 - o * 0.34;
          data[i] *= darken;
          data[i + 1] *= darken;
          data[i + 2] *= darken;
        }
      }
    }
  }

  function simplifyShapes(data, width, height, amount) {
    if (amount <= 0) return;
    const copy = new Uint8ClampedArray(data);
    const passes = Math.round(1 + amount * 2);
    for (let pass = 0; pass < passes; pass += 1) {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          const colors = new Map();
          for (let ny = y - 1; ny <= y + 1; ny += 1) {
            for (let nx = x - 1; nx <= x + 1; nx += 1) {
              const ni = (ny * width + nx) * 4;
              const key = `${Math.round(copy[ni] / 12) * 12},${Math.round(copy[ni + 1] / 12) * 12},${Math.round(copy[ni + 2] / 12) * 12},${copy[ni + 3] > 16 ? 255 : 0}`;
              colors.set(key, (colors.get(key) || 0) + 1);
            }
          }
          const best = Array.from(colors.entries()).sort((a, b) => b[1] - a[1])[0];
          if (best && best[1] >= 5) {
            const [r, g, b, a] = best[0].split(',').map(Number);
            data[i] = Math.round(data[i] * (1 - amount) + r * amount);
            data[i + 1] = Math.round(data[i + 1] * (1 - amount) + g * amount);
            data[i + 2] = Math.round(data[i + 2] * (1 - amount) + b * amount);
            data[i + 3] = a;
          }
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
      if (data[i + 3] === 0) {
        data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
      }
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
      swatch.type = 'button';
      swatch.textContent = hex;
      swatch.title = hex;
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
      link.download = `${sourceName}-smart-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  async function smartConvert() {
    if (!isSmartEnabled()) return false;
    const { img, file } = await loadImageFromInput();
    const targetWidth = Math.round(readNumber('pixelArtWidth', 64, 8, 512));
    const targetHeight = Math.round(readNumber('pixelArtHeight', 64, 8, 512));
    const scale = Math.round(readNumber('pixelArtScale', 8, 1, 48));
    const colors = Math.round(readNumber('pixelArtColors', 64, 4, 256));
    const detailPower = readNumber('pixelArtDetailPower', 72, 0, 100) / 100;
    const sharpness = readNumber('pixelArtSharpness', 58, 0, 100);
    const simplify = readNumber('pixelArtShapeSimplify', 28, 0, 100) / 100;
    const contrast = readNumber('pixelArtContrast', 10, -100, 100);
    const saturation = readNumber('pixelArtSaturation', 10, -100, 120);
    const outline = readNumber('pixelArtOutline', 18, 0, 100);

    const small = smartDownscale(img, targetWidth, targetHeight, { detailPower, contrast, saturation });
    const ctx = small.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const palette = extractPalette(imageData.data, colors);
    quantize(imageData.data, palette, clamp(0.55 + simplify * 0.25, 0.45, 0.85));
    simplifyShapes(imageData.data, targetWidth, targetHeight, simplify * 0.45);
    sharpenAndOutline(imageData.data, targetWidth, targetHeight, sharpness, outline);
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
    setStatus(`스마트 디테일 보존 변환 완료: ${targetWidth}x${targetHeight}, ${palette.length}색, ${scale}x 확대`);
    return true;
  }

  function interceptRunButton() {
    const button = $('pixelArtRunButton');
    if (!button || button.dataset.smartDetailBound === 'true') return;
    button.dataset.smartDetailBound = 'true';
    button.addEventListener('click', (event) => {
      if (!isSmartEnabled()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      smartConvert().catch(() => setStatus('스마트 디테일 변환에 실패했습니다.'));
    }, true);
  }

  function installAutoHooks() {
    ['pixelArtWidth', 'pixelArtHeight', 'pixelArtColors', 'pixelArtScale', 'pixelArtContrast', 'pixelArtSaturation', 'pixelArtOutline', 'pixelArtBackground', 'pixelArtSmartDetail', 'pixelArtDetailPower', 'pixelArtSharpness', 'pixelArtShapeSimplify'].forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.smartAutoBound === 'true') return;
      element.dataset.smartAutoBound = 'true';
      const handler = () => {
        if (isSmartEnabled() && $('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) {
          window.clearTimeout(element._smartTimer);
          element._smartTimer = window.setTimeout(() => smartConvert().catch(() => {}), 120);
        }
      };
      element.addEventListener('input', handler);
      element.addEventListener('change', handler);
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
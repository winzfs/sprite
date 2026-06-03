(() => {
  let pendingTimer = null;
  let lastSignature = '';
  let downloadUrl = '';

  function $(id) { return document.getElementById(id); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function readNum(id, fallback, min, max) {
    const n = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(n) ? n : fallback, min, max);
  }

  function isActive() {
    return Boolean($('view-pixelArt')?.classList.contains('active')) && Boolean($('pixelArtResultCanvas')?.width);
  }

  function getScale() {
    return Math.max(1, Math.round(readNum('pixelArtScale', 8, 1, 64)));
  }

  function getBaseCanvas() {
    const result = $('pixelArtResultCanvas');
    if (!result || !result.width || !result.height) return null;
    const scale = getScale();
    const width = Math.max(1, Math.round(result.width / scale));
    const height = Math.max(1, Math.round(result.height / scale));
    const base = document.createElement('canvas');
    base.width = width;
    base.height = height;
    const ctx = base.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(result, 0, 0, width, height);
    return base;
  }

  function updateResultFromBase(base) {
    const result = $('pixelArtResultCanvas');
    if (!result || !base) return;
    const scale = getScale();
    result.width = base.width * scale;
    result.height = base.height * scale;
    result.style.imageRendering = 'pixelated';
    result.style.maxWidth = '100%';
    const ctx = result.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, result.width, result.height);
    ctx.drawImage(base, 0, 0, result.width, result.height);
    updateDownload(result);
  }

  function updateDownload(canvas) {
    const link = $('pixelArtDownloadLink');
    const input = $('pixelArtInput');
    if (!link || !canvas) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const name = input?.files?.[0]?.name?.replace(/\.[^.]+$/, '') || 'pixel-art';
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = `${name}-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  function adjustContrastSaturation(data, contrast, saturation) {
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

  function buildPalette(data, count) {
    const map = new Map();
    const step = Math.max(1, Math.floor((data.length / 4) / 12000));
    for (let p = 0; p < data.length / 4; p += step) {
      const i = p * 4;
      if (data[i + 3] < 16) continue;
      const r = Math.round(data[i] / 10) * 10;
      const g = Math.round(data[i + 1] / 10) * 10;
      const b = Math.round(data[i + 2] / 10) * 10;
      const key = `${r},${g},${b}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([key]) => key.split(',').map(Number));
  }

  function nearest(r, g, b, palette) {
    let best = palette[0] || [r, g, b];
    let bestDist = Infinity;
    for (const c of palette) {
      const dr = r - c[0];
      const dg = g - c[1];
      const db = b - c[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bestDist) { bestDist = d; best = c; }
    }
    return best;
  }

  function applyQuantize(data, width, height, palette, dither, amount) {
    const mix = clamp(amount, 0, 1);
    if (dither === 'floyd') {
      const buf = new Float32Array(data.length);
      for (let i = 0; i < data.length; i += 1) buf[i] = data[i];
      const add = (x, y, er, eg, eb, f) => {
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const i = (y * width + x) * 4;
        buf[i] += er * f; buf[i + 1] += eg * f; buf[i + 2] += eb * f;
      };
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const i = (y * width + x) * 4;
          if (data[i + 3] < 16) continue;
          const old = [clamp(buf[i], 0, 255), clamp(buf[i + 1], 0, 255), clamp(buf[i + 2], 0, 255)];
          const c = nearest(old[0], old[1], old[2], palette);
          data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
          data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
          data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
          const er = old[0] - c[0]; const eg = old[1] - c[1]; const eb = old[2] - c[2];
          add(x + 1, y, er, eg, eb, 7 / 16);
          add(x - 1, y + 1, er, eg, eb, 3 / 16);
          add(x, y + 1, er, eg, eb, 5 / 16);
          add(x + 1, y + 1, er, eg, eb, 1 / 16);
        }
      }
      return;
    }

    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 16) continue;
        const offset = dither === 'ordered' ? (bayer[y % 4][x % 4] - 7.5) * 4.8 : 0;
        const c = nearest(clamp(data[i] + offset, 0, 255), clamp(data[i + 1] + offset, 0, 255), clamp(data[i + 2] + offset, 0, 255), palette);
        data[i] = Math.round(data[i] * (1 - mix) + c[0] * mix);
        data[i + 1] = Math.round(data[i + 1] * (1 - mix) + c[1] * mix);
        data[i + 2] = Math.round(data[i + 2] * (1 - mix) + c[2] * mix);
      }
    }
  }

  function applyShapeSimplify(data, width, height, amount) {
    const a = clamp(amount / 100, 0, 1);
    if (a <= 0.02) return;
    const copy = new Uint8ClampedArray(data);
    const passes = Math.max(1, Math.round(1 + a * 3));
    for (let pass = 0; pass < passes; pass += 1) {
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const i = (y * width + x) * 4;
          if (copy[i + 3] < 16) continue;
          let r = 0, g = 0, b = 0, n = 0;
          for (let ny = y - 1; ny <= y + 1; ny += 1) {
            for (let nx = x - 1; nx <= x + 1; nx += 1) {
              const ni = (ny * width + nx) * 4;
              if (copy[ni + 3] < 16) continue;
              r += copy[ni]; g += copy[ni + 1]; b += copy[ni + 2]; n += 1;
            }
          }
          if (n >= 5) {
            data[i] = Math.round(data[i] * (1 - a * 0.42) + (r / n) * a * 0.42);
            data[i + 1] = Math.round(data[i + 1] * (1 - a * 0.42) + (g / n) * a * 0.42);
            data[i + 2] = Math.round(data[i + 2] * (1 - a * 0.42) + (b / n) * a * 0.42);
          }
        }
      }
    }
  }

  function applySharpOutline(data, width, height, sharpness, outline) {
    const s = clamp(sharpness / 100, 0, 1);
    const o = clamp(outline / 100, 0, 1);
    if (s <= 0.02 && o <= 0.02) return;
    const copy = new Uint8ClampedArray(data);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] < 16) continue;
        const center = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        let edge = 0;
        let blurR = 0, blurG = 0, blurB = 0, n = 0;
        [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]].forEach(([dx, dy]) => {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const lum = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
          edge = Math.max(edge, Math.abs(center - lum));
          blurR += copy[ni]; blurG += copy[ni + 1]; blurB += copy[ni + 2]; n += 1;
        });
        const e = clamp(edge / 70, 0, 1);
        const avgR = blurR / n, avgG = blurG / n, avgB = blurB / n;
        data[i] = clamp(data[i] + (copy[i] - avgR) * s * 0.85 * e, 0, 255);
        data[i + 1] = clamp(data[i + 1] + (copy[i + 1] - avgG) * s * 0.85 * e, 0, 255);
        data[i + 2] = clamp(data[i + 2] + (copy[i + 2] - avgB) * s * 0.85 * e, 0, 255);
        if (edge > 28 && o > 0) {
          const darken = 1 - o * 0.38 * e;
          data[i] = clamp(data[i] * darken, 0, 255);
          data[i + 1] = clamp(data[i + 1] * darken, 0, 255);
          data[i + 2] = clamp(data[i + 2] * darken, 0, 255);
        }
      }
    }
  }

  function applyEffects() {
    if (!isActive()) return;
    const base = getBaseCanvas();
    if (!base) return;
    const ctx = base.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, base.width, base.height);
    const data = imageData.data;

    const colors = Math.round(readNum('pixelArtColors', 64, 4, 256));
    const contrast = readNum('pixelArtContrast', 0, -100, 100) * 0.45;
    const saturation = readNum('pixelArtSaturation', 0, -100, 120) * 0.55;
    const simplify = readNum('pixelArtShapeSimplify', 0, 0, 100);
    const sharpness = readNum('pixelArtSharpness', 0, 0, 100);
    const outline = readNum('pixelArtOutline', 0, 0, 100);
    const dither = $('pixelArtDither')?.value || 'none';

    adjustContrastSaturation(data, contrast, saturation);
    const palette = buildPalette(data, colors);
    const quantizeAmount = dither === 'none' ? 0.55 : 0.72;
    applyQuantize(data, base.width, base.height, palette, dither, quantizeAmount);
    applyShapeSimplify(data, base.width, base.height, simplify);
    applySharpOutline(data, base.width, base.height, sharpness, outline);

    ctx.putImageData(imageData, 0, 0);
    updateResultFromBase(base);

    const status = $('pixelArtStatus');
    if (status) status.textContent = `옵션 보정 적용: ${base.width}x${base.height}, ${colors}색, ${dither}, 선명도 ${Math.round(sharpness)}, 윤곽 ${Math.round(outline)}`;
  }

  function scheduleEffects(delay = 260) {
    window.clearTimeout(pendingTimer);
    const signature = [
      $('pixelArtResultCanvas')?.width,
      $('pixelArtResultCanvas')?.height,
      $('pixelArtColors')?.value,
      $('pixelArtDither')?.value,
      $('pixelArtShapeSimplify')?.value,
      $('pixelArtSharpness')?.value,
      $('pixelArtOutline')?.value,
      $('pixelArtContrast')?.value,
      $('pixelArtSaturation')?.value,
      $('pixelArtScale')?.value,
    ].join('|');
    lastSignature = signature;
    pendingTimer = window.setTimeout(() => {
      if (lastSignature === signature) applyEffects();
    }, delay);
  }

  function bind() {
    const ids = ['pixelArtColors', 'pixelArtDither', 'pixelArtShapeSimplify', 'pixelArtSharpness', 'pixelArtOutline', 'pixelArtContrast', 'pixelArtSaturation', 'pixelArtScale'];
    ids.forEach((id) => {
      const el = $(id);
      if (!el || el.dataset.optionEffectsBound === 'true') return;
      el.dataset.optionEffectsBound = 'true';
      el.addEventListener('input', () => scheduleEffects(420));
      el.addEventListener('change', () => scheduleEffects(420));
    });
    const run = $('pixelArtRunButton');
    if (run && run.dataset.optionEffectsRunBound !== 'true') {
      run.dataset.optionEffectsRunBound = 'true';
      run.addEventListener('pointerup', () => scheduleEffects(760), true);
      run.addEventListener('click', () => scheduleEffects(760), true);
    }
  }

  function install() {
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
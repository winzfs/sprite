(() => {
  const BOUND_KEY = 'darkColorFixBound';

  function $(id) {
    return document.getElementById(id);
  }

  function parseHex(hex) {
    const normalized = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.slice(1) : '000000';
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
  }

  function luminance(r, g, b) {
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function distanceSq(r, g, b, target) {
    const dr = r - target.r;
    const dg = g - target.g;
    const db = b - target.b;
    return dr * dr + dg * dg + db * db;
  }

  function readNumber(input, fallback) {
    const value = Number.parseInt(input?.value, 10);
    return Number.isFinite(value) ? value : fallback;
  }

  function readStrengthBoost() {
    const key = $('bgRemoveStrength')?.value || 'normal';
    if (key === 'precise') return 8;
    if (key === 'clean') return 34;
    if (key === 'aggressive') return 58;
    return 22;
  }

  function isDarkTarget(target) {
    return Math.max(target.r, target.g, target.b) <= 42 && luminance(target.r, target.g, target.b) <= 36;
  }

  function shouldRemovePixel(data, index, target, tolerance, darkMode, darkThreshold) {
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];
    if (a === 0) return false;

    const normalMatch = distanceSq(r, g, b, target) <= tolerance * tolerance;
    if (normalMatch) return true;

    if (!darkMode) return false;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const luma = luminance(r, g, b);
    const chroma = max - min;

    return max <= darkThreshold && luma <= darkThreshold * 0.92 && chroma <= Math.max(18, darkThreshold * 0.42);
  }

  function pixelIndex(width, x, y) {
    return (y * width + x) * 4;
  }

  function cleanupDarkEdges(data, width, height, target, tolerance, darkMode, darkThreshold) {
    const removeIndexes = new Set();
    const edgeThreshold = darkMode ? Math.min(150, darkThreshold + 18) : Math.min(255, tolerance + readStrengthBoost());

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = pixelIndex(width, x, y);
        if (data[i + 3] === 0) continue;

        let transparentNeighbor = false;
        for (let ny = y - 1; ny <= y + 1 && !transparentNeighbor; ny += 1) {
          for (let nx = x - 1; nx <= x + 1; nx += 1) {
            if (nx === x && ny === y) continue;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            if (data[pixelIndex(width, nx, ny) + 3] === 0) {
              transparentNeighbor = true;
              break;
            }
          }
        }

        if (!transparentNeighbor) continue;
        if (shouldRemovePixel(data, i, target, edgeThreshold, darkMode, edgeThreshold)) removeIndexes.add(i);
      }
    }

    removeIndexes.forEach((i) => {
      data[i + 3] = 0;
    });
    return removeIndexes.size;
  }

  function updateDownload(canvas, imageName) {
    const link = $('bgRemoveDownloadLink');
    if (!link) return;
    if (link.dataset.objectUrl) URL.revokeObjectURL(link.dataset.objectUrl);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      link.dataset.objectUrl = url;
      link.href = url;
      link.download = `${imageName || 'transparent-background'}-transparent.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  function applyRobustRemoval() {
    const originalCanvas = $('bgRemoveOriginalCanvas');
    const resultCanvas = $('bgRemoveResultCanvas');
    const colorInput = $('bgRemoveColor');
    const toleranceInput = $('bgRemoveTolerance');
    const cleanupInput = $('bgRemoveCleanupInput');
    const status = $('bgRemoveStatus');

    if (!originalCanvas || !resultCanvas || !originalCanvas.width || !originalCanvas.height || !colorInput) return false;

    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
    resultCanvas.width = originalCanvas.width;
    resultCanvas.height = originalCanvas.height;
    resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    resultCtx.drawImage(originalCanvas, 0, 0);

    const imageData = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
    const data = imageData.data;
    const target = parseHex(colorInput.value);
    const tolerance = Math.max(0, Math.min(180, readNumber(toleranceInput, 34)));
    const darkMode = isDarkTarget(target);
    const darkThreshold = darkMode ? Math.min(145, Math.max(8, tolerance + readStrengthBoost() + 18)) : tolerance;
    let removed = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (shouldRemovePixel(data, i, target, tolerance, darkMode, darkThreshold)) {
        data[i + 3] = 0;
        removed += 1;
      }
    }

    let edgeRemoved = 0;
    if (cleanupInput?.checked) {
      edgeRemoved = cleanupDarkEdges(data, resultCanvas.width, resultCanvas.height, target, tolerance, darkMode, darkThreshold);
    }

    resultCtx.putImageData(imageData, 0, 0);
    updateDownload(resultCanvas, $('bgRemoveInput')?.files?.[0]?.name?.replace(/\.[^.]+$/, ''));

    const total = resultCanvas.width * resultCanvas.height;
    const ratio = total ? (((removed + edgeRemoved) / total) * 100).toFixed(2) : '0.00';
    if (status) {
      const modeText = darkMode ? '검은색/어두운 배경 보정' : '색상 거리';
      const edgeText = edgeRemoved ? ` / 가장자리 ${edgeRemoved.toLocaleString()}픽셀 추가 정리` : '';
      status.textContent = `${colorInput.value} 기준 ${modeText}으로 ${(removed + edgeRemoved).toLocaleString()}픽셀을 투명 처리했습니다. (${ratio}%)${edgeText}`;
    }

    return true;
  }

  function bind() {
    const input = $('bgRemoveInput');
    const colorInput = $('bgRemoveColor');
    const colorText = $('bgRemoveColorText');
    const applyButton = $('bgRemoveApplyButton');
    const originalCanvas = $('bgRemoveOriginalCanvas');
    if (!applyButton || applyButton.dataset[BOUND_KEY] === 'true') return;

    applyButton.dataset[BOUND_KEY] = 'true';
    applyButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyRobustRemoval();
    }, true);

    ['bgRemoveColor', 'bgRemoveTolerance', 'bgRemoveStrength', 'bgRemoveCleanupInput'].forEach((id) => {
      const control = $(id);
      if (!control || control.dataset[BOUND_KEY] === 'true') return;
      control.dataset[BOUND_KEY] = 'true';
      const eventName = control.tagName === 'SELECT' || control.type === 'checkbox' ? 'change' : 'input';
      control.addEventListener(eventName, () => window.setTimeout(applyRobustRemoval, 0));
    });

    originalCanvas?.addEventListener('click', (event) => {
      window.setTimeout(() => {
        if (!originalCanvas.width || !originalCanvas.height) return;
        const rect = originalCanvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(originalCanvas.width - 1, Math.floor((event.clientX - rect.left) * (originalCanvas.width / rect.width))));
        const y = Math.max(0, Math.min(originalCanvas.height - 1, Math.floor((event.clientY - rect.top) * (originalCanvas.height / rect.height))));
        const pixel = originalCanvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
        const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);
        if (colorInput) colorInput.value = hex;
        if (colorText) colorText.value = hex;
        applyRobustRemoval();
      }, 0);
    }, true);

    input?.addEventListener('change', () => window.setTimeout(applyRobustRemoval, 80));
  }

  const observer = new MutationObserver(bind);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bind();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    bind();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();

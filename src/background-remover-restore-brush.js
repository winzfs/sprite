(() => {
  const CONTROL_ID = 'bgRemoveRestoreBrushControls';
  let isDrawing = false;
  let lastPoint = null;
  let downloadObjectUrl = '';

  function getElement(id) {
    return document.getElementById(id);
  }

  function setStatus(text) {
    const status = getElement('bgRemoveStatus');
    if (status) status.textContent = text;
  }

  function getBrushSize() {
    const input = getElement('bgRemoveRestoreBrushSize');
    const value = Number.parseInt(input?.value || '24', 10);
    return Number.isFinite(value) ? Math.max(1, Math.min(240, value)) : 24;
  }

  function isBrushEnabled() {
    return Boolean(getElement('bgRemoveRestoreBrushToggle')?.checked);
  }

  function updateBrushSizeText() {
    const text = getElement('bgRemoveRestoreBrushSizeText');
    if (text) text.value = `${getBrushSize()}px`;
  }

  function updateDownloadFromResult() {
    const resultCanvas = getElement('bgRemoveResultCanvas');
    const link = getElement('bgRemoveDownloadLink');
    const input = getElement('bgRemoveInput');
    if (!resultCanvas || !link) return;

    if (downloadObjectUrl) URL.revokeObjectURL(downloadObjectUrl);
    const fileName = input?.files?.[0]?.name?.replace(/\.[^.]+$/, '') || 'transparent-background';

    resultCanvas.toBlob((blob) => {
      if (!blob) return;
      downloadObjectUrl = URL.createObjectURL(blob);
      link.href = downloadObjectUrl;
      link.download = `${fileName}-transparent.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  function getCanvasPoint(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)))));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height)))));
    return { x, y };
  }

  function copyCircleFromOriginal(centerX, centerY, radius) {
    const originalCanvas = getElement('bgRemoveOriginalCanvas');
    const resultCanvas = getElement('bgRemoveResultCanvas');
    if (!originalCanvas || !resultCanvas || !originalCanvas.width || !resultCanvas.width) return 0;

    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
    const width = resultCanvas.width;
    const height = resultCanvas.height;
    const left = Math.max(0, Math.floor(centerX - radius));
    const top = Math.max(0, Math.floor(centerY - radius));
    const right = Math.min(width - 1, Math.ceil(centerX + radius));
    const bottom = Math.min(height - 1, Math.ceil(centerY + radius));
    const brushWidth = right - left + 1;
    const brushHeight = bottom - top + 1;
    if (brushWidth <= 0 || brushHeight <= 0) return 0;

    const originalData = originalCtx.getImageData(left, top, brushWidth, brushHeight);
    const resultData = resultCtx.getImageData(left, top, brushWidth, brushHeight);
    const rr = radius * radius;
    let restored = 0;

    for (let y = 0; y < brushHeight; y += 1) {
      for (let x = 0; x < brushWidth; x += 1) {
        const px = left + x;
        const py = top + y;
        const dx = px - centerX;
        const dy = py - centerY;
        if (dx * dx + dy * dy > rr) continue;

        const i = (y * brushWidth + x) * 4;
        if (
          resultData.data[i] !== originalData.data[i] ||
          resultData.data[i + 1] !== originalData.data[i + 1] ||
          resultData.data[i + 2] !== originalData.data[i + 2] ||
          resultData.data[i + 3] !== originalData.data[i + 3]
        ) {
          restored += 1;
        }
        resultData.data[i] = originalData.data[i];
        resultData.data[i + 1] = originalData.data[i + 1];
        resultData.data[i + 2] = originalData.data[i + 2];
        resultData.data[i + 3] = originalData.data[i + 3];
      }
    }

    resultCtx.putImageData(resultData, left, top);
    return restored;
  }

  function restoreLine(from, to) {
    const radius = getBrushSize() / 2;
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, radius * 0.45);
    const count = Math.max(1, Math.ceil(distance / step));
    let restored = 0;

    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      restored += copyCircleFromOriginal(x, y, radius);
    }
    return restored;
  }

  function installControls() {
    if (getElement(CONTROL_ID)) return;
    const autoApplyRow = getElement('bgRemoveAutoApplyInput')?.closest('.grid-2');
    const buttonRow = getElement('bgRemoveApplyButton')?.closest('.button-row');
    const parent = autoApplyRow?.parentElement || buttonRow?.parentElement;
    if (!parent) return;

    const row = document.createElement('div');
    row.id = CONTROL_ID;
    row.className = 'grid-2';
    row.innerHTML = `
      <label class="check-label"><input id="bgRemoveRestoreBrushToggle" type="checkbox"> 결과 복원 브러시</label>
      <label>브러시 크기 <input id="bgRemoveRestoreBrushSize" type="range" min="1" max="240" value="32"></label>
      <label>현재 브러시 <input id="bgRemoveRestoreBrushSizeText" type="text" value="32px" readonly></label>
      <button id="bgRemoveRestoreAllButton" type="button">결과를 원본으로 전체 복원</button>
    `;

    if (buttonRow) parent.insertBefore(row, buttonRow);
    else parent.append(row);

    getElement('bgRemoveRestoreBrushSize')?.addEventListener('input', updateBrushSizeText);
    getElement('bgRemoveRestoreBrushToggle')?.addEventListener('change', () => {
      const resultWrap = getElement('bgRemoveResultWrap');
      if (resultWrap) resultWrap.style.cursor = isBrushEnabled() ? 'crosshair' : 'grab';
      setStatus(isBrushEnabled()
        ? '복원 브러시 ON: 결과 화면에서 문지르면 그 부분만 원본으로 복원됩니다. 이동/확대하려면 브러시를 끄세요.'
        : '복원 브러시 OFF');
    });
    getElement('bgRemoveRestoreAllButton')?.addEventListener('click', () => {
      const originalCanvas = getElement('bgRemoveOriginalCanvas');
      const resultCanvas = getElement('bgRemoveResultCanvas');
      if (!originalCanvas || !resultCanvas || !originalCanvas.width) return;
      const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });
      resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      resultCtx.drawImage(originalCanvas, 0, 0);
      updateDownloadFromResult();
      setStatus('결과 이미지를 원본으로 전체 복원했습니다.');
    });
    updateBrushSizeText();
  }

  function installBrushEvents() {
    const canvas = getElement('bgRemoveResultCanvas');
    if (!canvas || canvas.dataset.restoreBrushBound === 'true') return;
    canvas.dataset.restoreBrushBound = 'true';

    canvas.addEventListener('pointerdown', (event) => {
      if (!isBrushEnabled()) return;
      if (!canvas.width || !canvas.height) return;
      isDrawing = true;
      canvas.setPointerCapture?.(event.pointerId);
      lastPoint = getCanvasPoint(event, canvas);
      const restored = copyCircleFromOriginal(lastPoint.x, lastPoint.y, getBrushSize() / 2);
      if (restored) updateDownloadFromResult();
      setStatus(`브러시로 ${restored.toLocaleString()}픽셀을 원본으로 복원했습니다.`);
      event.preventDefault();
      event.stopPropagation();
    });

    canvas.addEventListener('pointermove', (event) => {
      if (!isDrawing || !isBrushEnabled() || !lastPoint) return;
      const point = getCanvasPoint(event, canvas);
      const restored = restoreLine(lastPoint, point);
      lastPoint = point;
      if (restored) updateDownloadFromResult();
      setStatus(`브러시로 ${restored.toLocaleString()}픽셀을 원본으로 복원했습니다.`);
      event.preventDefault();
      event.stopPropagation();
    });

    const stop = (event) => {
      if (!isDrawing) return;
      isDrawing = false;
      lastPoint = null;
      updateDownloadFromResult();
      canvas.releasePointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
  }

  function install() {
    installControls();
    installBrushEvents();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
(() => {
  const WRAP_IDS = ['bgRemoveOriginalWrap', 'bgRemoveResultWrap'];
  const CANVAS_IDS = ['bgRemoveOriginalCanvas', 'bgRemoveResultCanvas'];

  function getElement(id) {
    return document.getElementById(id);
  }

  function getZoom(canvas) {
    if (!canvas?.width) return 1;
    const cssWidth = Number.parseFloat(canvas.style.width || '0');
    if (!Number.isFinite(cssWidth) || cssWidth <= 0) return 1;
    return cssWidth / canvas.width;
  }

  function findVisibleBounds(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return null;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] <= 8) continue;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) return null;
    return { minX, minY, maxX, maxY };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function scrollWrapToBounds(wrap, canvas, bounds) {
    if (!wrap || !canvas || !bounds) return;
    const zoom = getZoom(canvas);
    const centerX = ((bounds.minX + bounds.maxX + 1) / 2) * zoom;
    const centerY = ((bounds.minY + bounds.maxY + 1) / 2) * zoom;
    const targetLeft = centerX - wrap.clientWidth / 2;
    const targetTop = centerY - wrap.clientHeight / 2;

    wrap.scrollLeft = clamp(targetLeft, 0, Math.max(0, wrap.scrollWidth - wrap.clientWidth));
    wrap.scrollTop = clamp(targetTop, 0, Math.max(0, wrap.scrollHeight - wrap.clientHeight));
  }

  function autoPanOne(wrapId, canvasId) {
    const wrap = getElement(wrapId);
    const canvas = getElement(canvasId);
    if (!wrap || !canvas || !canvas.width || !canvas.height) return;
    const bounds = findVisibleBounds(canvas);
    if (!bounds) return;
    scrollWrapToBounds(wrap, canvas, bounds);
  }

  function autoPanAll() {
    autoPanOne('bgRemoveOriginalWrap', 'bgRemoveOriginalCanvas');
    autoPanOne('bgRemoveResultWrap', 'bgRemoveResultCanvas');
  }

  function scheduleAutoPan(delay = 80) {
    window.setTimeout(autoPanAll, delay);
    window.setTimeout(autoPanAll, delay + 180);
  }

  function installMoreNaturalDrag(wrap) {
    if (!wrap || wrap.dataset.autoPanDragBound === 'true') return;
    wrap.dataset.autoPanDragBound = 'true';
    wrap.style.touchAction = 'none';
    wrap.style.cursor = 'grab';

    let active = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    wrap.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      active = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startScrollLeft = wrap.scrollLeft;
      startScrollTop = wrap.scrollTop;
      wrap.dataset.dragMoved = 'false';
      wrap.style.cursor = 'grabbing';
      wrap.setPointerCapture?.(event.pointerId);
    });

    wrap.addEventListener('pointermove', (event) => {
      if (!active || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) wrap.dataset.dragMoved = 'true';
      wrap.scrollLeft = startScrollLeft - dx;
      wrap.scrollTop = startScrollTop - dy;
      event.preventDefault();
      event.stopPropagation();
    });

    const stop = (event) => {
      if (!active || event.pointerId !== pointerId) return;
      active = false;
      pointerId = null;
      wrap.style.cursor = 'grab';
      wrap.releasePointerCapture?.(event.pointerId);
      window.setTimeout(() => {
        wrap.dataset.dragMoved = 'false';
      }, 120);
    };

    wrap.addEventListener('pointerup', stop);
    wrap.addEventListener('pointercancel', stop);
  }

  function install() {
    WRAP_IDS.forEach((id) => installMoreNaturalDrag(getElement(id)));

    getElement('bgRemoveInput')?.addEventListener('change', () => scheduleAutoPan(160));
    getElement('bgRemoveApplyButton')?.addEventListener('click', () => scheduleAutoPan(120));
    getElement('bgRemovePreviewZoom')?.addEventListener('input', () => scheduleAutoPan(80));
    getElement('bgRemoveResetViewButton')?.addEventListener('click', () => scheduleAutoPan(0));

    ['bgRemoveColor', 'bgRemoveTolerance', 'bgRemoveStrength', 'bgRemoveCleanupInput'].forEach((id) => {
      getElement(id)?.addEventListener('input', () => scheduleAutoPan(140));
      getElement(id)?.addEventListener('change', () => scheduleAutoPan(140));
    });

    const observer = new MutationObserver(() => {
      if (getElement('bgRemoveOriginalWrap') && getElement('bgRemoveResultWrap')) {
        WRAP_IDS.forEach((id) => installMoreNaturalDrag(getElement(id)));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    scheduleAutoPan(300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
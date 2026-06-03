(() => {
  const WRAP_IDS = ['bgRemoveOriginalWrap', 'bgRemoveResultWrap'];
  const CANVAS_IDS = ['bgRemoveOriginalCanvas', 'bgRemoveResultCanvas'];

  function getElement(id) {
    return document.getElementById(id);
  }

  function pairList() {
    return [
      { wrap: getElement('bgRemoveOriginalWrap'), canvas: getElement('bgRemoveOriginalCanvas') },
      { wrap: getElement('bgRemoveResultWrap'), canvas: getElement('bgRemoveResultCanvas') },
    ];
  }

  function applyViewportFixes() {
    const view = getElement('view-backgroundRemover');
    if (view) {
      view.style.minWidth = '0';
      view.style.maxWidth = '100%';
      view.style.overflowX = 'hidden';
    }

    view?.querySelectorAll('.grid-2, .panel, .panel-body, .controls').forEach((element) => {
      element.style.minWidth = '0';
      element.style.maxWidth = '100%';
    });

    pairList().forEach(({ wrap, canvas }) => {
      if (!wrap) return;
      const parent = wrap.parentElement;
      if (parent) {
        parent.style.minWidth = '0';
        parent.style.maxWidth = '100%';
        parent.style.overflow = 'hidden';
      }

      wrap.style.display = 'block';
      wrap.style.width = '100%';
      wrap.style.maxWidth = '100%';
      wrap.style.minWidth = '0';
      wrap.style.boxSizing = 'border-box';
      wrap.style.overflow = 'auto';
      wrap.style.overflowX = 'auto';
      wrap.style.overflowY = 'auto';
      wrap.style.webkitOverflowScrolling = 'touch';
      wrap.style.touchAction = 'none';
      wrap.style.userSelect = 'none';
      wrap.style.overscrollBehavior = 'contain';
      wrap.style.cursor = 'grab';

      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.maxWidth = 'none';
        canvas.style.flex = '0 0 auto';
      }
    });
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
    applyViewportFixes();

    const zoom = getZoom(canvas);
    const left = bounds.minX * zoom;
    const right = (bounds.maxX + 1) * zoom;
    const top = bounds.minY * zoom;
    const bottom = (bounds.maxY + 1) * zoom;
    const objectWidth = Math.max(1, right - left);
    const objectHeight = Math.max(1, bottom - top);

    let targetLeft;
    let targetTop;

    if (objectWidth <= wrap.clientWidth) {
      targetLeft = left - Math.max(16, (wrap.clientWidth - objectWidth) / 2);
    } else {
      targetLeft = left;
    }

    if (objectHeight <= wrap.clientHeight) {
      targetTop = top - Math.max(16, (wrap.clientHeight - objectHeight) / 2);
    } else {
      targetTop = top;
    }

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
    applyViewportFixes();
    autoPanOne('bgRemoveOriginalWrap', 'bgRemoveOriginalCanvas');
    autoPanOne('bgRemoveResultWrap', 'bgRemoveResultCanvas');
  }

  function scheduleAutoPan(delay = 80) {
    window.setTimeout(autoPanAll, delay);
    window.setTimeout(autoPanAll, delay + 180);
    window.setTimeout(autoPanAll, delay + 500);
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
      event.preventDefault();
    }, { passive: false });

    wrap.addEventListener('pointermove', (event) => {
      if (!active || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) wrap.dataset.dragMoved = 'true';
      wrap.scrollLeft = startScrollLeft - dx;
      wrap.scrollTop = startScrollTop - dy;
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

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

  function bindControls() {
    getElement('bgRemoveInput')?.addEventListener('change', () => scheduleAutoPan(160));
    getElement('bgRemoveApplyButton')?.addEventListener('click', () => scheduleAutoPan(120));
    getElement('bgRemovePreviewZoom')?.addEventListener('input', () => scheduleAutoPan(80));
    getElement('bgRemoveResetViewButton')?.addEventListener('click', () => scheduleAutoPan(0));

    ['bgRemoveColor', 'bgRemoveTolerance', 'bgRemoveStrength', 'bgRemoveCleanupInput'].forEach((id) => {
      getElement(id)?.addEventListener('input', () => scheduleAutoPan(140));
      getElement(id)?.addEventListener('change', () => scheduleAutoPan(140));
    });
  }

  function install() {
    applyViewportFixes();
    WRAP_IDS.forEach((id) => installMoreNaturalDrag(getElement(id)));
    bindControls();

    const observer = new MutationObserver(() => {
      applyViewportFixes();
      if (getElement('bgRemoveOriginalWrap') && getElement('bgRemoveResultWrap')) {
        WRAP_IDS.forEach((id) => installMoreNaturalDrag(getElement(id)));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', () => scheduleAutoPan(60));
    scheduleAutoPan(300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
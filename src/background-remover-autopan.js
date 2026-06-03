(() => {
  const WRAP_IDS = ['bgRemoveOriginalWrap', 'bgRemoveResultWrap'];
  const CANVAS_IDS = ['bgRemoveOriginalCanvas', 'bgRemoveResultCanvas'];
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 8;

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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getZoom(canvas) {
    if (!canvas?.width) return 1;
    const cssWidth = Number.parseFloat(canvas.style.width || '0');
    if (!Number.isFinite(cssWidth) || cssWidth <= 0) return 1;
    return cssWidth / canvas.width;
  }

  function setZoom(zoom, anchor) {
    const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const zoomInput = getElement('bgRemovePreviewZoom');
    const zoomText = getElement('bgRemovePreviewZoomText');
    if (zoomInput) zoomInput.value = String(Math.round(nextZoom));
    if (zoomText) zoomText.value = `${Math.round(nextZoom)}x`;

    pairList().forEach(({ wrap, canvas }) => {
      if (!wrap || !canvas || !canvas.width || !canvas.height) return;
      const oldZoom = getZoom(canvas);
      const rect = wrap.getBoundingClientRect();
      const localX = anchor ? anchor.clientX - rect.left : wrap.clientWidth / 2;
      const localY = anchor ? anchor.clientY - rect.top : wrap.clientHeight / 2;
      const imageX = (wrap.scrollLeft + localX) / Math.max(0.001, oldZoom);
      const imageY = (wrap.scrollTop + localY) / Math.max(0.001, oldZoom);

      canvas.style.width = `${canvas.width * nextZoom}px`;
      canvas.style.height = `${canvas.height * nextZoom}px`;
      canvas.style.maxWidth = 'none';
      canvas.style.imageRendering = nextZoom > 1 ? 'pixelated' : 'auto';

      wrap.scrollLeft = clamp(imageX * nextZoom - localX, 0, Math.max(0, wrap.scrollWidth - wrap.clientWidth));
      wrap.scrollTop = clamp(imageY * nextZoom - localY, 0, Math.max(0, wrap.scrollHeight - wrap.clientHeight));
    });
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

    if (objectWidth <= wrap.clientWidth) targetLeft = left - Math.max(16, (wrap.clientWidth - objectWidth) / 2);
    else targetLeft = left;

    if (objectHeight <= wrap.clientHeight) targetTop = top - Math.max(16, (wrap.clientHeight - objectHeight) / 2);
    else targetTop = top;

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

  function distance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function midpoint(a, b) {
    return {
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2,
    };
  }

  function installTouchPanAndPinch(wrap) {
    if (!wrap || wrap.dataset.autoPanDragBound === 'true') return;
    wrap.dataset.autoPanDragBound = 'true';
    wrap.style.touchAction = 'none';
    wrap.style.cursor = 'grab';

    const pointers = new Map();
    let activeDragId = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let pinchAnchor = null;

    function resetDrag() {
      activeDragId = null;
      wrap.style.cursor = 'grab';
    }

    wrap.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      wrap.dataset.dragMoved = 'false';
      wrap.setPointerCapture?.(event.pointerId);

      if (pointers.size === 1) {
        activeDragId = event.pointerId;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        startScrollLeft = wrap.scrollLeft;
        startScrollTop = wrap.scrollTop;
        wrap.style.cursor = 'grabbing';
      } else if (pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values()).slice(0, 2);
        pinchStartDistance = Math.max(1, distance(a, b));
        pinchStartZoom = getZoom(getElement('bgRemoveOriginalCanvas')) || 1;
        pinchAnchor = midpoint(a, b);
        activeDragId = null;
        wrap.dataset.dragMoved = 'true';
      }

      event.preventDefault();
    }, { passive: false });

    wrap.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

      if (pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values()).slice(0, 2);
        const nextDistance = Math.max(1, distance(a, b));
        const anchor = midpoint(a, b);
        const nextZoom = pinchStartZoom * (nextDistance / Math.max(1, pinchStartDistance));
        setZoom(nextZoom, anchor || pinchAnchor);
        wrap.dataset.dragMoved = 'true';
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (activeDragId === event.pointerId) {
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 3) wrap.dataset.dragMoved = 'true';
        wrap.scrollLeft = startScrollLeft - dx;
        wrap.scrollTop = startScrollTop - dy;
        event.preventDefault();
        event.stopPropagation();
      }
    }, { passive: false });

    const stopPointer = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) {
        pinchStartDistance = 0;
        pinchAnchor = null;
      }

      if (activeDragId === event.pointerId) resetDrag();

      if (pointers.size === 1) {
        const [remainingId, remaining] = Array.from(pointers.entries())[0];
        activeDragId = remainingId;
        dragStartX = remaining.clientX;
        dragStartY = remaining.clientY;
        startScrollLeft = wrap.scrollLeft;
        startScrollTop = wrap.scrollTop;
      }

      window.setTimeout(() => {
        wrap.dataset.dragMoved = 'false';
      }, 150);
    };

    wrap.addEventListener('pointerup', stopPointer);
    wrap.addEventListener('pointercancel', stopPointer);
    wrap.addEventListener('lostpointercapture', (event) => {
      pointers.delete(event.pointerId);
      if (activeDragId === event.pointerId) resetDrag();
    });
  }

  function bindControls() {
    getElement('bgRemoveInput')?.addEventListener('change', () => scheduleAutoPan(160));
    getElement('bgRemoveApplyButton')?.addEventListener('click', () => scheduleAutoPan(120));
    getElement('bgRemovePreviewZoom')?.addEventListener('input', () => {
      const value = Number.parseInt(getElement('bgRemovePreviewZoom')?.value || '1', 10);
      setZoom(Number.isFinite(value) ? value : 1);
      scheduleAutoPan(80);
    });
    getElement('bgRemoveResetViewButton')?.addEventListener('click', () => scheduleAutoPan(0));

    ['bgRemoveColor', 'bgRemoveTolerance', 'bgRemoveStrength', 'bgRemoveCleanupInput'].forEach((id) => {
      getElement(id)?.addEventListener('input', () => scheduleAutoPan(140));
      getElement(id)?.addEventListener('change', () => scheduleAutoPan(140));
    });
  }

  function install() {
    applyViewportFixes();
    WRAP_IDS.forEach((id) => installTouchPanAndPinch(getElement(id)));
    bindControls();

    const observer = new MutationObserver(() => {
      applyViewportFixes();
      if (getElement('bgRemoveOriginalWrap') && getElement('bgRemoveResultWrap')) {
        WRAP_IDS.forEach((id) => installTouchPanAndPinch(getElement(id)));
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
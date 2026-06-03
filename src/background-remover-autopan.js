(() => {
  const WRAP_IDS = ['bgRemoveOriginalWrap', 'bgRemoveResultWrap'];
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 32;
  let currentZoom = 1;
  let hasInitialAutoPanned = false;

  function getElement(id) {
    return document.getElementById(id);
  }

  function pairList() {
    return [
      { wrap: getElement('bgRemoveOriginalWrap'), canvas: getElement('bgRemoveOriginalCanvas') },
      { wrap: getElement('bgRemoveResultWrap'), canvas: getElement('bgRemoveResultCanvas') },
    ];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ensureZoomLayer(wrap, canvas) {
    if (!wrap || !canvas) return null;
    let layer = canvas.parentElement?.dataset?.bgZoomLayer === 'true' ? canvas.parentElement : null;
    if (!layer) {
      layer = document.createElement('div');
      layer.dataset.bgZoomLayer = 'true';
      layer.style.position = 'relative';
      layer.style.display = 'block';
      layer.style.width = `${canvas.width || 1}px`;
      layer.style.height = `${canvas.height || 1}px`;
      layer.style.minWidth = '0';
      layer.style.minHeight = '0';
      layer.style.transform = 'translateZ(0)';
      wrap.insertBefore(layer, canvas);
      layer.append(canvas);
    }
    return layer;
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

    const zoomInput = getElement('bgRemovePreviewZoom');
    if (zoomInput) {
      zoomInput.max = String(MAX_ZOOM);
      zoomInput.step = '0.1';
    }

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
        const layer = ensureZoomLayer(wrap, canvas);
        canvas.style.display = 'block';
        canvas.style.maxWidth = 'none';
        canvas.style.width = `${canvas.width || 1}px`;
        canvas.style.height = `${canvas.height || 1}px`;
        canvas.style.transformOrigin = '0 0';
        canvas.style.imageRendering = currentZoom > 1 ? 'pixelated' : 'auto';
        canvas.style.touchAction = 'none';
        if (layer) {
          layer.style.width = `${(canvas.width || 1) * currentZoom}px`;
          layer.style.height = `${(canvas.height || 1) * currentZoom}px`;
        }
        canvas.style.transform = `scale(${currentZoom})`;
      }
    });
  }

  function setSliderZoomValue(zoom) {
    const rounded = Math.round(zoom * 10) / 10;
    const zoomInput = getElement('bgRemovePreviewZoom');
    const zoomText = getElement('bgRemovePreviewZoomText');
    if (zoomInput) {
      zoomInput.max = String(MAX_ZOOM);
      zoomInput.step = '0.1';
      zoomInput.value = String(rounded);
    }
    if (zoomText) zoomText.value = `${rounded}x`;
  }

  function captureScrollRatios() {
    return pairList().map(({ wrap }) => {
      if (!wrap) return null;
      const maxLeft = Math.max(1, wrap.scrollWidth - wrap.clientWidth);
      const maxTop = Math.max(1, wrap.scrollHeight - wrap.clientHeight);
      return {
        wrap,
        leftRatio: wrap.scrollLeft / maxLeft,
        topRatio: wrap.scrollTop / maxTop,
      };
    });
  }

  function restoreScrollRatios(ratios) {
    if (!ratios) return;
    ratios.forEach((item) => {
      if (!item?.wrap) return;
      const maxLeft = Math.max(0, item.wrap.scrollWidth - item.wrap.clientWidth);
      const maxTop = Math.max(0, item.wrap.scrollHeight - item.wrap.clientHeight);
      item.wrap.scrollLeft = clamp(item.leftRatio * maxLeft, 0, maxLeft);
      item.wrap.scrollTop = clamp(item.topRatio * maxTop, 0, maxTop);
    });
  }

  function getAnchorImagePoint(wrap, anchorClient) {
    const rect = wrap.getBoundingClientRect();
    const localX = anchorClient ? anchorClient.clientX - rect.left : wrap.clientWidth / 2;
    const localY = anchorClient ? anchorClient.clientY - rect.top : wrap.clientHeight / 2;
    return {
      localX,
      localY,
      imageX: (wrap.scrollLeft + localX) / Math.max(0.001, currentZoom),
      imageY: (wrap.scrollTop + localY) / Math.max(0.001, currentZoom),
    };
  }

  function applyZoomToWrap(wrap, canvas, nextZoom, anchorClient) {
    if (!wrap || !canvas || !canvas.width || !canvas.height) return;
    const anchor = getAnchorImagePoint(wrap, anchorClient);
    const layer = ensureZoomLayer(wrap, canvas);

    canvas.style.width = `${canvas.width}px`;
    canvas.style.height = `${canvas.height}px`;
    canvas.style.maxWidth = 'none';
    canvas.style.transformOrigin = '0 0';
    canvas.style.transform = `scale(${nextZoom})`;
    canvas.style.imageRendering = nextZoom > 1 ? 'pixelated' : 'auto';

    if (layer) {
      layer.style.width = `${canvas.width * nextZoom}px`;
      layer.style.height = `${canvas.height * nextZoom}px`;
    }

    wrap.scrollLeft = clamp(
      anchor.imageX * nextZoom - anchor.localX,
      0,
      Math.max(0, wrap.scrollWidth - wrap.clientWidth),
    );
    wrap.scrollTop = clamp(
      anchor.imageY * nextZoom - anchor.localY,
      0,
      Math.max(0, wrap.scrollHeight - wrap.clientHeight),
    );
  }

  function setZoom(zoom, anchorMapOrPoint) {
    const nextZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const previousZoom = currentZoom;
    currentZoom = nextZoom;
    setSliderZoomValue(nextZoom);

    pairList().forEach(({ wrap, canvas }) => {
      if (!wrap || !canvas) return;
      const anchor = anchorMapOrPoint instanceof Map
        ? anchorMapOrPoint.get(wrap.id)
        : anchorMapOrPoint;
      currentZoom = previousZoom;
      applyZoomToWrap(wrap, canvas, nextZoom, anchor);
      currentZoom = nextZoom;
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

    const left = bounds.minX * currentZoom;
    const right = (bounds.maxX + 1) * currentZoom;
    const top = bounds.minY * currentZoom;
    const bottom = (bounds.maxY + 1) * currentZoom;
    const objectWidth = Math.max(1, right - left);
    const objectHeight = Math.max(1, bottom - top);

    const targetLeft = objectWidth <= wrap.clientWidth
      ? left - Math.max(16, (wrap.clientWidth - objectWidth) / 2)
      : left;
    const targetTop = objectHeight <= wrap.clientHeight
      ? top - Math.max(16, (wrap.clientHeight - objectHeight) / 2)
      : top;

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
    hasInitialAutoPanned = true;
  }

  function scheduleAutoPan(delay = 80) {
    window.setTimeout(autoPanAll, delay);
    window.setTimeout(autoPanAll, delay + 180);
    window.setTimeout(autoPanAll, delay + 500);
  }

  function schedulePreservePosition(delay = 0) {
    const ratios = captureScrollRatios();
    window.setTimeout(() => {
      applyViewportFixes();
      restoreScrollRatios(ratios);
    }, delay);
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

  function makeAnchorMap(activeWrap, anchorOnActiveWrap) {
    const anchors = new Map();
    pairList().forEach(({ wrap }) => {
      if (!wrap) return;
      if (wrap === activeWrap) {
        anchors.set(wrap.id, anchorOnActiveWrap);
        return;
      }
      const rect = wrap.getBoundingClientRect();
      anchors.set(wrap.id, {
        clientX: rect.left + wrap.clientWidth / 2,
        clientY: rect.top + wrap.clientHeight / 2,
      });
    });
    return anchors;
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

    function resetDrag() {
      activeDragId = null;
      wrap.style.cursor = 'grab';
    }

    function startPinch() {
      const [a, b] = Array.from(pointers.values()).slice(0, 2);
      pinchStartDistance = Math.max(1, distance(a, b));
      pinchStartZoom = currentZoom || 1;
      activeDragId = null;
      wrap.dataset.dragMoved = 'true';
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
        startPinch();
      }

      event.preventDefault();
    }, { passive: false });

    wrap.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

      if (pointers.size >= 2) {
        const [a, b] = Array.from(pointers.values()).slice(0, 2);
        const nextDistance = Math.max(1, distance(a, b));
        const activeAnchor = midpoint(a, b);
        const nextZoom = pinchStartZoom * (nextDistance / Math.max(1, pinchStartDistance));
        setZoom(nextZoom, makeAnchorMap(wrap, activeAnchor));
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
      if (pointers.size >= 2) startPinch();

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
    getElement('bgRemoveInput')?.addEventListener('change', () => {
      hasInitialAutoPanned = false;
      scheduleAutoPan(160);
    });

    getElement('bgRemoveApplyButton')?.addEventListener('click', () => {
      schedulePreservePosition(120);
      schedulePreservePosition(300);
    });

    getElement('bgRemovePreviewZoom')?.addEventListener('input', () => {
      const value = Number.parseFloat(getElement('bgRemovePreviewZoom')?.value || '1');
      setZoom(Number.isFinite(value) ? value : 1);
    });

    getElement('bgRemoveResetViewButton')?.addEventListener('click', () => scheduleAutoPan(0));

    ['bgRemoveColor', 'bgRemoveTolerance', 'bgRemoveStrength', 'bgRemoveCleanupInput'].forEach((id) => {
      getElement(id)?.addEventListener('input', () => schedulePreservePosition(140));
      getElement(id)?.addEventListener('change', () => schedulePreservePosition(140));
    });
  }

  function install() {
    currentZoom = Number.parseFloat(getElement('bgRemovePreviewZoom')?.value || '1') || 1;
    currentZoom = clamp(currentZoom, MIN_ZOOM, MAX_ZOOM);
    applyViewportFixes();
    setSliderZoomValue(currentZoom);
    WRAP_IDS.forEach((id) => installTouchPanAndPinch(getElement(id)));
    bindControls();

    const observer = new MutationObserver(() => {
      applyViewportFixes();
      if (getElement('bgRemoveOriginalWrap') && getElement('bgRemoveResultWrap')) {
        WRAP_IDS.forEach((id) => installTouchPanAndPinch(getElement(id)));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', () => schedulePreservePosition(60));
    schedulePreservePosition(300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
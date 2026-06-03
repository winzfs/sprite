(() => {
  const WRAP_IDS = ['bgRemoveOriginalWrap', 'bgRemoveResultWrap'];
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 48;
  let zoom = 1;

  function get(id) {
    return document.getElementById(id);
  }

  function pairs() {
    return [
      { wrap: get('bgRemoveOriginalWrap'), canvas: get('bgRemoveOriginalCanvas') },
      { wrap: get('bgRemoveResultWrap'), canvas: get('bgRemoveResultCanvas') },
    ];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getZoomInputValue() {
    const value = Number.parseFloat(get('bgRemovePreviewZoom')?.value || '1');
    return Number.isFinite(value) ? clamp(value, MIN_ZOOM, MAX_ZOOM) : 1;
  }

  function syncZoomUi() {
    const rounded = Math.round(zoom * 10) / 10;
    const input = get('bgRemovePreviewZoom');
    const text = get('bgRemovePreviewZoomText');
    if (input) {
      input.min = String(MIN_ZOOM);
      input.max = String(MAX_ZOOM);
      input.step = '0.1';
      input.value = String(rounded);
    }
    if (text) text.value = `${rounded}x`;
  }

  function ensureLayer(wrap, canvas) {
    if (!wrap || !canvas) return null;
    let layer = canvas.parentElement?.dataset?.bgPinchLayer === 'true' ? canvas.parentElement : null;
    if (!layer) {
      const oldParent = canvas.parentElement;
      layer = document.createElement('div');
      layer.dataset.bgPinchLayer = 'true';
      layer.style.position = 'relative';
      layer.style.display = 'block';
      layer.style.overflow = 'visible';
      layer.style.transform = 'translateZ(0)';
      oldParent?.insertBefore(layer, canvas);
      layer.append(canvas);
    }
    return layer;
  }

  function applyZoomVisual(nextZoom) {
    zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    syncZoomUi();

    pairs().forEach(({ wrap, canvas }) => {
      if (!wrap || !canvas || !canvas.width || !canvas.height) return;
      wrap.style.overflow = 'auto';
      wrap.style.touchAction = 'none';
      wrap.style.overscrollBehavior = 'contain';
      wrap.style.width = '100%';
      wrap.style.maxWidth = '100%';
      wrap.style.minWidth = '0';

      const layer = ensureLayer(wrap, canvas);
      if (!layer) return;

      layer.style.width = `${canvas.width * zoom}px`;
      layer.style.height = `${canvas.height * zoom}px`;
      layer.style.minWidth = `${canvas.width * zoom}px`;
      layer.style.minHeight = `${canvas.height * zoom}px`;

      canvas.style.display = 'block';
      canvas.style.width = `${canvas.width}px`;
      canvas.style.height = `${canvas.height}px`;
      canvas.style.maxWidth = 'none';
      canvas.style.transformOrigin = '0 0';
      canvas.style.transform = `scale(${zoom})`;
      canvas.style.imageRendering = zoom > 1 ? 'pixelated' : 'auto';
    });
  }

  function localPoint(wrap, clientPoint) {
    const rect = wrap.getBoundingClientRect();
    return {
      x: clientPoint.clientX - rect.left,
      y: clientPoint.clientY - rect.top,
    };
  }

  function imagePointUnder(wrap, clientPoint, baseZoom = zoom) {
    const local = localPoint(wrap, clientPoint);
    return {
      imageX: (wrap.scrollLeft + local.x) / Math.max(0.001, baseZoom),
      imageY: (wrap.scrollTop + local.y) / Math.max(0.001, baseZoom),
      localX: local.x,
      localY: local.y,
    };
  }

  function keepImagePointUnder(wrap, imagePoint, clientPoint) {
    const local = localPoint(wrap, clientPoint);
    const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    wrap.scrollLeft = clamp(imagePoint.imageX * zoom - local.x, 0, maxLeft);
    wrap.scrollTop = clamp(imagePoint.imageY * zoom - local.y, 0, maxTop);
  }

  function midpoint(a, b) {
    return {
      clientX: (a.clientX + b.clientX) / 2,
      clientY: (a.clientY + b.clientY) / 2,
    };
  }

  function distance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function installOnWrap(wrap) {
    if (!wrap || wrap.dataset.centerPinchFixed === 'true') return;
    wrap.dataset.centerPinchFixed = 'true';
    wrap.style.touchAction = 'none';

    const pointers = new Map();
    let pinching = false;
    let startDistance = 1;
    let startZoom = 1;
    let startImagePoint = null;
    let activeWrap = wrap;
    let activeCenter = null;

    function beginPinch() {
      const values = Array.from(pointers.values()).slice(0, 2);
      if (values.length < 2) return;
      activeWrap = wrap;
      activeCenter = midpoint(values[0], values[1]);
      startDistance = Math.max(1, distance(values[0], values[1]));
      startZoom = zoom;
      startImagePoint = imagePointUnder(activeWrap, activeCenter, startZoom);
      pinching = true;
      wrap.dataset.dragMoved = 'true';
    }

    function endPinchSoon() {
      window.setTimeout(() => {
        if (pointers.size < 2) pinching = false;
      }, 80);
    }

    wrap.addEventListener('pointerdown', (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (pointers.size === 2) beginPinch();
      if (pointers.size >= 2) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, { capture: true, passive: false });

    wrap.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (pointers.size < 2) return;

      const values = Array.from(pointers.values()).slice(0, 2);
      const center = midpoint(values[0], values[1]);
      const nextDistance = Math.max(1, distance(values[0], values[1]));
      if (!pinching || !startImagePoint) beginPinch();
      const nextZoom = startZoom * (nextDistance / Math.max(1, startDistance));

      applyZoomVisual(nextZoom);
      keepImagePointUnder(activeWrap, startImagePoint, center);

      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, passive: false });

    const stop = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size >= 2) beginPinch();
      else endPinchSoon();
    };

    wrap.addEventListener('pointerup', stop, { capture: true });
    wrap.addEventListener('pointercancel', stop, { capture: true });
    wrap.addEventListener('lostpointercapture', stop, { capture: true });
  }

  function install() {
    zoom = getZoomInputValue();
    applyZoomVisual(zoom);
    WRAP_IDS.forEach((id) => installOnWrap(get(id)));

    get('bgRemovePreviewZoom')?.addEventListener('input', () => {
      const centerMap = pairs().map(({ wrap }) => {
        if (!wrap) return null;
        return {
          wrap,
          point: imagePointUnder(wrap, {
            clientX: wrap.getBoundingClientRect().left + wrap.clientWidth / 2,
            clientY: wrap.getBoundingClientRect().top + wrap.clientHeight / 2,
          }),
        };
      });
      applyZoomVisual(getZoomInputValue());
      centerMap.forEach((item) => {
        if (!item?.wrap) return;
        keepImagePointUnder(item.wrap, item.point, {
          clientX: item.wrap.getBoundingClientRect().left + item.wrap.clientWidth / 2,
          clientY: item.wrap.getBoundingClientRect().top + item.wrap.clientHeight / 2,
        });
      });
    }, { passive: true });

    const observer = new MutationObserver(() => {
      applyZoomVisual(zoom);
      WRAP_IDS.forEach((id) => installOnWrap(get(id)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
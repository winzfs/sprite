(() => {
  function unrestrictedSourceRect(frame) {
    const shift = getShift(frame.id);
    const size = getBoxSize(frame);
    let sx = frame.sx + shift.x;
    let sy = frame.sy + shift.y;
    let w = size.w;
    let h = size.h;

    const imageWidth = state.image?.naturalWidth || 0;
    const imageHeight = state.image?.naturalHeight || 0;

    if (sx < 0) w += Math.abs(sx);
    if (sy < 0) h += Math.abs(sy);
    if (sx + size.w > imageWidth) w += sx + size.w - imageWidth;
    if (sy + size.h > imageHeight) h += sy + size.h - imageHeight;

    return {
      sx,
      sy,
      w: Math.max(1, Math.round(w)),
      h: Math.max(1, Math.round(h)),
      shiftX: sx - frame.sx,
      shiftY: sy - frame.sy,
    };
  }

  function setUnrestrictedShift(frameId, shift) {
    const normalized = {
      x: Math.round(shift.x || 0),
      y: Math.round(shift.y || 0),
    };
    if (normalized.x === 0 && normalized.y === 0) state.frameShifts.delete(frameId);
    else state.frameShifts.set(frameId, normalized);
  }

  getSourceRect = unrestrictedSourceRect;
  setShift = setUnrestrictedShift;

  nudgeSingleFrame = function nudgeSingleFrameUnrestricted(id, dx, dy) {
    const frame = getFrame(id);
    if (!frame) return;
    const current = getShift(id);
    setShift(id, {
      x: current.x + dx,
      y: current.y + dy,
    });
  };

  nudgeSelectedFrames = function nudgeSelectedFramesUnrestricted(dx, dy) {
    const ids = getActiveFrameIds();
    if (!ids.length) return setStatus('위치를 조정할 프레임을 먼저 선택하세요.');

    for (const id of ids) {
      const frame = getFrame(id);
      if (!frame) continue;
      const current = getShift(id);
      setShift(id, {
        x: current.x + dx,
        y: current.y + dy,
      });
    }

    const first = getFrame(ids[0]);
    renderOutput();
    drawSource();
    drawPreview(first);
    updateInfoDisplays();
    setStatus(`${ids.length}개 위치 보정: 원본 밖 투명 여백까지 프레임 크기 확장`);
  };

  updateInfoDisplays();
  if (state.lastPreviewFrame) drawPreview(state.lastPreviewFrame);
})();

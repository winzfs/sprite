(() => {
  function unrestrictedSourceRect(frame) {
    const shift = getShift(frame.id);
    const size = getBoxSize(frame);
    const sx = frame.sx + shift.x;
    const sy = frame.sy + shift.y;
    return {
      sx,
      sy,
      w: size.w,
      h: size.h,
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
    setStatus(`${ids.length}개 위치 보정: 원본 밖 영역까지 허용`);
  };

  updateInfoDisplays();
  if (state.lastPreviewFrame) drawPreview(state.lastPreviewFrame);
})();

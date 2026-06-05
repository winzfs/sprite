(() => {
  function adjustedFrameRect(frame) {
    const size = getBoxSize(frame);
    const shift = getShift(frame.id);
    return {
      sx: frame.sx,
      sy: frame.sy,
      w: size.w,
      h: size.h,
      shiftX: Math.round(shift.x || 0),
      shiftY: Math.round(shift.y || 0),
    };
  }

  function setOutputPlacementShift(frameId, shift) {
    const normalized = {
      x: Math.round(shift.x || 0),
      y: Math.round(shift.y || 0),
    };
    if (normalized.x === 0 && normalized.y === 0) state.frameShifts.delete(frameId);
    else state.frameShifts.set(frameId, normalized);
  }

  function drawFrameWithPlacementOffset(ctx, frame, dx, dy, scale = 1) {
    if (!state.image || !frame) return;

    const rect = adjustedFrameRect(frame);
    const shift = getShift(frame.id);
    const sourceX = Math.max(0, frame.sx);
    const sourceY = Math.max(0, frame.sy);
    const sourceW = Math.max(0, Math.min(frame.w, state.image.naturalWidth - sourceX));
    const sourceH = Math.max(0, Math.min(frame.h, state.image.naturalHeight - sourceY));
    if (sourceW <= 0 || sourceH <= 0) return;

    ctx.drawImage(
      state.image,
      sourceX,
      sourceY,
      sourceW,
      sourceH,
      dx + Math.round(shift.x || 0) * scale,
      dy + Math.round(shift.y || 0) * scale,
      sourceW * scale,
      sourceH * scale,
    );
  }

  getSourceRect = adjustedFrameRect;
  setShift = setOutputPlacementShift;
  drawFrameImage = drawFrameWithPlacementOffset;

  nudgeSingleFrame = function nudgeSingleFrameOutputPlacement(id, dx, dy) {
    const frame = getFrame(id);
    if (!frame) return;
    const current = getShift(id);
    setShift(id, {
      x: current.x + dx,
      y: current.y + dy,
    });
  };

  nudgeSelectedFrames = function nudgeSelectedFramesOutputPlacement(dx, dy) {
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
    setStatus(`${ids.length}개 위치 보정: 출력 위치에 적용`);
  };

  updateInfoDisplays();
  renderOutput();
  drawSource();
  if (state.lastPreviewFrame) drawPreview(state.lastPreviewFrame);
})();

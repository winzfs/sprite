(() => {
  function outputFrameRect(frame) {
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

  function drawFrameWithShiftSampling(ctx, frame, dx, dy, scale = 1) {
    if (!state.image || !frame) return;

    const rect = outputFrameRect(frame);
    const shift = getShift(frame.id);
    const shiftX = Math.round(shift.x || 0);
    const shiftY = Math.round(shift.y || 0);

    const wantX = frame.sx - shiftX;
    const wantY = frame.sy - shiftY;
    const wantW = rect.w;
    const wantH = rect.h;

    const srcX = Math.max(0, wantX);
    const srcY = Math.max(0, wantY);
    const srcRight = Math.min(state.image.naturalWidth, wantX + wantW);
    const srcBottom = Math.min(state.image.naturalHeight, wantY + wantH);
    const srcW = Math.max(0, srcRight - srcX);
    const srcH = Math.max(0, srcBottom - srcY);
    if (srcW <= 0 || srcH <= 0) return;

    const outX = dx + (srcX - wantX) * scale;
    const outY = dy + (srcY - wantY) * scale;

    ctx.drawImage(
      state.image,
      srcX,
      srcY,
      srcW,
      srcH,
      outX,
      outY,
      srcW * scale,
      srcH * scale,
    );
  }

  getSourceRect = outputFrameRect;
  setShift = setOutputPlacementShift;
  drawFrameImage = drawFrameWithShiftSampling;

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
    setStatus(`${ids.length}개 위치 보정: 출력 미리보기에 적용`);
  };

  updateInfoDisplays();
  renderOutput();
  drawSource();
  if (state.lastPreviewFrame) drawPreview(state.lastPreviewFrame);
})();

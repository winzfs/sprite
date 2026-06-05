(() => {
  function adjustedCropRect(frame) {
    const size = getBoxSize(frame);
    const shift = getShift(frame.id);
    const shiftX = Math.round(shift.x || 0);
    const shiftY = Math.round(shift.y || 0);
    return {
      sx: frame.sx + shiftX,
      sy: frame.sy + shiftY,
      w: size.w,
      h: size.h,
      shiftX,
      shiftY,
    };
  }

  function setCropShift(frameId, shift) {
    const normalized = {
      x: Math.round(shift.x || 0),
      y: Math.round(shift.y || 0),
    };
    if (normalized.x === 0 && normalized.y === 0) state.frameShifts.delete(frameId);
    else state.frameShifts.set(frameId, normalized);
  }

  function drawAdjustedCrop(ctx, frame, dx, dy, scale = 1) {
    if (!state.image || !frame) return;

    const rect = adjustedCropRect(frame);
    const srcX = Math.max(0, rect.sx);
    const srcY = Math.max(0, rect.sy);
    const srcRight = Math.min(state.image.naturalWidth, rect.sx + rect.w);
    const srcBottom = Math.min(state.image.naturalHeight, rect.sy + rect.h);
    const srcW = Math.max(0, srcRight - srcX);
    const srcH = Math.max(0, srcBottom - srcY);
    if (srcW <= 0 || srcH <= 0) return;

    const outX = dx + (srcX - rect.sx) * scale;
    const outY = dy + (srcY - rect.sy) * scale;

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

  getSourceRect = adjustedCropRect;
  setShift = setCropShift;
  drawFrameImage = drawAdjustedCrop;

  nudgeSingleFrame = function nudgeSingleFrameCropRect(id, dx, dy) {
    const frame = getFrame(id);
    if (!frame) return;
    const current = getShift(id);
    setShift(id, {
      x: current.x + dx,
      y: current.y + dy,
    });
  };

  nudgeSelectedFrames = function nudgeSelectedFramesCropRect(dx, dy) {
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
    setStatus(`${ids.length}개 프레임 잘라낼 영역 보정`);
  };

  updateInfoDisplays();
  renderOutput();
  drawSource();
  if (state.lastPreviewFrame) drawPreview(state.lastPreviewFrame);
})();

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

    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, rect.w * scale, rect.h * scale);
    ctx.clip();
    ctx.drawImage(
      state.image,
      srcX,
      srcY,
      srcW,
      srcH,
      dx + (srcX - rect.sx) * scale,
      dy + (srcY - rect.sy) * scale,
      srcW * scale,
      srcH * scale,
    );
    ctx.restore();
  }

  function drawAdjustedPreview(frame) {
    state.lastPreviewFrame = frame || null;
    if (!state.image || !frame) {
      previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
      return;
    }

    const rect = adjustedCropRect(frame);
    const scale = Math.max(1, Math.min(8, Math.floor(160 / Math.max(rect.w, rect.h))));
    ui.preview.width = rect.w * scale;
    ui.preview.height = rect.h * scale;
    previewCtx.imageSmoothingEnabled = false;
    previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
    if (!ui.transparentBg?.checked) {
      previewCtx.fillStyle = ui.exportBg?.value || '#d9d9d9';
      previewCtx.fillRect(0, 0, ui.preview.width, ui.preview.height);
    }
    drawAdjustedCrop(previewCtx, frame, 0, 0, scale);
    drawPreviewGuides(rect.w, rect.h, scale);
  }

  function createAdjustedCard(frame, label) {
    const rect = adjustedCropRect(frame);
    const card = document.createElement('div');
    card.className = 'frame-card';
    if (rect.shiftX !== 0 || rect.shiftY !== 0 || rect.w !== frame.w || rect.h !== frame.h) card.classList.add('shifted');
    const canvas = document.createElement('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!ui.transparentBg?.checked) {
      ctx.fillStyle = ui.exportBg?.value || '#d9d9d9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    drawAdjustedCrop(ctx, frame, 0, 0, 1);
    const badge = document.createElement('span');
    badge.className = 'frame-index';
    badge.textContent = String(label);
    card.append(canvas, badge);
    return card;
  }

  function renderAdjustedOutput() {
    ui.output.textContent = '';
    state.outputFrameIds.forEach((id, index) => {
      const frame = getFrame(id);
      if (!frame) return;
      const card = createAdjustedCard(frame, index + 1);
      card.classList.remove('frame-card');
      card.classList.add('output-card');
      if (state.selectedFrameIds.has(id)) card.classList.add('selected');
      card.draggable = true;
      card.addEventListener('click', (event) => {
        state.selectedOutputIndex = index;
        selectFrameId(id, event.shiftKey || event.ctrlKey || event.metaKey);
        setStatus(`출력 ${index + 1}번 선택`);
      });
      card.addEventListener('dragstart', () => { state.dragIndex = index; });
      card.addEventListener('dragover', (event) => event.preventDefault());
      card.addEventListener('drop', (event) => { event.preventDefault(); moveOutput(state.dragIndex, index); });
      ui.output.append(card);
    });
  }

  function exportAdjustedPng() {
    if (!state.outputFrameIds.length) return setStatus('내보낼 프레임이 없습니다.');
    const cols = Math.max(1, Math.min(state.outputFrameIds.length, readNumber(ui.exportCols, readNumber(ui.cols, 6))));
    const rows = Math.ceil(state.outputFrameIds.length / cols);
    const s = settings();
    const padX = ui.keepSpacing?.checked ? s.ox : 0;
    const padY = ui.keepSpacing?.checked ? s.oy : 0;
    const gapX = ui.keepSpacing?.checked ? s.gx : 0;
    const gapY = ui.keepSpacing?.checked ? s.gy : 0;
    const rects = state.outputFrameIds.map((id) => getFrame(id)).filter(Boolean).map(adjustedCropRect);
    const cellW = Math.max(...rects.map((rect) => rect.w));
    const cellH = Math.max(...rects.map((rect) => rect.h));
    const canvas = document.createElement('canvas');
    canvas.width = padX * 2 + cellW * cols + gapX * Math.max(0, cols - 1);
    canvas.height = padY * 2 + cellH * rows + gapY * Math.max(0, rows - 1);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (!ui.transparentBg?.checked) {
      ctx.fillStyle = ui.exportBg?.value || '#d9d9d9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    state.outputFrameIds.forEach((id, i) => {
      const frame = getFrame(id);
      if (!frame) return;
      const x = padX + (i % cols) * (cellW + gapX);
      const y = padY + Math.floor(i / cols) * (cellH + gapY);
      drawAdjustedCrop(ctx, frame, x, y, 1);
    });
    const link = document.createElement('a');
    link.download = `sprite-sheet-${cols}x${rows}-${canvas.width}x${canvas.height}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.append(link);
    link.click();
    link.remove();
    setStatus(`PNG 내보내기 완료: ${canvas.width}x${canvas.height}`);
  }

  getSourceRect = adjustedCropRect;
  setShift = setCropShift;
  drawFrameImage = drawAdjustedCrop;
  drawPreview = drawAdjustedPreview;
  createCard = createAdjustedCard;
  renderOutput = renderAdjustedOutput;
  exportPng = exportAdjustedPng;

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
    ids.forEach((id) => nudgeSingleFrame(id, dx, dy));
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

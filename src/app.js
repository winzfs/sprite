const $ = (id) => document.getElementById(id);

const ui = {
  file: $('fileInput'),
  fw: $('frameWidthInput'),
  fh: $('frameHeightInput'),
  cols: $('sourceColsInput'),
  rows: $('sourceRowsInput'),
  ox: $('offsetXInput'),
  oy: $('offsetYInput'),
  gx: $('gapXInput'),
  gy: $('gapYInput'),
  zoom: $('zoomInput'),
  source: $('sourceCanvas'),
  preview: $('previewCanvas'),
  frames: $('frameList'),
  output: $('outputList'),
  status: $('statusText'),
  fps: $('fpsInput'),
  exportCols: $('exportColsInput'),
  exportBg: $('exportBgInput'),
  transparentBg: $('transparentBgInput'),
  keepSpacing: $('keepSpacingInput'),
  nudgeStep: $('nudgeStepInput'),
  selectedShift: $('selectedShiftInput'),
};

const sourceCtx = ui.source.getContext('2d', { willReadFrequently: true });
const previewCtx = ui.preview.getContext('2d');

const state = {
  image: null,
  imageUrl: '',
  frames: [],
  frameShifts: new Map(),
  selectedFrameIds: new Set(),
  outputFrameIds: [],
  selectedOutputIndex: -1,
  timerId: 0,
  isPlaying: false,
  playIndex: 0,
  dragIndex: -1,
  lastSliceText: '',
};

function setStatus(text) {
  ui.status.textContent = text;
}

function readNumber(input, fallback) {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function settings() {
  return {
    fw: Math.max(1, readNumber(ui.fw, 32)),
    fh: Math.max(1, readNumber(ui.fh, 32)),
    cols: Math.max(1, readNumber(ui.cols, 1)),
    rows: Math.max(1, readNumber(ui.rows, 1)),
    ox: Math.max(0, readNumber(ui.ox, 0)),
    oy: Math.max(0, readNumber(ui.oy, 0)),
    gx: Math.max(0, readNumber(ui.gx, 0)),
    gy: Math.max(0, readNumber(ui.gy, 0)),
  };
}

function stop() {
  state.isPlaying = false;
  window.clearTimeout(state.timerId);
}

function getFrame(id) {
  return state.frames.find((frame) => frame.id === id) || null;
}

function selectedFrameIds() {
  return Array.from(state.selectedFrameIds);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getShift(frameId) {
  return state.frameShifts.get(frameId) || { x: 0, y: 0 };
}

function setShift(frameId, shift) {
  if (shift.x === 0 && shift.y === 0) state.frameShifts.delete(frameId);
  else state.frameShifts.set(frameId, shift);
}

function getSourceRect(frame) {
  const shift = getShift(frame.id);
  const sx = clamp(frame.sx + shift.x, 0, state.image.naturalWidth - frame.w);
  const sy = clamp(frame.sy + shift.y, 0, state.image.naturalHeight - frame.h);
  return { sx, sy, w: frame.w, h: frame.h, shiftX: sx - frame.sx, shiftY: sy - frame.sy };
}

function getActiveFrameIds() {
  const ids = selectedFrameIds();
  if (ids.length) return ids;
  if (state.selectedOutputIndex >= 0 && state.outputFrameIds[state.selectedOutputIndex] !== undefined) {
    return [state.outputFrameIds[state.selectedOutputIndex]];
  }
  return [];
}

function updateShiftDisplay() {
  if (!ui.selectedShift) return;
  const ids = getActiveFrameIds();
  if (!ids.length) {
    ui.selectedShift.value = '선택 없음';
    return;
  }
  if (ids.length === 1) {
    const frame = getFrame(ids[0]);
    if (!frame) {
      ui.selectedShift.value = '선택 없음';
      return;
    }
    const rect = getSourceRect(frame);
    ui.selectedShift.value = `#${ids[0]} x:${rect.shiftX}, y:${rect.shiftY}`;
    return;
  }
  ui.selectedShift.value = `${ids.length}개 선택`;
}

function loadImage(file) {
  if (!file) return;
  stop();
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.imageUrl = url;
    state.frameShifts.clear();
    autoDetect();
    setStatus(`로드 완료: ${file.name} / ${image.naturalWidth}x${image.naturalHeight}`);
  };
  image.onerror = () => setStatus('이미지를 불러오지 못했습니다.');
  image.src = url;
}

function chooseAutoGrid(width, height) {
  const preferredSizes = [32, 48, 64, 96, 128, 24, 16, 256];
  let best = null;

  for (const size of preferredSizes) {
    if (width % size !== 0 || height % size !== 0) continue;
    const cols = width / size;
    const rows = height / size;
    if (cols < 1 || rows < 1 || cols > 64 || rows > 64) continue;
    const score = Math.abs(size - 64) + Math.abs(cols - 6) * 2 + Math.abs(rows - 4) * 2;
    if (!best || score < best.score) best = { fw: size, fh: size, cols, rows, score };
  }

  if (best) return best;

  const fallbackCols = Math.max(1, readNumber(ui.cols, 1));
  const fallbackRows = Math.max(1, readNumber(ui.rows, 1));
  return {
    fw: Math.max(1, Math.floor(width / fallbackCols)),
    fh: Math.max(1, Math.floor(height / fallbackRows)),
    cols: fallbackCols,
    rows: fallbackRows,
  };
}

function autoDetect() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  const grid = chooseAutoGrid(state.image.naturalWidth, state.image.naturalHeight);
  ui.ox.value = 0;
  ui.oy.value = 0;
  ui.gx.value = 0;
  ui.gy.value = 0;
  ui.fw.value = grid.fw;
  ui.fh.value = grid.fh;
  ui.cols.value = grid.cols;
  ui.rows.value = grid.rows;
  state.frameShifts.clear();
  sliceFrames({ keepOutput: false, keepShifts: false, silent: true });
  setStatus(`자동 추정: 전체 이미지 기준 ${grid.cols}열 x ${grid.rows}행 / ${grid.fw}x${grid.fh}px`);
}

function fitWholeSheet() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  const cols = Math.max(1, readNumber(ui.cols, 1));
  const rows = Math.max(1, readNumber(ui.rows, 1));
  ui.ox.value = 0;
  ui.oy.value = 0;
  ui.gx.value = 0;
  ui.gy.value = 0;
  ui.fw.value = Math.max(1, Math.floor(state.image.naturalWidth / cols));
  ui.fh.value = Math.max(1, Math.floor(state.image.naturalHeight / rows));
  state.frameShifts.clear();
  sliceFrames({ keepOutput: false, keepShifts: false, silent: true });
  setStatus(`전체 균등 적용: ${cols}열 x ${rows}행 / ${ui.fw.value}x${ui.fh.value}px`);
}

function sliceFrames(options = {}) {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  stop();
  const s = settings();
  const frames = [];
  let id = 0;

  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) {
      const sx = s.ox + col * (s.fw + s.gx);
      const sy = s.oy + row * (s.fh + s.gy);
      if (sx + s.fw <= state.image.naturalWidth && sy + s.fh <= state.image.naturalHeight) {
        frames.push({ id, sx, sy, w: s.fw, h: s.fh });
        id += 1;
      }
    }
  }

  state.frames = frames;
  state.selectedFrameIds.clear();

  if (!options.keepOutput) {
    state.outputFrameIds = [];
    state.selectedOutputIndex = -1;
    state.playIndex = 0;
  } else {
    state.outputFrameIds = state.outputFrameIds.filter((frameId) => frameId < frames.length);
    if (state.outputFrameIds.length === 0) state.selectedOutputIndex = -1;
    else state.selectedOutputIndex = Math.min(state.selectedOutputIndex, state.outputFrameIds.length - 1);
  }

  if (!options.keepShifts) {
    state.frameShifts.clear();
  } else {
    for (const frameId of Array.from(state.frameShifts.keys())) {
      if (frameId >= frames.length) state.frameShifts.delete(frameId);
    }
  }

  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(frames[0] || null);
  updateShiftDisplay();
  state.lastSliceText = `${frames.length}개 프레임 / ${s.cols}열 x ${s.rows}행 / ${s.fw}x${s.fh}px`;
  if (!options.silent) setStatus(`분할 갱신: ${state.lastSliceText}`);
}

function previewFrames() {
  if (!state.image) return [];
  const s = settings();
  const frames = [];
  let id = 0;
  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) {
      const sx = s.ox + col * (s.fw + s.gx);
      const sy = s.oy + row * (s.fh + s.gy);
      if (sx + s.fw <= state.image.naturalWidth && sy + s.fh <= state.image.naturalHeight) {
        frames.push({ id, sx, sy, w: s.fw, h: s.fh });
        id += 1;
      }
    }
  }
  return frames;
}

function drawSource() {
  if (!state.image) return;
  const zoom = Math.max(1, readNumber(ui.zoom, 2));
  ui.source.width = state.image.naturalWidth * zoom;
  ui.source.height = state.image.naturalHeight * zoom;
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.clearRect(0, 0, ui.source.width, ui.source.height);
  sourceCtx.drawImage(state.image, 0, 0, ui.source.width, ui.source.height);

  const frames = state.frames.length ? state.frames : previewFrames();
  sourceCtx.font = `${Math.max(10, 10 * zoom)}px sans-serif`;
  for (const frame of frames) {
    const rect = state.image ? getSourceRect(frame) : frame;
    const isShifted = rect.shiftX !== 0 || rect.shiftY !== 0;
    const isSelected = state.selectedFrameIds.has(frame.id);

    sourceCtx.strokeStyle = '#60a5fa';
    sourceCtx.strokeRect(frame.sx * zoom + 0.5, frame.sy * zoom + 0.5, frame.w * zoom, frame.h * zoom);

    if (isShifted || isSelected) {
      sourceCtx.strokeStyle = isShifted ? '#fbbf24' : '#93c5fd';
      sourceCtx.strokeRect(rect.sx * zoom + 1.5, rect.sy * zoom + 1.5, rect.w * zoom - 2, rect.h * zoom - 2);
    }

    if (isSelected) {
      sourceCtx.fillStyle = 'rgba(96,165,250,.25)';
      sourceCtx.fillRect(rect.sx * zoom, rect.sy * zoom, rect.w * zoom, rect.h * zoom);
    }

    sourceCtx.fillStyle = 'rgba(0,0,0,.7)';
    sourceCtx.fillRect(rect.sx * zoom + 2, rect.sy * zoom + 2, 28, 16);
    sourceCtx.fillStyle = '#fff';
    sourceCtx.fillText(String(frame.id), rect.sx * zoom + 6, rect.sy * zoom + 14);
  }
}

function drawPreview(frame) {
  if (!state.image || !frame) {
    previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
    return;
  }
  const rect = getSourceRect(frame);
  const scale = Math.max(1, Math.min(8, Math.floor(128 / Math.max(frame.w, frame.h))));
  ui.preview.width = frame.w * scale;
  ui.preview.height = frame.h * scale;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
  previewCtx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, ui.preview.width, ui.preview.height);
}

function createCard(frame, label) {
  const rect = getSourceRect(frame);
  const card = document.createElement('div');
  card.className = 'frame-card';
  if (rect.shiftX !== 0 || rect.shiftY !== 0) card.classList.add('shifted');
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, frame.w, frame.h);
  const badge = document.createElement('span');
  badge.className = 'frame-index';
  badge.textContent = String(label);
  card.append(canvas, badge);
  return card;
}

function renderFrames() {
  ui.frames.textContent = '';
  for (const frame of state.frames) {
    const card = createCard(frame, frame.id);
    if (state.selectedFrameIds.has(frame.id)) card.classList.add('selected');
    card.addEventListener('click', (event) => toggleFrame(frame, event.shiftKey));
    card.addEventListener('dblclick', () => addOutput([frame.id]));
    ui.frames.append(card);
  }
}

function toggleFrame(frame, multi) {
  if (!multi) state.selectedFrameIds.clear();
  if (state.selectedFrameIds.has(frame.id)) state.selectedFrameIds.delete(frame.id);
  else state.selectedFrameIds.add(frame.id);
  drawPreview(frame);
  renderFrames();
  drawSource();
  updateShiftDisplay();
  setStatus(`프레임 ${frame.id} 선택`);
}

function nudgeSelectedFrames(dx, dy) {
  const ids = getActiveFrameIds();
  if (!ids.length) {
    setStatus('위치를 조정할 프레임을 먼저 선택하세요.');
    return;
  }

  for (const id of ids) {
    const frame = getFrame(id);
    if (!frame) continue;
    const current = getShift(id);
    const nextRaw = { x: current.x + dx, y: current.y + dy };
    const sx = clamp(frame.sx + nextRaw.x, 0, state.image.naturalWidth - frame.w);
    const sy = clamp(frame.sy + nextRaw.y, 0, state.image.naturalHeight - frame.h);
    setShift(id, { x: sx - frame.sx, y: sy - frame.sy });
  }

  const firstFrame = getFrame(ids[0]);
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(firstFrame);
  updateShiftDisplay();
  setStatus(`${ids.length}개 프레임 위치 보정: x ${dx}, y ${dy}`);
}

function resetSelectedFrameShifts() {
  const ids = getActiveFrameIds();
  if (!ids.length) {
    setStatus('보정을 초기화할 프레임을 먼저 선택하세요.');
    return;
  }
  for (const id of ids) state.frameShifts.delete(id);
  const firstFrame = getFrame(ids[0]);
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(firstFrame);
  updateShiftDisplay();
  setStatus(`${ids.length}개 프레임 위치 보정 초기화`);
}

function detectOpaqueBounds(frame) {
  if (!state.image || !frame) return null;

  const rect = getSourceRect(frame);
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, frame.w, frame.h);

  const data = ctx.getImageData(0, 0, frame.w, frame.h).data;
  let minX = frame.w;
  let minY = frame.h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < frame.h; y += 1) {
    for (let x = 0; x < frame.w; x += 1) {
      const alpha = data[(y * frame.w + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function alignSelectedFrames(horizontal, vertical) {
  const ids = getActiveFrameIds();
  if (!ids.length) {
    setStatus('가운데 정렬할 프레임을 먼저 선택하세요.');
    return;
  }

  let changedCount = 0;

  for (const id of ids) {
    const frame = getFrame(id);
    if (!frame) continue;

    const bounds = detectOpaqueBounds(frame);
    if (!bounds) continue;

    let dx = 0;
    let dy = 0;

    if (horizontal) {
      const contentCenterX = (bounds.minX + bounds.maxX + 1) / 2;
      const frameCenterX = frame.w / 2;
      dx = Math.round(frameCenterX - contentCenterX);
    }

    if (vertical) {
      const contentCenterY = (bounds.minY + bounds.maxY + 1) / 2;
      const frameCenterY = frame.h / 2;
      dy = Math.round(frameCenterY - contentCenterY);
    }

    if (dx === 0 && dy === 0) continue;

    const current = getShift(id);
    const sx = clamp(frame.sx + current.x + dx, 0, state.image.naturalWidth - frame.w);
    const sy = clamp(frame.sy + current.y + dy, 0, state.image.naturalHeight - frame.h);
    setShift(id, { x: sx - frame.sx, y: sy - frame.sy });
    changedCount += 1;
  }

  const firstFrame = getFrame(ids[0]);
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(firstFrame);
  updateShiftDisplay();

  if (!changedCount) {
    setStatus('정렬할 픽셀 영역을 찾지 못했거나 이미 가운데입니다.');
    return;
  }

  if (horizontal && vertical) setStatus(`${changedCount}개 프레임을 픽셀 기준 가운데 정렬했습니다.`);
  else if (horizontal) setStatus(`${changedCount}개 프레임을 픽셀 기준 좌우 가운데 정렬했습니다.`);
  else if (vertical) setStatus(`${changedCount}개 프레임을 픽셀 기준 상하 가운데 정렬했습니다.`);
}

function addOutput(frameIds) {
  if (!state.frames.length) {
    setStatus('먼저 이미지를 업로드하고 프레임을 나누세요.');
    return;
  }
  if (!frameIds.length) {
    setStatus('선택된 프레임이 없습니다.');
    return;
  }
  for (const id of frameIds) if (getFrame(id)) state.outputFrameIds.push(id);
  if (state.selectedOutputIndex < 0 && state.outputFrameIds.length) state.selectedOutputIndex = 0;
  renderOutput();
  setStatus(`${frameIds.length}개 프레임을 출력 순서에 추가했습니다.`);
}

function addAllOutput() {
  addOutput(state.frames.map((frame) => frame.id));
}

function renderOutput() {
  ui.output.textContent = '';
  state.outputFrameIds.forEach((id, index) => {
    const frame = getFrame(id);
    if (!frame) return;
    const card = createCard(frame, index + 1);
    card.classList.remove('frame-card');
    card.classList.add('output-card');
    if (state.selectedOutputIndex === index) card.classList.add('selected');
    card.draggable = true;
    card.addEventListener('click', () => {
      state.selectedOutputIndex = index;
      state.selectedFrameIds.clear();
      state.selectedFrameIds.add(id);
      drawPreview(frame);
      renderFrames();
      renderOutput();
      drawSource();
      updateShiftDisplay();
      setStatus(`출력 ${index + 1}번 선택`);
    });
    card.addEventListener('dragstart', () => { state.dragIndex = index; });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      moveOutput(state.dragIndex, index);
    });
    ui.output.append(card);
  });
}

function ensureOutput() {
  if (state.outputFrameIds.length) return true;
  if (state.frames.length) {
    addAllOutput();
    setStatus('출력 순서가 비어 있어 전체 프레임을 자동 추가했습니다.');
    return true;
  }
  setStatus('먼저 이미지를 업로드하고 프레임을 나누세요.');
  return false;
}

function moveOutput(from, to) {
  if (!ensureOutput()) return;
  if (from < 0) from = state.selectedOutputIndex < 0 ? 0 : state.selectedOutputIndex;
  if (to < 0 || to >= state.outputFrameIds.length) {
    setStatus('더 이동할 수 없습니다.');
    return;
  }
  if (from === to) return;
  const [item] = state.outputFrameIds.splice(from, 1);
  state.outputFrameIds.splice(to, 0, item);
  state.selectedOutputIndex = to;
  renderOutput();
  drawPreview(getFrame(state.outputFrameIds[to]));
  updateShiftDisplay();
  setStatus('출력 순서를 이동했습니다.');
}

function play() {
  if (state.isPlaying) return;
  if (!ensureOutput()) return;
  state.isPlaying = true;
  setStatus('재생 중');
  const tick = () => {
    if (!state.isPlaying) return;
    const index = state.playIndex % state.outputFrameIds.length;
    state.selectedOutputIndex = index;
    const frame = getFrame(state.outputFrameIds[index]);
    drawPreview(frame);
    renderOutput();
    updateShiftDisplay();
    state.playIndex += 1;
    const fps = Math.max(1, Math.min(60, readNumber(ui.fps, 8)));
    state.timerId = window.setTimeout(tick, 1000 / fps);
  };
  tick();
}

function exportPng() {
  if (!ensureOutput()) return;
  const first = getFrame(state.outputFrameIds[0]);
  if (!first) return;

  const s = settings();
  const cols = Math.max(1, Math.min(state.outputFrameIds.length, readNumber(ui.exportCols, 6)));
  const rows = Math.ceil(state.outputFrameIds.length / cols);
  const keepSpacing = ui.keepSpacing ? ui.keepSpacing.checked : true;
  const padX = keepSpacing ? s.ox : 0;
  const padY = keepSpacing ? s.oy : 0;
  const gapX = keepSpacing ? s.gx : 0;
  const gapY = keepSpacing ? s.gy : 0;
  const cellW = first.w;
  const cellH = first.h;

  const canvas = document.createElement('canvas');
  canvas.width = padX * 2 + cellW * cols + gapX * Math.max(0, cols - 1);
  canvas.height = padY * 2 + cellH * rows + gapY * Math.max(0, rows - 1);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  if (!ui.transparentBg || !ui.transparentBg.checked) {
    ctx.fillStyle = ui.exportBg ? ui.exportBg.value : '#d9d9d9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  state.outputFrameIds.forEach((id, index) => {
    const frame = getFrame(id);
    if (!frame) return;
    const rect = getSourceRect(frame);
    const col = index % cols;
    const row = Math.floor(index / cols);
    const dx = padX + col * (cellW + gapX);
    const dy = padY + row * (cellH + gapY);
    ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, dx, dy, cellW, cellH);
  });

  const link = document.createElement('a');
  link.download = `sprite-sheet-${cols}x${rows}-${canvas.width}x${canvas.height}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.append(link);
  link.click();
  link.remove();
  setStatus(`PNG 내보내기 완료: ${canvas.width}x${canvas.height} / 위치 보정 ${state.frameShifts.size}개 적용`);
}

function reset() {
  stop();
  state.frames = [];
  state.frameShifts.clear();
  state.selectedFrameIds.clear();
  state.outputFrameIds = [];
  state.selectedOutputIndex = -1;
  state.playIndex = 0;
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(null);
  updateShiftDisplay();
  setStatus('초기화 완료');
}

function bind() {
  ui.file.addEventListener('change', (event) => loadImage(event.target.files[0]));
  ui.zoom.addEventListener('input', drawSource);
  [ui.fw, ui.fh, ui.cols, ui.rows, ui.ox, ui.oy, ui.gx, ui.gy].forEach((input) => {
    input.addEventListener('input', () => sliceFrames({ keepOutput: true, keepShifts: true, silent: false }));
  });

  document.addEventListener('click', (event) => {
    const id = event.target.id;
    const step = Math.max(1, readNumber(ui.nudgeStep, 1));
    if (id === 'testButton') setStatus('버튼 동작 정상입니다.');
    if (id === 'autoDetectButton') autoDetect();
    if (id === 'fitWholeButton') fitWholeSheet();
    if (id === 'sliceButton') sliceFrames({ keepOutput: false, keepShifts: false, silent: false });
    if (id === 'resetButton') reset();
    if (id === 'nudgeUpButton') nudgeSelectedFrames(0, -step);
    if (id === 'nudgeDownButton') nudgeSelectedFrames(0, step);
    if (id === 'nudgeLeftButton') nudgeSelectedFrames(-step, 0);
    if (id === 'nudgeRightButton') nudgeSelectedFrames(step, 0);
    if (id === 'nudgeResetButton') resetSelectedFrameShifts();
    if (id === 'centerXButton') alignSelectedFrames(true, false);
    if (id === 'centerYButton') alignSelectedFrames(false, true);
    if (id === 'centerBothButton') alignSelectedFrames(true, true);
    if (id === 'playButton') play();
    if (id === 'stopButton') { stop(); setStatus('재생 정지'); }
    if (id === 'addSelectedButton') addOutput(selectedFrameIds());
    if (id === 'addAllButton') addAllOutput();
    if (id === 'moveOutputLeftButton') moveOutput(state.selectedOutputIndex, state.selectedOutputIndex - 1);
    if (id === 'moveOutputRightButton') moveOutput(state.selectedOutputIndex, state.selectedOutputIndex + 1);
    if (id === 'removeSelectedOutputButton') {
      if (!ensureOutput()) return;
      if (state.selectedOutputIndex < 0) state.selectedOutputIndex = 0;
      state.outputFrameIds.splice(state.selectedOutputIndex, 1);
      state.selectedOutputIndex = Math.min(state.selectedOutputIndex, state.outputFrameIds.length - 1);
      renderOutput();
      updateShiftDisplay();
      setStatus('선택 출력 프레임 제거');
    }
    if (id === 'clearOutputButton') {
      state.outputFrameIds = [];
      state.selectedOutputIndex = -1;
      renderOutput();
      updateShiftDisplay();
      setStatus('출력 비움');
    }
    if (id === 'exportButton') exportPng();
  });

  ui.source.addEventListener('click', (event) => {
    if (!state.frames.length) return;
    const rect = ui.source.getBoundingClientRect();
    const zoom = Math.max(1, readNumber(ui.zoom, 2));
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;
    const frame = state.frames.find((item) => {
      const sourceRect = getSourceRect(item);
      return x >= sourceRect.sx && x < sourceRect.sx + sourceRect.w && y >= sourceRect.sy && y < sourceRect.sy + sourceRect.h;
    });
    if (frame) toggleFrame(frame, event.shiftKey);
  });
}

bind();
updateShiftDisplay();
setStatus('JS 연결 완료. 픽셀 기준 가운데 정렬을 사용할 수 있습니다.');

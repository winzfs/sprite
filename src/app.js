const $ = (id) => document.getElementById(id);

const ui = {
  file: $('fileInput'), fw: $('frameWidthInput'), fh: $('frameHeightInput'), cols: $('sourceColsInput'), rows: $('sourceRowsInput'),
  ox: $('offsetXInput'), oy: $('offsetYInput'), gx: $('gapXInput'), gy: $('gapYInput'), zoom: $('zoomInput'),
  source: $('sourceCanvas'), preview: $('previewCanvas'), frames: $('frameList'), output: $('outputList'), status: $('statusText'),
  fps: $('fpsInput'), exportCols: $('exportColsInput'), exportBg: $('exportBgInput'), transparentBg: $('transparentBgInput'), keepSpacing: $('keepSpacingInput'),
  nudgeStep: $('nudgeStepInput'), selectedShift: $('selectedShiftInput'), showPreviewFrame: $('showPreviewFrameInput'), showPreviewCenter: $('showPreviewCenterInput'),
  boxStep: $('boxStepInput'), selectedBox: $('selectedBoxInput'),
};

const sourceCtx = ui.source.getContext('2d', { willReadFrequently: true });
const previewCtx = ui.preview.getContext('2d');

const state = {
  image: null,
  imageUrl: '',
  frames: [],
  frameShifts: new Map(),
  frameSizes: new Map(),
  selectedFrameIds: new Set(),
  outputFrameIds: [],
  selectedOutputIndex: -1,
  timerId: 0,
  isPlaying: false,
  playIndex: 0,
  dragIndex: -1,
  lastPreviewFrame: null,
};

function setStatus(text) { ui.status.textContent = text; }
function readNumber(input, fallback) {
  const value = Number.parseInt(input?.value, 10);
  return Number.isFinite(value) ? value : fallback;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function settings() {
  return {
    fw: Math.max(1, readNumber(ui.fw, 32)), fh: Math.max(1, readNumber(ui.fh, 32)),
    cols: Math.max(1, readNumber(ui.cols, 1)), rows: Math.max(1, readNumber(ui.rows, 1)),
    ox: Math.max(0, readNumber(ui.ox, 0)), oy: Math.max(0, readNumber(ui.oy, 0)),
    gx: Math.max(0, readNumber(ui.gx, 0)), gy: Math.max(0, readNumber(ui.gy, 0)),
  };
}
function stop() { state.isPlaying = false; window.clearTimeout(state.timerId); }
function getFrame(id) { return state.frames.find((frame) => frame.id === id) || null; }
function selectedFrameIds() { return Array.from(state.selectedFrameIds); }
function getShift(frameId) { return state.frameShifts.get(frameId) || { x: 0, y: 0 }; }
function setShift(frameId, shift) {
  if (shift.x === 0 && shift.y === 0) state.frameShifts.delete(frameId);
  else state.frameShifts.set(frameId, shift);
}
function getBoxSize(frame) {
  const size = state.frameSizes.get(frame.id);
  return { w: size?.w || frame.w, h: size?.h || frame.h };
}
function setBoxSize(frameId, size, baseFrame) {
  const w = Math.max(1, size.w);
  const h = Math.max(1, size.h);
  if (baseFrame && w === baseFrame.w && h === baseFrame.h) state.frameSizes.delete(frameId);
  else state.frameSizes.set(frameId, { w, h });
}
function getSourceRect(frame) {
  const shift = getShift(frame.id);
  const size = getBoxSize(frame);
  const maxX = Math.max(0, state.image.naturalWidth - size.w);
  const maxY = Math.max(0, state.image.naturalHeight - size.h);
  const sx = clamp(frame.sx + shift.x, 0, maxX);
  const sy = clamp(frame.sy + shift.y, 0, maxY);
  return { sx, sy, w: size.w, h: size.h, shiftX: sx - frame.sx, shiftY: sy - frame.sy };
}
function getActiveFrameIds() {
  const ids = selectedFrameIds();
  if (ids.length) return ids;
  if (state.selectedOutputIndex >= 0 && state.outputFrameIds[state.selectedOutputIndex] !== undefined) return [state.outputFrameIds[state.selectedOutputIndex]];
  return [];
}
function updateInfoDisplays() {
  const ids = getActiveFrameIds();
  if (!ids.length) {
    if (ui.selectedShift) ui.selectedShift.value = '선택 없음';
    if (ui.selectedBox) ui.selectedBox.value = '선택 없음';
    return;
  }
  if (ids.length === 1) {
    const frame = getFrame(ids[0]);
    if (!frame) return;
    const rect = getSourceRect(frame);
    if (ui.selectedShift) ui.selectedShift.value = `#${ids[0]} x:${rect.shiftX}, y:${rect.shiftY}`;
    if (ui.selectedBox) ui.selectedBox.value = `#${ids[0]} ${rect.w}x${rect.h}`;
  } else {
    if (ui.selectedShift) ui.selectedShift.value = `${ids.length}개 선택`;
    if (ui.selectedBox) ui.selectedBox.value = `${ids.length}개 선택`;
  }
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
    state.frameSizes.clear();
    autoDetect();
    setStatus(`로드 완료: ${file.name} / ${image.naturalWidth}x${image.naturalHeight}`);
  };
  image.onerror = () => setStatus('이미지를 불러오지 못했습니다.');
  image.src = url;
}
function chooseAutoGrid(width, height) {
  const sizes = [32, 48, 64, 96, 128, 24, 16, 256];
  let best = null;
  for (const size of sizes) {
    if (width % size !== 0 || height % size !== 0) continue;
    const cols = width / size, rows = height / size;
    if (cols < 1 || rows < 1 || cols > 64 || rows > 64) continue;
    const score = Math.abs(size - 64) + Math.abs(cols - 6) * 2 + Math.abs(rows - 4) * 2;
    if (!best || score < best.score) best = { fw: size, fh: size, cols, rows, score };
  }
  if (best) return best;
  const cols = Math.max(1, readNumber(ui.cols, 1));
  const rows = Math.max(1, readNumber(ui.rows, 1));
  return { fw: Math.max(1, Math.floor(width / cols)), fh: Math.max(1, Math.floor(height / rows)), cols, rows };
}
function autoDetect() {
  if (!state.image) return setStatus('먼저 이미지를 업로드하세요.');
  const grid = chooseAutoGrid(state.image.naturalWidth, state.image.naturalHeight);
  ui.ox.value = 0; ui.oy.value = 0; ui.gx.value = 0; ui.gy.value = 0;
  ui.fw.value = grid.fw; ui.fh.value = grid.fh; ui.cols.value = grid.cols; ui.rows.value = grid.rows;
  state.frameShifts.clear(); state.frameSizes.clear();
  sliceFrames({ keepAdjustments: false, silent: true });
  setStatus(`자동 추정: ${grid.cols}열 x ${grid.rows}행 / ${grid.fw}x${grid.fh}px`);
}
function fitWholeSheet() {
  if (!state.image) return setStatus('먼저 이미지를 업로드하세요.');
  const cols = Math.max(1, readNumber(ui.cols, 1));
  const rows = Math.max(1, readNumber(ui.rows, 1));
  ui.ox.value = 0; ui.oy.value = 0; ui.gx.value = 0; ui.gy.value = 0;
  ui.fw.value = Math.max(1, Math.floor(state.image.naturalWidth / cols));
  ui.fh.value = Math.max(1, Math.floor(state.image.naturalHeight / rows));
  state.frameShifts.clear(); state.frameSizes.clear();
  sliceFrames({ keepAdjustments: false, silent: true });
  setStatus(`전체 균등 적용: ${cols}열 x ${rows}행 / ${ui.fw.value}x${ui.fh.value}px`);
}
function fillOutputWithAllFrames() {
  state.outputFrameIds = state.frames.map((frame) => frame.id);
  state.selectedOutputIndex = state.outputFrameIds.length ? 0 : -1;
}
function sliceFrames(options = {}) {
  if (!state.image) return setStatus('먼저 이미지를 업로드하세요.');
  stop();
  const s = settings();
  const frames = [];
  let id = 0;
  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) {
      const sx = s.ox + col * (s.fw + s.gx);
      const sy = s.oy + row * (s.fh + s.gy);
      if (sx + s.fw <= state.image.naturalWidth && sy + s.fh <= state.image.naturalHeight) frames.push({ id: id++, sx, sy, w: s.fw, h: s.fh });
    }
  }
  state.frames = frames;
  state.selectedFrameIds.clear();
  fillOutputWithAllFrames();
  if (!options.keepAdjustments) { state.frameShifts.clear(); state.frameSizes.clear(); }
  else {
    for (const id of Array.from(state.frameShifts.keys())) if (id >= frames.length) state.frameShifts.delete(id);
    for (const id of Array.from(state.frameSizes.keys())) if (id >= frames.length) state.frameSizes.delete(id);
  }
  renderFrames(); renderOutput(); drawSource(); drawPreview(frames[0] || null); updateInfoDisplays();
  if (!options.silent) setStatus(`분할 갱신: ${frames.length}개 / ${s.cols}열 x ${s.rows}행 / ${s.fw}x${s.fh}px`);
}
function previewFrames() {
  if (!state.image) return [];
  const s = settings();
  const frames = [];
  let id = 0;
  for (let row = 0; row < s.rows; row += 1) for (let col = 0; col < s.cols; col += 1) {
    const sx = s.ox + col * (s.fw + s.gx), sy = s.oy + row * (s.fh + s.gy);
    if (sx + s.fw <= state.image.naturalWidth && sy + s.fh <= state.image.naturalHeight) frames.push({ id: id++, sx, sy, w: s.fw, h: s.fh });
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
    const rect = getSourceRect(frame);
    const isSelected = state.selectedFrameIds.has(frame.id);
    const adjusted = rect.shiftX !== 0 || rect.shiftY !== 0 || rect.w !== frame.w || rect.h !== frame.h;
    sourceCtx.strokeStyle = '#60a5fa';
    sourceCtx.strokeRect(frame.sx * zoom + 0.5, frame.sy * zoom + 0.5, frame.w * zoom, frame.h * zoom);
    if (adjusted || isSelected) {
      sourceCtx.strokeStyle = adjusted ? '#fbbf24' : '#93c5fd';
      sourceCtx.strokeRect(rect.sx * zoom + 1.5, rect.sy * zoom + 1.5, rect.w * zoom - 2, rect.h * zoom - 2);
    }
    if (isSelected) {
      sourceCtx.fillStyle = 'rgba(96,165,250,.22)';
      sourceCtx.fillRect(rect.sx * zoom, rect.sy * zoom, rect.w * zoom, rect.h * zoom);
    }
    sourceCtx.fillStyle = 'rgba(0,0,0,.7)';
    sourceCtx.fillRect(rect.sx * zoom + 2, rect.sy * zoom + 2, 28, 16);
    sourceCtx.fillStyle = '#fff';
    sourceCtx.fillText(String(frame.id), rect.sx * zoom + 6, rect.sy * zoom + 14);
  }
}
function drawPreviewGuides(width, height, scale) {
  if (ui.showPreviewFrame?.checked) {
    previewCtx.save();
    previewCtx.strokeStyle = 'rgba(255,255,255,.98)'; previewCtx.lineWidth = 1;
    previewCtx.strokeRect(0.5, 0.5, width * scale - 1, height * scale - 1);
    previewCtx.strokeStyle = 'rgba(0,0,0,.85)'; previewCtx.setLineDash([4, 3]);
    previewCtx.strokeRect(2.5, 2.5, width * scale - 5, height * scale - 5);
    previewCtx.restore();
  }
  if (ui.showPreviewCenter?.checked) {
    const cx = Math.floor((width * scale) / 2) + 0.5, cy = Math.floor((height * scale) / 2) + 0.5;
    previewCtx.save(); previewCtx.strokeStyle = 'rgba(110,168,254,.95)'; previewCtx.lineWidth = 1; previewCtx.setLineDash([3, 3]);
    previewCtx.beginPath(); previewCtx.moveTo(cx, 0); previewCtx.lineTo(cx, height * scale); previewCtx.moveTo(0, cy); previewCtx.lineTo(width * scale, cy); previewCtx.stroke(); previewCtx.restore();
  }
}
function drawPreview(frame) {
  state.lastPreviewFrame = frame || null;
  if (!state.image || !frame) { previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height); return; }
  const rect = getSourceRect(frame);
  const scale = Math.max(1, Math.min(8, Math.floor(160 / Math.max(rect.w, rect.h))));
  ui.preview.width = rect.w * scale; ui.preview.height = rect.h * scale;
  previewCtx.imageSmoothingEnabled = false; previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
  previewCtx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, ui.preview.width, ui.preview.height);
  drawPreviewGuides(rect.w, rect.h, scale);
}
function createCard(frame, label) {
  const rect = getSourceRect(frame);
  const card = document.createElement('div');
  card.className = 'frame-card';
  if (rect.shiftX !== 0 || rect.shiftY !== 0 || rect.w !== frame.w || rect.h !== frame.h) card.classList.add('shifted');
  const canvas = document.createElement('canvas'); canvas.width = rect.w; canvas.height = rect.h;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const badge = document.createElement('span'); badge.className = 'frame-index'; badge.textContent = String(label);
  card.append(canvas, badge); return card;
}
function renderFrames() { if (ui.frames) ui.frames.textContent = ''; }
function selectFrameId(id, multi) {
  if (!multi) state.selectedFrameIds.clear();
  if (multi && state.selectedFrameIds.has(id)) state.selectedFrameIds.delete(id); else state.selectedFrameIds.add(id);
  const frame = getFrame(id);
  if (frame) drawPreview(frame);
  renderOutput(); drawSource(); updateInfoDisplays();
}
function renderOutput() {
  ui.output.textContent = '';
  state.outputFrameIds.forEach((id, index) => {
    const frame = getFrame(id); if (!frame) return;
    const card = createCard(frame, index + 1);
    card.classList.remove('frame-card'); card.classList.add('output-card');
    if (state.selectedFrameIds.has(id)) card.classList.add('selected');
    card.draggable = true;
    card.addEventListener('click', (event) => { state.selectedOutputIndex = index; selectFrameId(id, event.shiftKey || event.ctrlKey || event.metaKey); setStatus(`출력 ${index + 1}번 선택`); });
    card.addEventListener('dragstart', () => { state.dragIndex = index; });
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => { event.preventDefault(); moveOutput(state.dragIndex, index); });
    ui.output.append(card);
  });
}
function selectAllOutput() {
  state.selectedFrameIds = new Set(state.outputFrameIds);
  const first = getFrame(state.outputFrameIds[0]);
  if (first) drawPreview(first);
  renderOutput(); drawSource(); updateInfoDisplays();
  setStatus(`${state.selectedFrameIds.size}개 프레임 전체 선택`);
}
function clearSelection() {
  state.selectedFrameIds.clear(); renderOutput(); drawSource(); updateInfoDisplays(); setStatus('선택 해제');
}
function nudgeSelectedFrames(dx, dy) {
  const ids = getActiveFrameIds();
  if (!ids.length) return setStatus('위치를 조정할 프레임을 먼저 선택하세요.');
  for (const id of ids) {
    const frame = getFrame(id); if (!frame) continue;
    const current = getShift(id); const size = getBoxSize(frame);
    const sx = clamp(frame.sx + current.x + dx, 0, state.image.naturalWidth - size.w);
    const sy = clamp(frame.sy + current.y + dy, 0, state.image.naturalHeight - size.h);
    setShift(id, { x: sx - frame.sx, y: sy - frame.sy });
  }
  const first = getFrame(ids[0]); renderOutput(); drawSource(); drawPreview(first); updateInfoDisplays(); setStatus(`${ids.length}개 위치 보정`);
}
function resizeSelectedBoxes(dw, dh) {
  const ids = getActiveFrameIds();
  if (!ids.length) return setStatus('크기를 조정할 프레임을 먼저 선택하세요.');
  for (const id of ids) {
    const frame = getFrame(id); if (!frame) continue;
    const size = getBoxSize(frame);
    const maxW = state.image.naturalWidth - getSourceRect(frame).sx;
    const maxH = state.image.naturalHeight - getSourceRect(frame).sy;
    setBoxSize(id, { w: clamp(size.w + dw, 1, maxW), h: clamp(size.h + dh, 1, maxH) }, frame);
  }
  const first = getFrame(ids[0]); renderOutput(); drawSource(); drawPreview(first); updateInfoDisplays(); setStatus(`${ids.length}개 프레임 박스 크기 보정`);
}
function resetSelectedFrameShifts() {
  const ids = getActiveFrameIds(); if (!ids.length) return setStatus('보정을 초기화할 프레임을 먼저 선택하세요.');
  for (const id of ids) state.frameShifts.delete(id);
  const first = getFrame(ids[0]); renderOutput(); drawSource(); drawPreview(first); updateInfoDisplays(); setStatus(`${ids.length}개 위치 보정 초기화`);
}
function resetSelectedBoxSizes() {
  const ids = getActiveFrameIds(); if (!ids.length) return setStatus('크기를 초기화할 프레임을 먼저 선택하세요.');
  for (const id of ids) state.frameSizes.delete(id);
  const first = getFrame(ids[0]); renderOutput(); drawSource(); drawPreview(first); updateInfoDisplays(); setStatus(`${ids.length}개 프레임 크기 초기화`);
}
function colorDistanceSq(data, index, color) { const dr = data[index] - color.r, dg = data[index + 1] - color.g, db = data[index + 2] - color.b; return dr * dr + dg * dg + db * db; }
function getPixelColor(data, width, x, y) { const index = (y * width + x) * 4; return { r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] }; }
function detectOpaqueBounds(frame) {
  const rect = getSourceRect(frame);
  const canvas = document.createElement('canvas'); canvas.width = rect.w; canvas.height = rect.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const data = ctx.getImageData(0, 0, rect.w, rect.h).data;
  const corners = [getPixelColor(data, rect.w, 0, 0), getPixelColor(data, rect.w, rect.w - 1, 0), getPixelColor(data, rect.w, 0, rect.h - 1), getPixelColor(data, rect.w, rect.w - 1, rect.h - 1)];
  const alphaHasTransparency = corners.some((c) => c.a < 250);
  const bg = corners.filter((c) => c.a > 8); const threshold = 18 * 18 * 3;
  let minX = rect.w, minY = rect.h, maxX = -1, maxY = -1, detected = 0;
  for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
    const i = (y * rect.w + x) * 4, a = data[i + 3]; if (a <= 8) continue;
    let content = true; if (!alphaHasTransparency && bg.length) content = !bg.some((c) => colorDistanceSq(data, i, c) <= threshold);
    if (content) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); detected++; }
  }
  if (!detected) return null;
  return { minX, minY, maxX, maxY };
}
function alignSelectedFrames(horizontal, vertical) {
  const ids = getActiveFrameIds(); if (!ids.length) return setStatus('가운데 정렬할 프레임을 먼저 선택하세요.');
  let changed = 0;
  for (const id of ids) {
    const frame = getFrame(id); if (!frame) continue;
    const bounds = detectOpaqueBounds(frame); if (!bounds) continue;
    const rect = getSourceRect(frame); let dx = 0, dy = 0;
    if (horizontal) dx = Math.round(rect.w / 2 - (bounds.minX + bounds.maxX + 1) / 2);
    if (vertical) dy = Math.round(rect.h / 2 - (bounds.minY + bounds.maxY + 1) / 2);
    if (dx || dy) { nudgeSingleFrame(id, dx, dy); changed++; }
  }
  const first = getFrame(ids[0]); renderOutput(); drawSource(); drawPreview(first); updateInfoDisplays(); setStatus(changed ? `${changed}개 프레임 가운데 정렬` : '정렬할 픽셀 영역을 찾지 못했거나 이미 가운데입니다.');
}
function nudgeSingleFrame(id, dx, dy) {
  const frame = getFrame(id); if (!frame) return;
  const current = getShift(id), size = getBoxSize(frame);
  const sx = clamp(frame.sx + current.x + dx, 0, state.image.naturalWidth - size.w);
  const sy = clamp(frame.sy + current.y + dy, 0, state.image.naturalHeight - size.h);
  setShift(id, { x: sx - frame.sx, y: sy - frame.sy });
}
function moveOutput(from, to) {
  if (from < 0) from = state.selectedOutputIndex < 0 ? 0 : state.selectedOutputIndex;
  if (to < 0 || to >= state.outputFrameIds.length) return setStatus('더 이동할 수 없습니다.');
  const [item] = state.outputFrameIds.splice(from, 1); state.outputFrameIds.splice(to, 0, item); state.selectedOutputIndex = to; renderOutput(); setStatus('출력 순서 이동');
}
function play() {
  if (state.isPlaying || !state.outputFrameIds.length) return;
  state.isPlaying = true; setStatus('재생 중');
  const tick = () => { if (!state.isPlaying) return; const index = state.playIndex % state.outputFrameIds.length; state.selectedOutputIndex = index; drawPreview(getFrame(state.outputFrameIds[index])); renderOutput(); state.playIndex++; state.timerId = setTimeout(tick, 1000 / Math.max(1, Math.min(60, readNumber(ui.fps, 8)))); };
  tick();
}
function exportPng() {
  if (!state.outputFrameIds.length) return setStatus('내보낼 프레임이 없습니다.');
  const first = getSourceRect(getFrame(state.outputFrameIds[0]));
  const cols = Math.max(1, Math.min(state.outputFrameIds.length, readNumber(ui.exportCols, readNumber(ui.cols, 6))));
  const rows = Math.ceil(state.outputFrameIds.length / cols);
  const s = settings(); const padX = ui.keepSpacing?.checked ? s.ox : 0, padY = ui.keepSpacing?.checked ? s.oy : 0, gapX = ui.keepSpacing?.checked ? s.gx : 0, gapY = ui.keepSpacing?.checked ? s.gy : 0;
  const cellW = Math.max(...state.outputFrameIds.map((id) => getSourceRect(getFrame(id)).w));
  const cellH = Math.max(...state.outputFrameIds.map((id) => getSourceRect(getFrame(id)).h));
  const canvas = document.createElement('canvas'); canvas.width = padX * 2 + cellW * cols + gapX * Math.max(0, cols - 1); canvas.height = padY * 2 + cellH * rows + gapY * Math.max(0, rows - 1);
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (!ui.transparentBg?.checked) { ctx.fillStyle = ui.exportBg?.value || '#d9d9d9'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  state.outputFrameIds.forEach((id, i) => { const frame = getFrame(id), rect = getSourceRect(frame); const x = padX + (i % cols) * (cellW + gapX), y = padY + Math.floor(i / cols) * (cellH + gapY); ctx.drawImage(state.image, rect.sx, rect.sy, rect.w, rect.h, x, y, rect.w, rect.h); });
  const link = document.createElement('a'); link.download = `sprite-sheet-${cols}x${rows}-${canvas.width}x${canvas.height}.png`; link.href = canvas.toDataURL('image/png'); document.body.append(link); link.click(); link.remove(); setStatus(`PNG 내보내기 완료: ${canvas.width}x${canvas.height}`);
}
function reset() { stop(); state.frames = []; state.frameShifts.clear(); state.frameSizes.clear(); state.selectedFrameIds.clear(); state.outputFrameIds = []; state.selectedOutputIndex = -1; renderFrames(); renderOutput(); drawPreview(null); drawSource(); updateInfoDisplays(); setStatus('초기화 완료'); }
function bind() {
  ui.file.addEventListener('change', (event) => loadImage(event.target.files[0]));
  ui.zoom.addEventListener('input', drawSource);
  ui.showPreviewFrame?.addEventListener('change', () => drawPreview(state.lastPreviewFrame)); ui.showPreviewCenter?.addEventListener('change', () => drawPreview(state.lastPreviewFrame));
  [ui.fw, ui.fh, ui.cols, ui.rows, ui.ox, ui.oy, ui.gx, ui.gy].forEach((input) => input.addEventListener('input', () => sliceFrames({ keepAdjustments: true })));
  document.addEventListener('click', (event) => {
    const id = event.target.id; const step = Math.max(1, readNumber(ui.nudgeStep, 1)); const boxStep = Math.max(1, readNumber(ui.boxStep, 1));
    if (id === 'testButton') setStatus('버튼 동작 정상');
    if (id === 'autoDetectButton') autoDetect(); if (id === 'fitWholeButton') fitWholeSheet(); if (id === 'sliceButton') sliceFrames({ keepAdjustments: false }); if (id === 'resetButton') reset();
    if (id === 'selectAllButton') selectAllOutput(); if (id === 'clearSelectionButton') clearSelection();
    if (id === 'nudgeUpButton') nudgeSelectedFrames(0, -step); if (id === 'nudgeDownButton') nudgeSelectedFrames(0, step); if (id === 'nudgeLeftButton') nudgeSelectedFrames(-step, 0); if (id === 'nudgeRightButton') nudgeSelectedFrames(step, 0); if (id === 'nudgeResetButton') resetSelectedFrameShifts();
    if (id === 'boxWMinusButton') resizeSelectedBoxes(-boxStep, 0); if (id === 'boxWPlusButton') resizeSelectedBoxes(boxStep, 0); if (id === 'boxHMinusButton') resizeSelectedBoxes(0, -boxStep); if (id === 'boxHPlusButton') resizeSelectedBoxes(0, boxStep); if (id === 'boxResetButton') resetSelectedBoxSizes();
    if (id === 'centerXButton') alignSelectedFrames(true, false); if (id === 'centerYButton') alignSelectedFrames(false, true); if (id === 'centerBothButton') alignSelectedFrames(true, true);
    if (id === 'playButton') play(); if (id === 'stopButton') { stop(); setStatus('재생 정지'); }
    if (id === 'moveOutputLeftButton') moveOutput(state.selectedOutputIndex, state.selectedOutputIndex - 1); if (id === 'moveOutputRightButton') moveOutput(state.selectedOutputIndex, state.selectedOutputIndex + 1);
    if (id === 'removeSelectedOutputButton') { const remove = new Set(getActiveFrameIds()); state.outputFrameIds = state.outputFrameIds.filter((frameId) => !remove.has(frameId)); state.selectedFrameIds.clear(); state.selectedOutputIndex = -1; renderOutput(); updateInfoDisplays(); setStatus('선택 프레임 제거'); }
    if (id === 'exportButton') exportPng();
  });
  ui.source.addEventListener('click', (event) => { if (!state.frames.length) return; const rect = ui.source.getBoundingClientRect(); const zoom = Math.max(1, readNumber(ui.zoom, 2)); const cssScaleX = ui.source.width / rect.width; const cssScaleY = ui.source.height / rect.height; const x = ((event.clientX - rect.left) * cssScaleX) / zoom; const y = ((event.clientY - rect.top) * cssScaleY) / zoom; const frame = state.frames.find((item) => { const r = getSourceRect(item); return x >= r.sx && x < r.sx + r.w && y >= r.sy && y < r.sy + r.h; }); if (frame) selectFrameId(frame.id, event.shiftKey || event.ctrlKey || event.metaKey); });
}
bind(); updateInfoDisplays(); setStatus('JS 연결 완료. 출력 순서에서 전체 선택/다중 선택/프레임 박스 크기 보정 가능.');

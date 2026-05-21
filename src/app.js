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
};

const sourceCtx = ui.source.getContext('2d', { willReadFrequently: true });
const previewCtx = ui.preview.getContext('2d');

const state = {
  image: null,
  imageUrl: '',
  frames: [],
  selectedFrameIds: new Set(),
  outputFrameIds: [],
  selectedOutputIndex: -1,
  timerId: 0,
  isPlaying: false,
  playIndex: 0,
  dragIndex: -1,
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

function pickFrameSize(total) {
  const sizes = [16, 24, 32, 48, 64, 96, 128, 256];
  const good = sizes.find((size) => total % size === 0 && total / size >= 2 && total / size <= 16);
  if (good) return good;
  for (let i = sizes.length - 1; i >= 0; i -= 1) {
    if (total % sizes[i] === 0) return sizes[i];
  }
  return Math.min(total, 32);
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
    fitWholeSheet();
    sliceFrames();
    setStatus(`로드 완료: ${file.name} / ${image.naturalWidth}x${image.naturalHeight}`);
  };
  image.onerror = () => setStatus('이미지를 불러오지 못했습니다.');
  image.src = url;
}

function fitWholeSheet() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  const fw = pickFrameSize(state.image.naturalWidth);
  const fh = pickFrameSize(state.image.naturalHeight);
  ui.ox.value = 0;
  ui.oy.value = 0;
  ui.gx.value = 0;
  ui.gy.value = 0;
  ui.fw.value = fw;
  ui.fh.value = fh;
  ui.cols.value = Math.max(1, Math.floor(state.image.naturalWidth / fw));
  ui.rows.value = Math.max(1, Math.floor(state.image.naturalHeight / fh));
  drawSource();
  setStatus(`전체 균등 분할값 적용: ${ui.cols.value}열 x ${ui.rows.value}행`);
}

function detectContentBounds() {
  const canvas = document.createElement('canvas');
  canvas.width = state.image.naturalWidth;
  canvas.height = state.image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(state.image, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const corner = [data[0], data[1], data[2], data[3]];
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      const diff = Math.abs(data[i] - corner[0]) > 12 || Math.abs(data[i + 1] - corner[1]) > 12 || Math.abs(data[i + 2] - corner[2]) > 12 || Math.abs(alpha - corner[3]) > 12;
      if (alpha > 8 && (corner[3] < 8 || diff)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX) return { x: 0, y: 0, w: canvas.width, h: canvas.height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function autoDetect() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  const bounds = detectContentBounds();
  const fw = pickFrameSize(bounds.w);
  const fh = pickFrameSize(bounds.h);
  ui.ox.value = bounds.x;
  ui.oy.value = bounds.y;
  ui.gx.value = 0;
  ui.gy.value = 0;
  ui.fw.value = fw;
  ui.fh.value = fh;
  ui.cols.value = Math.max(1, Math.floor(bounds.w / fw));
  ui.rows.value = Math.max(1, Math.floor(bounds.h / fh));
  sliceFrames();
  setStatus(`자동 추정 완료: ${ui.cols.value}열 x ${ui.rows.value}행 / ${fw}x${fh}px`);
}

function sliceFrames() {
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
  state.outputFrameIds = [];
  state.selectedOutputIndex = -1;
  state.playIndex = 0;
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(frames[0] || null);
  setStatus(`${frames.length}개 프레임으로 분할했습니다.`);
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
    sourceCtx.strokeStyle = '#60a5fa';
    sourceCtx.strokeRect(frame.sx * zoom + 0.5, frame.sy * zoom + 0.5, frame.w * zoom, frame.h * zoom);
    if (state.selectedFrameIds.has(frame.id)) {
      sourceCtx.fillStyle = 'rgba(96,165,250,.25)';
      sourceCtx.fillRect(frame.sx * zoom, frame.sy * zoom, frame.w * zoom, frame.h * zoom);
    }
    sourceCtx.fillStyle = 'rgba(0,0,0,.7)';
    sourceCtx.fillRect(frame.sx * zoom + 2, frame.sy * zoom + 2, 28, 16);
    sourceCtx.fillStyle = '#fff';
    sourceCtx.fillText(String(frame.id), frame.sx * zoom + 6, frame.sy * zoom + 14);
  }
}

function drawPreview(frame) {
  if (!state.image || !frame) {
    previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
    return;
  }
  const scale = Math.max(1, Math.min(8, Math.floor(128 / Math.max(frame.w, frame.h))));
  ui.preview.width = frame.w * scale;
  ui.preview.height = frame.h * scale;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, ui.preview.width, ui.preview.height);
  previewCtx.drawImage(state.image, frame.sx, frame.sy, frame.w, frame.h, 0, 0, ui.preview.width, ui.preview.height);
}

function createCard(frame, label) {
  const card = document.createElement('div');
  card.className = 'frame-card';
  const canvas = document.createElement('canvas');
  canvas.width = frame.w;
  canvas.height = frame.h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.image, frame.sx, frame.sy, frame.w, frame.h, 0, 0, frame.w, frame.h);
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
  setStatus(`프레임 ${frame.id} 선택`);
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
  for (const id of frameIds) {
    if (getFrame(id)) state.outputFrameIds.push(id);
  }
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
    if (state.selectedOutputIndex === index) card.classList.add('selected');
    card.draggable = true;
    card.addEventListener('click', () => {
      state.selectedOutputIndex = index;
      drawPreview(frame);
      renderOutput();
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
    drawPreview(getFrame(state.outputFrameIds[index]));
    renderOutput();
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
  const cols = Math.max(1, Math.min(state.outputFrameIds.length, readNumber(ui.exportCols, 6)));
  const rows = Math.ceil(state.outputFrameIds.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = first.w * cols;
  canvas.height = first.h * rows;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  state.outputFrameIds.forEach((id, index) => {
    const frame = getFrame(id);
    if (!frame) return;
    ctx.drawImage(state.image, frame.sx, frame.sy, frame.w, frame.h, (index % cols) * first.w, Math.floor(index / cols) * first.h, first.w, first.h);
  });
  const link = document.createElement('a');
  link.download = `sprite-sheet-${cols}x${rows}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.append(link);
  link.click();
  link.remove();
  setStatus(`PNG 내보내기 완료: ${canvas.width}x${canvas.height}`);
}

function reset() {
  stop();
  state.frames = [];
  state.selectedFrameIds.clear();
  state.outputFrameIds = [];
  state.selectedOutputIndex = -1;
  state.playIndex = 0;
  renderFrames();
  renderOutput();
  drawSource();
  drawPreview(null);
  setStatus('초기화 완료');
}

function bind() {
  ui.file.addEventListener('change', (event) => loadImage(event.target.files[0]));
  ui.zoom.addEventListener('input', drawSource);
  [ui.fw, ui.fh, ui.cols, ui.rows, ui.ox, ui.oy, ui.gx, ui.gy].forEach((input) => input.addEventListener('input', drawSource));

  document.addEventListener('click', (event) => {
    const id = event.target.id;
    if (id === 'testButton') setStatus('버튼 동작 정상입니다.');
    if (id === 'autoDetectButton') autoDetect();
    if (id === 'fitWholeButton') { fitWholeSheet(); sliceFrames(); }
    if (id === 'sliceButton') sliceFrames();
    if (id === 'resetButton') reset();
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
      setStatus('선택 출력 프레임 제거');
    }
    if (id === 'clearOutputButton') {
      state.outputFrameIds = [];
      state.selectedOutputIndex = -1;
      renderOutput();
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
    const frame = state.frames.find((item) => x >= item.sx && x < item.sx + item.w && y >= item.sy && y < item.sy + item.h);
    if (frame) toggleFrame(frame, event.shiftKey);
  });
}

bind();
setStatus('JS 연결 완료. 자동 추정/재생/앞뒤 버튼 사용 가능.');

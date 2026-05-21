const dom = {
  fileInput: document.getElementById('fileInput'),
  frameWidthInput: document.getElementById('frameWidthInput'),
  frameHeightInput: document.getElementById('frameHeightInput'),
  sourceColsInput: document.getElementById('sourceColsInput'),
  sourceRowsInput: document.getElementById('sourceRowsInput'),
  offsetXInput: document.getElementById('offsetXInput'),
  offsetYInput: document.getElementById('offsetYInput'),
  gapXInput: document.getElementById('gapXInput'),
  gapYInput: document.getElementById('gapYInput'),
  zoomInput: document.getElementById('zoomInput'),
  autoDetectButton: document.getElementById('autoDetectButton'),
  fitWholeButton: document.getElementById('fitWholeButton'),
  sliceButton: document.getElementById('sliceButton'),
  resetButton: document.getElementById('resetButton'),
  sourceCanvas: document.getElementById('sourceCanvas'),
  previewCanvas: document.getElementById('previewCanvas'),
  frameList: document.getElementById('frameList'),
  outputList: document.getElementById('outputList'),
  playButton: document.getElementById('playButton'),
  stopButton: document.getElementById('stopButton'),
  addSelectedButton: document.getElementById('addSelectedButton'),
  addAllButton: document.getElementById('addAllButton'),
  moveOutputLeftButton: document.getElementById('moveOutputLeftButton'),
  moveOutputRightButton: document.getElementById('moveOutputRightButton'),
  removeSelectedOutputButton: document.getElementById('removeSelectedOutputButton'),
  clearOutputButton: document.getElementById('clearOutputButton'),
  exportButton: document.getElementById('exportButton'),
  fpsInput: document.getElementById('fpsInput'),
  exportColsInput: document.getElementById('exportColsInput'),
  statusText: document.getElementById('statusText'),
};

const sourceCtx = dom.sourceCanvas.getContext('2d', { willReadFrequently: true });
const previewCtx = dom.previewCanvas.getContext('2d');

const state = {
  image: null,
  imageObjectUrl: '',
  frames: [],
  selectedFrameIds: new Set(),
  outputFrameIds: [],
  selectedOutputIndex: -1,
  playing: false,
  playTimerId: 0,
  playIndex: 0,
  dragOutputIndex: -1,
};

function readNumber(input, fallback = 0) {
  const value = Number.parseInt(input.value, 10);
  return Number.isFinite(value) ? value : fallback;
}

function setStatus(message) {
  dom.statusText.textContent = message;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSettings() {
  return {
    frameWidth: Math.max(1, readNumber(dom.frameWidthInput, 32)),
    frameHeight: Math.max(1, readNumber(dom.frameHeightInput, 32)),
    cols: Math.max(1, readNumber(dom.sourceColsInput, 1)),
    rows: Math.max(1, readNumber(dom.sourceRowsInput, 1)),
    offsetX: Math.max(0, readNumber(dom.offsetXInput, 0)),
    offsetY: Math.max(0, readNumber(dom.offsetYInput, 0)),
    gapX: Math.max(0, readNumber(dom.gapXInput, 0)),
    gapY: Math.max(0, readNumber(dom.gapYInput, 0)),
  };
}

function loadImage(file) {
  if (!file) return;

  stopPlayback();
  if (state.imageObjectUrl) URL.revokeObjectURL(state.imageObjectUrl);

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.imageObjectUrl = url;
    fitWholeSheet();
    sliceFrames();
    setStatus(`${file.name} 로드 완료: ${image.naturalWidth}x${image.naturalHeight}`);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('이미지를 불러오지 못했습니다. PNG, WEBP, JPG 파일을 사용하세요.');
  };
  image.src = url;
}

function fitWholeSheet() {
  if (!state.image) return;

  const width = state.image.naturalWidth;
  const height = state.image.naturalHeight;
  const guessed = guessFrameSize(width, height);

  dom.offsetXInput.value = 0;
  dom.offsetYInput.value = 0;
  dom.gapXInput.value = 0;
  dom.gapYInput.value = 0;
  dom.frameWidthInput.value = guessed.width;
  dom.frameHeightInput.value = guessed.height;
  dom.sourceColsInput.value = Math.max(1, Math.floor(width / guessed.width));
  dom.sourceRowsInput.value = Math.max(1, Math.floor(height / guessed.height));

  drawSourceOverlay();
  setStatus(`전체 균등 분할값 적용: ${dom.sourceColsInput.value}열 x ${dom.sourceRowsInput.value}행`);
}

function autoDetectGrid() {
  if (!state.image) return;

  const bounds = detectContentBounds(state.image);
  const width = bounds.width > 0 ? bounds.width : state.image.naturalWidth;
  const height = bounds.height > 0 ? bounds.height : state.image.naturalHeight;
  const guessed = guessFrameSize(width, height);

  dom.offsetXInput.value = bounds.x;
  dom.offsetYInput.value = bounds.y;
  dom.gapXInput.value = 0;
  dom.gapYInput.value = 0;
  dom.frameWidthInput.value = guessed.width;
  dom.frameHeightInput.value = guessed.height;
  dom.sourceColsInput.value = Math.max(1, Math.floor(width / guessed.width));
  dom.sourceRowsInput.value = Math.max(1, Math.floor(height / guessed.height));

  sliceFrames();
  setStatus(`여백 기준 자동 추정: ${dom.sourceColsInput.value}열 x ${dom.sourceRowsInput.value}행, ${guessed.width}x${guessed.height}px`);
}

function detectContentBounds(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const corner = [data[0], data[1], data[2], data[3]];
  const threshold = 10;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      const isTransparentContent = alpha > 8 && corner[3] <= 8;
      const isDifferentFromCorner =
        Math.abs(data[i] - corner[0]) > threshold ||
        Math.abs(data[i + 1] - corner[1]) > threshold ||
        Math.abs(data[i + 2] - corner[2]) > threshold ||
        Math.abs(alpha - corner[3]) > threshold;

      if (isTransparentContent || (alpha > 8 && isDifferentFromCorner)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height };
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function guessFrameSize(width, height) {
  const commonSizes = [16, 24, 32, 48, 64, 96, 128, 256];
  const widthCandidates = commonSizes.filter((size) => width % size === 0);
  const heightCandidates = commonSizes.filter((size) => height % size === 0);
  const bestWidth = pickBestSize(widthCandidates, width);
  const bestHeight = pickBestSize(heightCandidates, height);
  return { width: bestWidth, height: bestHeight };
}

function pickBestSize(candidates, total) {
  if (candidates.length === 0) return Math.min(total, 32);
  const playable = candidates.filter((size) => total / size >= 2 && total / size <= 12);
  if (playable.length > 0) return playable[0];
  return candidates[candidates.length - 1];
}

function sliceFrames() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  stopPlayback();
  const s = getSettings();
  const frames = [];
  let id = 0;

  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) {
      const sx = s.offsetX + col * (s.frameWidth + s.gapX);
      const sy = s.offsetY + row * (s.frameHeight + s.gapY);
      if (sx + s.frameWidth <= state.image.naturalWidth && sy + s.frameHeight <= state.image.naturalHeight) {
        frames.push({ id, col, row, sx, sy, width: s.frameWidth, height: s.frameHeight });
        id += 1;
      }
    }
  }

  state.frames = frames;
  state.selectedFrameIds.clear();
  state.outputFrameIds = [];
  state.selectedOutputIndex = -1;
  state.playIndex = 0;

  renderFrameList();
  renderOutputList();
  drawSourceOverlay();
  drawPreview(frames[0] || null);
  setStatus(`${frames.length}개 프레임으로 분할했습니다.`);
}

function drawSourceOverlay() {
  if (!state.image) {
    sourceCtx.clearRect(0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);
    return;
  }

  const zoom = Math.max(1, readNumber(dom.zoomInput, 2));
  dom.sourceCanvas.width = state.image.naturalWidth * zoom;
  dom.sourceCanvas.height = state.image.naturalHeight * zoom;
  sourceCtx.imageSmoothingEnabled = false;
  sourceCtx.clearRect(0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);
  sourceCtx.drawImage(state.image, 0, 0, dom.sourceCanvas.width, dom.sourceCanvas.height);

  sourceCtx.lineWidth = 1;
  sourceCtx.strokeStyle = 'rgba(110, 168, 254, 0.95)';
  sourceCtx.font = `${Math.max(10, 10 * zoom)}px sans-serif`;

  const frames = state.frames.length > 0 ? state.frames : buildPreviewFrames();
  for (const frame of frames) {
    sourceCtx.strokeStyle = 'rgba(110, 168, 254, 0.95)';
    sourceCtx.strokeRect(frame.sx * zoom + 0.5, frame.sy * zoom + 0.5, frame.width * zoom, frame.height * zoom);

    if (state.selectedFrameIds.has(frame.id)) {
      sourceCtx.fillStyle = 'rgba(110, 168, 254, 0.20)';
      sourceCtx.fillRect(frame.sx * zoom, frame.sy * zoom, frame.width * zoom, frame.height * zoom);
    }

    sourceCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    sourceCtx.fillRect(frame.sx * zoom + 2, frame.sy * zoom + 2, 28, 16);
    sourceCtx.fillStyle = '#ffffff';
    sourceCtx.fillText(String(frame.id), frame.sx * zoom + 6, frame.sy * zoom + 14);
  }
}

function buildPreviewFrames() {
  if (!state.image) return [];
  const s = getSettings();
  const frames = [];
  let id = 0;

  for (let row = 0; row < s.rows; row += 1) {
    for (let col = 0; col < s.cols; col += 1) {
      const sx = s.offsetX + col * (s.frameWidth + s.gapX);
      const sy = s.offsetY + row * (s.frameHeight + s.gapY);
      if (sx + s.frameWidth <= state.image.naturalWidth && sy + s.frameHeight <= state.image.naturalHeight) {
        frames.push({ id, sx, sy, width: s.frameWidth, height: s.frameHeight });
        id += 1;
      }
    }
  }
  return frames;
}

function handleSourceCanvasClick(event) {
  if (!state.frames.length) return;

  const rect = dom.sourceCanvas.getBoundingClientRect();
  const zoom = Math.max(1, readNumber(dom.zoomInput, 2));
  const x = (event.clientX - rect.left) / zoom;
  const y = (event.clientY - rect.top) / zoom;
  const frame = state.frames.find((item) => x >= item.sx && x < item.sx + item.width && y >= item.sy && y < item.sy + item.height);
  if (!frame) return;

  if (event.shiftKey) {
    if (state.selectedFrameIds.has(frame.id)) state.selectedFrameIds.delete(frame.id);
    else state.selectedFrameIds.add(frame.id);
  } else {
    state.selectedFrameIds.clear();
    state.selectedFrameIds.add(frame.id);
  }

  drawPreview(frame);
  renderFrameList();
  drawSourceOverlay();
}

function renderFrameList() {
  dom.frameList.textContent = '';
  for (const frame of state.frames) {
    const card = createFrameCard(frame, 'frame-card');
    card.classList.toggle('selected', state.selectedFrameIds.has(frame.id));
    card.addEventListener('click', (event) => selectSourceFrame(frame, event.shiftKey));
    card.addEventListener('dblclick', () => addFramesToOutput([frame.id]));
    dom.frameList.appendChild(card);
  }
}

function selectSourceFrame(frame, multi) {
  if (multi) {
    if (state.selectedFrameIds.has(frame.id)) state.selectedFrameIds.delete(frame.id);
    else state.selectedFrameIds.add(frame.id);
  } else {
    state.selectedFrameIds.clear();
    state.selectedFrameIds.add(frame.id);
  }
  drawPreview(frame);
  renderFrameList();
  drawSourceOverlay();
}

function renderOutputList() {
  dom.outputList.textContent = '';
  state.outputFrameIds.forEach((frameId, index) => {
    const frame = getFrameById(frameId);
    if (!frame) return;

    const card = createFrameCard(frame, 'output-card', index + 1);
    card.draggable = true;
    card.classList.toggle('selected', state.selectedOutputIndex === index);
    card.addEventListener('click', () => selectOutputFrame(index));
    card.addEventListener('dragstart', () => { state.dragOutputIndex = index; });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      card.classList.add('drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drop-target');
      moveOutputFrame(state.dragOutputIndex, index);
    });
    dom.outputList.appendChild(card);
  });
}

function selectOutputFrame(index) {
  state.selectedOutputIndex = index;
  drawPreview(getFrameById(state.outputFrameIds[index]));
  renderOutputList();
}

function createFrameCard(frame, className, indexLabel = frame.id) {
  const card = document.createElement('div');
  card.className = className;

  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, frame.sx, frame.sy, frame.width, frame.height, 0, 0, frame.width, frame.height);

  const index = document.createElement('span');
  index.className = 'frame-index';
  index.textContent = String(indexLabel);

  card.append(canvas, index);
  return card;
}

function getFrameById(id) {
  return state.frames.find((frame) => frame.id === id);
}

function drawPreview(frame) {
  if (!state.image || !frame) {
    previewCtx.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
    return;
  }

  const scale = clamp(Math.floor(128 / Math.max(frame.width, frame.height)), 1, 8);
  dom.previewCanvas.width = frame.width * scale;
  dom.previewCanvas.height = frame.height * scale;
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
  previewCtx.drawImage(state.image, frame.sx, frame.sy, frame.width, frame.height, 0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
}

function addFramesToOutput(frameIds) {
  const validIds = frameIds.filter((id) => getFrameById(id));
  state.outputFrameIds.push(...validIds);
  if (state.selectedOutputIndex < 0 && state.outputFrameIds.length > 0) state.selectedOutputIndex = 0;
  renderOutputList();
  setStatus(`${validIds.length}개 프레임을 출력 순서에 추가했습니다.`);
}

function moveOutputFrame(fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= state.outputFrameIds.length || toIndex >= state.outputFrameIds.length || fromIndex === toIndex) return;
  const item = state.outputFrameIds.splice(fromIndex, 1)[0];
  state.outputFrameIds.splice(toIndex, 0, item);
  state.selectedOutputIndex = toIndex;
  renderOutputList();
}

function moveSelectedOutput(delta) {
  const from = state.selectedOutputIndex;
  const to = from + delta;
  moveOutputFrame(from, to);
}

function startPlayback() {
  if (state.playing) return;
  if (state.outputFrameIds.length === 0) {
    setStatus('출력 순서에 프레임을 먼저 추가하세요.');
    return;
  }

  state.playing = true;
  const tick = () => {
    if (!state.playing) return;
    const outputIndex = state.playIndex % state.outputFrameIds.length;
    const frame = getFrameById(state.outputFrameIds[outputIndex]);
    drawPreview(frame);
    state.selectedOutputIndex = outputIndex;
    renderOutputList();
    state.playIndex += 1;
    const fps = clamp(readNumber(dom.fpsInput, 8), 1, 60);
    state.playTimerId = window.setTimeout(tick, 1000 / fps);
  };
  tick();
}

function stopPlayback() {
  state.playing = false;
  window.clearTimeout(state.playTimerId);
}

function removeSelectedOutput() {
  if (state.selectedOutputIndex < 0) return;
  state.outputFrameIds.splice(state.selectedOutputIndex, 1);
  state.selectedOutputIndex = Math.min(state.selectedOutputIndex, state.outputFrameIds.length - 1);
  renderOutputList();
}

function exportSpriteSheet() {
  if (!state.image || state.outputFrameIds.length === 0) {
    setStatus('내보낼 프레임이 없습니다.');
    return;
  }

  const firstFrame = getFrameById(state.outputFrameIds[0]);
  if (!firstFrame) return;

  const cols = clamp(readNumber(dom.exportColsInput, 6), 1, state.outputFrameIds.length);
  const rows = Math.ceil(state.outputFrameIds.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = firstFrame.width * cols;
  canvas.height = firstFrame.height * rows;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  state.outputFrameIds.forEach((frameId, index) => {
    const frame = getFrameById(frameId);
    if (!frame) return;
    const x = (index % cols) * firstFrame.width;
    const y = Math.floor(index / cols) * firstFrame.height;
    ctx.drawImage(state.image, frame.sx, frame.sy, frame.width, frame.height, x, y, firstFrame.width, firstFrame.height);
  });

  const link = document.createElement('a');
  link.download = `sprite-sheet-${cols}x${rows}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  link.remove();
  setStatus(`PNG 내보내기 완료: ${canvas.width}x${canvas.height}`);
}

function resetEditor() {
  stopPlayback();
  state.frames = [];
  state.selectedFrameIds.clear();
  state.outputFrameIds = [];
  state.selectedOutputIndex = -1;
  state.playIndex = 0;
  renderFrameList();
  renderOutputList();
  drawSourceOverlay();
  drawPreview(null);
  setStatus('편집 상태를 초기화했습니다.');
}

function bindEvents() {
  dom.fileInput.addEventListener('change', (event) => loadImage(event.target.files[0]));
  dom.autoDetectButton.addEventListener('click', autoDetectGrid);
  dom.fitWholeButton.addEventListener('click', () => { fitWholeSheet(); sliceFrames(); });
  dom.sliceButton.addEventListener('click', sliceFrames);
  dom.resetButton.addEventListener('click', resetEditor);
  dom.zoomInput.addEventListener('input', drawSourceOverlay);
  dom.sourceCanvas.addEventListener('click', handleSourceCanvasClick);

  [dom.frameWidthInput, dom.frameHeightInput, dom.sourceColsInput, dom.sourceRowsInput, dom.offsetXInput, dom.offsetYInput, dom.gapXInput, dom.gapYInput]
    .forEach((input) => input.addEventListener('input', drawSourceOverlay));

  dom.addSelectedButton.addEventListener('click', () => addFramesToOutput(Array.from(state.selectedFrameIds)));
  dom.addAllButton.addEventListener('click', () => addFramesToOutput(state.frames.map((frame) => frame.id)));
  dom.moveOutputLeftButton.addEventListener('click', () => moveSelectedOutput(-1));
  dom.moveOutputRightButton.addEventListener('click', () => moveSelectedOutput(1));
  dom.removeSelectedOutputButton.addEventListener('click', removeSelectedOutput);
  dom.clearOutputButton.addEventListener('click', () => {
    state.outputFrameIds = [];
    state.selectedOutputIndex = -1;
    renderOutputList();
  });
  dom.playButton.addEventListener('click', startPlayback);
  dom.stopButton.addEventListener('click', stopPlayback);
  dom.exportButton.addEventListener('click', exportSpriteSheet);
}

bindEvents();
setStatus('이미지를 업로드하면 전체 균등 분할 기준으로 시작합니다.');

const dom = {
  fileInput: document.getElementById('fileInput'),
  frameWidthInput: document.getElementById('frameWidthInput'),
  frameHeightInput: document.getElementById('frameHeightInput'),
  sourceColsInput: document.getElementById('sourceColsInput'),
  sourceRowsInput: document.getElementById('sourceRowsInput'),
  offsetXInput: document.getElementById('offsetXInput'),
  offsetYInput: document.getElementById('offsetYInput'),
  gapXInput: document.getElementById('gapXInput'),
  zoomInput: document.getElementById('zoomInput'),
  autoDetectButton: document.getElementById('autoDetectButton'),
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
  imageBitmapUrl: '',
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
  const frameWidth = Math.max(1, readNumber(dom.frameWidthInput, 32));
  const frameHeight = Math.max(1, readNumber(dom.frameHeightInput, 32));
  const offsetX = Math.max(0, readNumber(dom.offsetXInput, 0));
  const offsetY = Math.max(0, readNumber(dom.offsetYInput, 0));
  const gapX = Math.max(0, readNumber(dom.gapXInput, 0));
  const gapY = Math.max(0, readNumber(dom.gapYInput, 0));
  const cols = Math.max(1, readNumber(dom.sourceColsInput, 1));
  const rows = Math.max(1, readNumber(dom.sourceRowsInput, 1));

  return { frameWidth, frameHeight, offsetX, offsetY, gapX, gapY, cols, rows };
}

async function loadImage(file) {
  if (!file) return;

  if (state.imageBitmapUrl) {
    URL.revokeObjectURL(state.imageBitmapUrl);
    state.imageBitmapUrl = '';
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.onload = () => {
    state.image = image;
    state.imageBitmapUrl = url;
    autoDetectGrid();
    sliceFrames();
    setStatus(`${file.name} 로드 완료: ${image.naturalWidth}x${image.naturalHeight}`);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('이미지를 불러오지 못했습니다. PNG, WEBP, JPG 파일을 사용하세요.');
  };
  image.src = url;
}

function autoDetectGrid() {
  if (!state.image) return;

  const bounds = detectContentBounds(state.image);
  const usableWidth = bounds.width || state.image.naturalWidth;
  const usableHeight = bounds.height || state.image.naturalHeight;
  const guessedSize = guessFrameSize(usableWidth, usableHeight);

  dom.offsetXInput.value = bounds.x;
  dom.offsetYInput.value = bounds.y;
  dom.frameWidthInput.value = guessedSize.width;
  dom.frameHeightInput.value = guessedSize.height;
  dom.sourceColsInput.value = Math.max(1, Math.floor(usableWidth / guessedSize.width));
  dom.sourceRowsInput.value = Math.max(1, Math.floor(usableHeight / guessedSize.height));
  dom.gapXInput.value = 0;
  dom.gapYInput.value = 0;

  drawSourceOverlay();
  setStatus(`자동 추정: ${dom.sourceColsInput.value}열 x ${dom.sourceRowsInput.value}행, ${guessedSize.width}x${guessedSize.height}px`);
}

function detectContentBounds(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const topLeft = [data[0], data[1], data[2], data[3]];
  const threshold = 8;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4;
      const alpha = data[index + 3];
      const differsFromCorner =
        Math.abs(data[index] - topLeft[0]) > threshold ||
        Math.abs(data[index + 1] - topLeft[1]) > threshold ||
        Math.abs(data[index + 2] - topLeft[2]) > threshold ||
        Math.abs(alpha - topLeft[3]) > threshold;

      if (alpha > 12 && differsFromCorner) {
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

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function guessFrameSize(width, height) {
  const commonSizes = [16, 24, 32, 48, 64, 96, 128, 256];
  const widthCandidates = commonSizes.filter((size) => width % size === 0);
  const heightCandidates = commonSizes.filter((size) => height % size === 0);
  const bestWidth = widthCandidates.find((size) => width / size <= 12) || widthCandidates.at(-1) || width;
  const bestHeight = heightCandidates.find((size) => height / size <= 12) || heightCandidates.at(-1) || height;
  return { width: bestWidth, height: bestHeight };
}

function sliceFrames() {
  if (!state.image) {
    setStatus('먼저 이미지를 업로드하세요.');
    return;
  }

  const settings = getSettings();
  const frames = [];
  let id = 0;

  for (let row = 0; row < settings.rows; row += 1) {
    for (let col = 0; col < settings.cols; col += 1) {
      const sx = settings.offsetX + col * (settings.frameWidth + settings.gapX);
      const sy = settings.offsetY + row * (settings.frameHeight + settings.gapY);

      if (sx + settings.frameWidth <= state.image.naturalWidth && sy + settings.frameHeight <= state.image.naturalHeight) {
        frames.push({
          id,
          col,
          row,
          sx,
          sy,
          width: settings.frameWidth,
          height: settings.frameHeight,
        });
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
  drawPreview(frames[0]);
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
  sourceCtx.fillStyle = 'rgba(110, 168, 254, 0.16)';
  sourceCtx.font = `${Math.max(10, 10 * zoom)}px sans-serif`;

  for (const frame of state.frames.length ? state.frames : buildPreviewFrames()) {
    sourceCtx.strokeRect(frame.sx * zoom + 0.5, frame.sy * zoom + 0.5, frame.width * zoom, frame.height * zoom);
    if (state.selectedFrameIds.has(frame.id)) {
      sourceCtx.fillRect(frame.sx * zoom, frame.sy * zoom, frame.width * zoom, frame.height * zoom);
    }
    sourceCtx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    sourceCtx.fillRect(frame.sx * zoom + 2, frame.sy * zoom + 2, 26, 16);
    sourceCtx.fillStyle = '#ffffff';
    sourceCtx.fillText(String(frame.id), frame.sx * zoom + 6, frame.sy * zoom + 14);
    sourceCtx.fillStyle = 'rgba(110, 168, 254, 0.16)';
  }
}

function buildPreviewFrames() {
  if (!state.image) return [];
  const settings = getSettings();
  const frames = [];
  let id = 0;
  for (let row = 0; row < settings.rows; row += 1) {
    for (let col = 0; col < settings.cols; col += 1) {
      frames.push({
        id,
        sx: settings.offsetX + col * (settings.frameWidth + settings.gapX),
        sy: settings.offsetY + row * (settings.frameHeight + settings.gapY),
        width: settings.frameWidth,
        height: settings.frameHeight,
      });
      id += 1;
    }
  }
  return frames;
}

function renderFrameList() {
  dom.frameList.textContent = '';
  for (const frame of state.frames) {
    const card = createFrameCard(frame, 'frame-card');
    card.classList.toggle('selected', state.selectedFrameIds.has(frame.id));
    card.addEventListener('click', (event) => {
      if (event.shiftKey) {
        state.selectedFrameIds.has(frame.id) ? state.selectedFrameIds.delete(frame.id) : state.selectedFrameIds.add(frame.id);
      } else {
        state.selectedFrameIds.clear();
        state.selectedFrameIds.add(frame.id);
      }
      drawPreview(frame);
      renderFrameList();
      drawSourceOverlay();
    });
    card.addEventListener('dblclick', () => addFramesToOutput([frame.id]));
    dom.frameList.appendChild(card);
  }
}

function renderOutputList() {
  dom.outputList.textContent = '';
  state.outputFrameIds.forEach((frameId, index) => {
    const frame = getFrameById(frameId);
    if (!frame) return;

    const card = createFrameCard(frame, 'output-card', index + 1);
    card.draggable = true;
    card.classList.toggle('selected', state.selectedOutputIndex === index);
    card.addEventListener('click', () => {
      state.selectedOutputIndex = index;
      drawPreview(frame);
      renderOutputList();
    });
    card.addEventListener('dragstart', () => {
      state.dragOutputIndex = index;
    });
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
  previewCtx.drawImage(
    state.image,
    frame.sx,
    frame.sy,
    frame.width,
    frame.height,
    0,
    0,
    dom.previewCanvas.width,
    dom.previewCanvas.height,
  );
}

function addFramesToOutput(frameIds) {
  const validIds = frameIds.filter((id) => getFrameById(id));
  state.outputFrameIds.push(...validIds);
  renderOutputList();
  setStatus(`${validIds.length}개 프레임을 출력 순서에 추가했습니다.`);
}

function moveOutputFrame(fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
  const [item] = state.outputFrameIds.splice(fromIndex, 1);
  state.outputFrameIds.splice(toIndex, 0, item);
  state.selectedOutputIndex = toIndex;
  state.dragOutputIndex = -1;
  renderOutputList();
}

function startPlayback() {
  if (state.playing || state.outputFrameIds.length === 0) {
    if (state.outputFrameIds.length === 0) setStatus('출력 순서에 프레임을 먼저 추가하세요.');
    return;
  }

  state.playing = true;
  const tick = () => {
    if (!state.playing) return;
    const frameId = state.outputFrameIds[state.playIndex % state.outputFrameIds.length];
    const frame = getFrameById(frameId);
    drawPreview(frame);
    state.selectedOutputIndex = state.playIndex % state.outputFrameIds.length;
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
  state.selectedOutputIndex = -1;
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
  link.click();
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
  dom.sliceButton.addEventListener('click', sliceFrames);
  dom.resetButton.addEventListener('click', resetEditor);
  dom.zoomInput.addEventListener('input', drawSourceOverlay);

  [
    dom.frameWidthInput,
    dom.frameHeightInput,
    dom.sourceColsInput,
    dom.sourceRowsInput,
    dom.offsetXInput,
    dom.offsetYInput,
    dom.gapXInput,
    dom.gapYInput,
  ].forEach((input) => input.addEventListener('input', drawSourceOverlay));

  dom.addSelectedButton.addEventListener('click', () => addFramesToOutput([...state.selectedFrameIds]));
  dom.addAllButton.addEventListener('click', () => addFramesToOutput(state.frames.map((frame) => frame.id)));
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
setStatus('이미지를 업로드하면 자동으로 기본 프레임 분할을 추정합니다.');

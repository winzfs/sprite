const gridState = {
  sourceCols: 1,
};

function readPositiveIntById(id, fallback) {
  const element = document.getElementById(id);
  if (!element) return fallback;
  const value = Number.parseInt(element.value, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function applyFixedFrameGrids() {
  const frameList = document.getElementById('frameList');
  const outputList = document.getElementById('outputList');

  gridState.sourceCols = readPositiveIntById('sourceColsInput', gridState.sourceCols);

  if (frameList) {
    frameList.style.gridTemplateColumns = `repeat(${gridState.sourceCols}, minmax(0, 1fr))`;
    frameList.dataset.cols = String(gridState.sourceCols);
  }

  if (outputList) {
    outputList.style.gridTemplateColumns = `repeat(${gridState.sourceCols}, minmax(0, 1fr))`;
    outputList.dataset.cols = String(gridState.sourceCols);
  }
}

function loadScriptOnce(src, dataKey) {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[data-${dataKey}="true"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.dataset[dataKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = 'true';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.append(script);
  });
}

function loadBackgroundRemoverHelpers() {
  return Promise.resolve()
    .then(() => loadScriptOnce('src/background-remover-autopan.js?v=2', 'background-remover-autopan'))
    .then(() => loadScriptOnce('src/background-remover-restore-brush.js?v=1', 'background-remover-restore-brush'));
}

function loadMediaToolHelpers() {
  loadBackgroundRemoverHelpers()
    .then(() => loadScriptOnce('src/pixel-art-converter.js?v=1', 'pixel-art-converter'))
    .then(() => loadScriptOnce('src/pixel-art-unified-modes.js?v=2', 'pixel-art-unified-modes'))
    .then(() => loadScriptOnce('src/pixel-art-floating-controls.js?v=5', 'pixel-art-floating-controls'))
    .then(() => loadScriptOnce('src/sfx-maker.js?v=1', 'sfx-maker'));
}

function bindFixedFrameGrids() {
  const sourceColsInput = document.getElementById('sourceColsInput');
  const frameList = document.getElementById('frameList');
  const outputList = document.getElementById('outputList');

  sourceColsInput?.addEventListener('input', applyFixedFrameGrids);

  const observer = new MutationObserver(applyFixedFrameGrids);
  if (frameList) observer.observe(frameList, { childList: true });
  if (outputList) observer.observe(outputList, { childList: true });

  document.addEventListener('click', (event) => {
    const id = event.target?.id;
    if (
      id === 'autoDetectButton' ||
      id === 'fitWholeButton' ||
      id === 'sliceButton' ||
      id === 'addAllButton' ||
      id === 'addSelectedButton' ||
      id === 'clearOutputButton' ||
      id === 'removeSelectedOutputButton'
    ) {
      window.setTimeout(applyFixedFrameGrids, 0);
    }
  });

  applyFixedFrameGrids();
  loadMediaToolHelpers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFixedFrameGrids);
} else {
  bindFixedFrameGrids();
}
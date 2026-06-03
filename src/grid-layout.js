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
  if (document.querySelector(`script[data-${dataKey}="true"]`)) return;
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  script.dataset[dataKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = 'true';
  document.body.append(script);
}

function loadBackgroundRemoverHelpers() {
  loadScriptOnce('src/background-remover-autopan.js?v=2', 'background-remover-autopan');
  loadScriptOnce('src/background-remover-restore-brush.js?v=1', 'background-remover-restore-brush');
}

function loadMediaToolHelpers() {
  loadBackgroundRemoverHelpers();
  loadScriptOnce('src/pixel-art-converter.js?v=1', 'pixel-art-converter');
  loadScriptOnce('src/pixel-art-smart-detail.js?v=1', 'pixel-art-smart-detail');
  loadScriptOnce('src/pixel-art-ultra-detail.js?v=1', 'pixel-art-ultra-detail');
  loadScriptOnce('src/pixel-art-mode-priority.js?v=1', 'pixel-art-mode-priority');
  loadScriptOnce('src/pixel-art-floating-controls.js?v=1', 'pixel-art-floating-controls');
  loadScriptOnce('src/pixel-art-option-effects.js?v=1', 'pixel-art-option-effects');
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
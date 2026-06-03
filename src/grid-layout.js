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

function loadBackgroundRemoverAutoPan() {
  if (document.querySelector('script[data-background-remover-autopan="true"]')) return;
  const script = document.createElement('script');
  script.src = 'src/background-remover-autopan.js?v=1';
  script.defer = true;
  script.dataset.backgroundRemoverAutopan = 'true';
  document.body.append(script);
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
  loadBackgroundRemoverAutoPan();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFixedFrameGrids);
} else {
  bindFixedFrameGrids();
}
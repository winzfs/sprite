const gridState = {
  sourceCols: 1,
  exportCols: 6,
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
  gridState.exportCols = readPositiveIntById('exportColsInput', gridState.exportCols);

  if (frameList) {
    frameList.style.gridTemplateColumns = `repeat(${gridState.sourceCols}, minmax(0, 1fr))`;
    frameList.dataset.cols = String(gridState.sourceCols);
  }

  if (outputList) {
    outputList.style.gridTemplateColumns = `repeat(${gridState.exportCols}, minmax(0, 1fr))`;
    outputList.dataset.cols = String(gridState.exportCols);
  }
}

function bindFixedFrameGrids() {
  const sourceColsInput = document.getElementById('sourceColsInput');
  const exportColsInput = document.getElementById('exportColsInput');
  const frameList = document.getElementById('frameList');
  const outputList = document.getElementById('outputList');

  sourceColsInput?.addEventListener('input', applyFixedFrameGrids);
  exportColsInput?.addEventListener('input', applyFixedFrameGrids);

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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindFixedFrameGrids);
} else {
  bindFixedFrameGrids();
}

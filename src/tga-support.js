/* TGA upload bridge for the existing sprite editor.
 * Keeps the original PNG/JPG/WebP/GIF path untouched.
 */
(() => {
  const input = document.getElementById('fileInput');
  if (!input) return;

  input.setAttribute('accept', 'image/*,.tga,.TGA');

  function isTgaFile(file) {
    return !!file && (/\.tga$/i.test(file.name) || file.type === 'image/x-tga' || file.type === 'image/tga');
  }

  async function imageDataToBitmapLike(decoded) {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(decoded.imageData);
      if (bitmap.naturalWidth === undefined) bitmap.naturalWidth = bitmap.width;
      if (bitmap.naturalHeight === undefined) bitmap.naturalHeight = bitmap.height;
      return bitmap;
    }

    const canvas = document.createElement('canvas');
    canvas.width = decoded.width;
    canvas.height = decoded.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(decoded.imageData, 0, 0);
    canvas.naturalWidth = decoded.width;
    canvas.naturalHeight = decoded.height;
    return canvas;
  }

  async function loadTga(file) {
    if (typeof window.decodeTga !== 'function') {
      throw new Error('TGA 디코더가 로드되지 않았습니다.');
    }

    stop();
    if (state.imageUrl) {
      URL.revokeObjectURL(state.imageUrl);
      state.imageUrl = '';
    }

    setStatus('TGA 디코딩 중...');
    const buffer = await file.arrayBuffer();
    const decoded = window.decodeTga(buffer);
    const image = await imageDataToBitmapLike(decoded);

    state.image = image;
    state.frameShifts.clear();
    state.frameSizes.clear();
    state.frames = [];
    state.selectedFrameIds.clear();
    state.outputFrameIds = [];
    state.selectedOutputIndex = -1;

    autoDetect();
    setStatus(`TGA 로드 완료: ${file.name} / ${decoded.width}x${decoded.height}`);
  }

  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!isTgaFile(file)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    loadTga(file).catch((error) => {
      setStatus(`TGA 로드 실패: ${error.message}`);
    });
  }, true);
})();

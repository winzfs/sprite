(() => {
  const BUTTON_ID = 'exportGifButton';

  function getNumber(input, fallback) {
    const value = Number.parseInt(input?.value, 10);
    return Number.isFinite(value) ? value : fallback;
  }

  function getGifFps() {
    return Math.max(1, Math.min(60, getNumber(ui?.fps, 8)));
  }

  function getOutputFrames() {
    if (!state?.outputFrameIds?.length) return [];
    return state.outputFrameIds.map((id) => getFrame(id)).filter(Boolean);
  }

  function getGifCellSize(frames) {
    const rects = frames.map((frame) => getSourceRect(frame));
    return {
      width: Math.max(1, ...rects.map((rect) => rect.w)),
      height: Math.max(1, ...rects.map((rect) => rect.h)),
      rects,
    };
  }

  function createGifFrameContext(frame, cellWidth, cellHeight) {
    const canvas = document.createElement('canvas');
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cellWidth, cellHeight);
    drawFrameImage(ctx, frame, 0, 0, 1);
    return ctx;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportGif() {
    if (!window.GIF) return setStatus('GIF 인코더가 로드되지 않았습니다.');

    const frames = getOutputFrames();
    if (!frames.length) return setStatus('GIF로 내보낼 프레임이 없습니다.');

    const { width, height, rects } = getGifCellSize(frames);
    const fps = getGifFps();
    const delay = Math.max(20, Math.round(1000 / fps));
    const transparent = true;
    const firstRect = rects[0];

    const gif = new GIF({
      width,
      height,
      repeat: 0,
      quality: 1,
      transparent: true,
      dispose: 2,
    });

    setStatus(`GIF 생성 준비 중... 셀 ${width}x${height}, 첫 프레임 ${firstRect.w}x${firstRect.h}, ${frames.length}프레임 / ${fps}FPS`);

    frames.forEach((frame) => {
      const ctx = createGifFrameContext(frame, width, height);
      gif.addFrame(ctx, { delay, dispose: 2 });
    });

    gif.on('finished', (blob) => {
      downloadBlob(blob, `sprite-animation-${frames.length}f-${fps}fps-${width}x${height}.gif`);
      setStatus(`GIF 내보내기 완료: 셀 ${width}x${height}, ${frames.length}프레임 / ${fps}FPS / ${(blob.size / 1024).toFixed(1)}KB`);
    });

    gif.on('abort', (error) => {
      setStatus(`GIF 내보내기 실패: ${error?.message || error}`);
    });

    setStatus('GIF 인코딩 중... 프레임이 많거나 크면 시간이 걸릴 수 있습니다.');
    gif.render();
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const pngButton = document.getElementById('exportButton');
    if (!pngButton) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'primary';
    button.textContent = 'GIF 내보내기';
    button.title = 'PNG 출력과 같은 기준으로 보정된 프레임을 GIF로 내보냅니다. FPS 입력값을 사용합니다.';
    pngButton.after(button);
  }

  document.addEventListener('click', (event) => {
    if (event.target?.id === BUTTON_ID) exportGif();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton);
  } else {
    ensureButton();
  }
})();

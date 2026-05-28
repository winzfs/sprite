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

  function createGifFrameContext(frame, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    if (!ui.transparentBg?.checked) {
      ctx.fillStyle = ui.exportBg?.value || '#d9d9d9';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

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

    const rects = frames.map((frame) => getSourceRect(frame));
    const width = Math.max(...rects.map((rect) => rect.w));
    const height = Math.max(...rects.map((rect) => rect.h));
    const fps = getGifFps();
    const delay = Math.max(20, Math.round(1000 / fps));

    const gif = new GIF({
      width,
      height,
      repeat: 0,
      quality: 5,
    });

    setStatus(`GIF 생성 준비 중... ${frames.length}프레임 / ${fps}FPS / ${width}x${height}`);

    frames.forEach((frame) => {
      const ctx = createGifFrameContext(frame, width, height);
      gif.addFrame(ctx, { delay });
    });

    gif.on('finished', (blob) => {
      downloadBlob(blob, `sprite-animation-${frames.length}f-${fps}fps-${width}x${height}.gif`);
      setStatus(`GIF 내보내기 완료: ${frames.length}프레임 / ${fps}FPS / ${width}x${height} / ${(blob.size / 1024).toFixed(1)}KB`);
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
    button.title = '출력 순서 기준으로 애니메이션 GIF를 내보냅니다. FPS 입력값을 사용합니다.';
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

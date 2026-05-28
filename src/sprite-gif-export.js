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

  async function exportGif() {
    if (!window.SpriteGifEncoder?.encode) return setStatus('스프라이트 GIF 인코더가 로드되지 않았습니다.');

    const frames = getOutputFrames();
    if (!frames.length) return setStatus('GIF로 내보낼 프레임이 없습니다.');

    const { width, height, rects } = getGifCellSize(frames);
    const fps = getGifFps();
    const transparent = !!ui.transparentBg?.checked;
    const firstRect = rects[0];

    try {
      setStatus(`스프라이트 GIF 인코딩 중... 셀 ${width}x${height}, 첫 프레임 ${firstRect.w}x${firstRect.h}, ${frames.length}프레임 / ${fps}FPS`);
      const blob = await window.SpriteGifEncoder.encode({ frames, width, height, fps, transparent });
      downloadBlob(blob, `sprite-animation-${frames.length}f-${fps}fps-${width}x${height}.gif`);
      setStatus(`GIF 내보내기 완료: 셀 ${width}x${height}, ${frames.length}프레임 / ${fps}FPS / ${(blob.size / 1024).toFixed(1)}KB`);
    } catch (error) {
      setStatus(`GIF 내보내기 실패: ${error?.message || error}`);
    }
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
    button.title = '스프라이트 전용 GIF 인코더로 출력합니다. FPS 입력값을 사용합니다.';
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

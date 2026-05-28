(() => {
  function hasGifEncoder() {
    return typeof window.GIF === 'function';
  }

  function renderFrameToCanvas(frame, width, height, transparent) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    if (!transparent) {
      ctx.fillStyle = ui.exportBg?.value || '#d9d9d9';
      ctx.fillRect(0, 0, width, height);
    }

    drawFrameImage(ctx, frame, 0, 0, 1);
    return canvas;
  }

  async function encode({ frames, width, height, fps, transparent }) {
    if (!hasGifEncoder()) throw new Error('GIF 인코더가 로드되지 않았습니다.');
    const delay = Math.max(20, Math.round(1000 / Math.max(1, fps || 8)));
    const gif = new window.GIF({
      width,
      height,
      repeat: 0,
      quality: 1,
      transparent: !!transparent,
      dispose: transparent ? 2 : 1,
    });

    for (const frame of frames) {
      const canvas = renderFrameToCanvas(frame, width, height, transparent);
      gif.addFrame(canvas.getContext('2d', { willReadFrequently: true }), {
        delay,
        dispose: transparent ? 2 : 1,
      });
    }

    return new Promise((resolve, reject) => {
      gif.on('finished', resolve);
      gif.on('abort', reject);
      gif.render();
    });
  }

  window.SpriteGifEncoder = { encode };
})();

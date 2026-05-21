(() => {
  const $ = (id) => document.getElementById(id);

  const v2g = {
    input: $('videoToGifInput'),
    video: $('v2gVideoPreview'),
    canvas: $('v2gCanvasPreview'),
    start: $('v2gStartInput'),
    end: $('v2gEndInput'),
    fps: $('v2gFpsInput'),
    width: $('v2gWidthInput'),
    quality: $('v2gQualityInput'),
    loop: $('v2gLoopInput'),
    loadMeta: $('v2gLoadMetaButton'),
    convert: $('v2gConvertButton'),
    download: $('v2gDownloadLink'),
    progress: $('v2gProgress'),
    status: $('v2gStatus'),
    objectUrl: '',
  };

  const g2v = {
    input: $('gifToVideoInput'),
    img: $('g2vGifPreview'),
    canvas: $('g2vCanvasPreview'),
    duration: $('g2vDurationInput'),
    fps: $('g2vFpsInput'),
    width: $('g2vWidthInput'),
    mime: $('g2vMimeInput'),
    convert: $('g2vConvertButton'),
    download: $('g2vDownloadLink'),
    progress: $('g2vProgress'),
    status: $('g2vStatus'),
    objectUrl: '',
  };

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  function readNumber(input, fallback) {
    const value = Number.parseFloat(input?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function setDownload(link, blob, filename) {
    if (!link) return;
    if (link.dataset.objectUrl) URL.revokeObjectURL(link.dataset.objectUrl);
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.dataset.objectUrl = url;
    link.classList.remove('hidden');
  }

  function once(target, eventName) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        target.removeEventListener(eventName, onEvent);
        target.removeEventListener('error', onError);
      };
      const onEvent = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error(`${eventName} 대기 중 오류가 발생했습니다.`)); };
      target.addEventListener(eventName, onEvent, { once: true });
      target.addEventListener('error', onError, { once: true });
    });
  }

  function seekVideo(video, time) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      const onSeeked = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error('영상 seek 중 오류가 발생했습니다.')); };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = Math.max(0, time);
    });
  }

  function isGifEncoderReady() {
    return typeof window.GIF === 'function';
  }

  async function loadVideoFile(file) {
    if (!file) return;
    if (v2g.objectUrl) URL.revokeObjectURL(v2g.objectUrl);
    v2g.objectUrl = URL.createObjectURL(file);
    v2g.video.src = v2g.objectUrl;
    v2g.video.load();
    v2g.download?.classList.add('hidden');
    setText(v2g.status, '영상 메타데이터를 읽는 중...');
    await once(v2g.video, 'loadedmetadata');
    const duration = Number.isFinite(v2g.video.duration) ? v2g.video.duration : 0;
    v2g.start.value = '0';
    v2g.end.value = String(Math.min(3, duration || 3).toFixed(1));
    const width = Math.min(480, v2g.video.videoWidth || 320);
    v2g.width.value = String(width);
    drawVideoPreviewFrame();
    setText(v2g.status, `로드 완료: ${v2g.video.videoWidth}x${v2g.video.videoHeight}, ${duration.toFixed(2)}초`);
  }

  function drawVideoPreviewFrame() {
    if (!v2g.video.videoWidth || !v2g.video.videoHeight) return;
    const targetWidth = Math.max(16, readNumber(v2g.width, v2g.video.videoWidth));
    const targetHeight = Math.round((v2g.video.videoHeight / v2g.video.videoWidth) * targetWidth);
    v2g.canvas.width = targetWidth;
    v2g.canvas.height = targetHeight;
    const ctx = v2g.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(v2g.video, 0, 0, targetWidth, targetHeight);
  }

  async function convertVideoToGif() {
    if (!v2g.input.files?.[0]) {
      setText(v2g.status, '먼저 영상 파일을 선택하세요.');
      return;
    }
    if (!isGifEncoderReady()) {
      setText(v2g.status, '로컬 GIF 인코더를 불러오지 못했습니다. src/vendor/gif.js 로드를 확인하세요.');
      return;
    }
    if (!v2g.video.videoWidth) await loadVideoFile(v2g.input.files[0]);

    const duration = Number.isFinite(v2g.video.duration) ? v2g.video.duration : 0;
    const start = Math.max(0, readNumber(v2g.start, 0));
    const end = Math.min(duration || readNumber(v2g.end, 3), Math.max(start + 0.1, readNumber(v2g.end, start + 3)));
    const fps = Math.max(1, Math.min(24, Math.round(readNumber(v2g.fps, 10))));
    const quality = Math.max(1, Math.min(30, Math.round(readNumber(v2g.quality, 10))));
    const targetWidth = Math.max(16, Math.min(1280, Math.round(readNumber(v2g.width, v2g.video.videoWidth))));
    const targetHeight = Math.round((v2g.video.videoHeight / v2g.video.videoWidth) * targetWidth);
    const frameCount = Math.max(1, Math.floor((end - start) * fps) + 1);

    if (frameCount > 240) {
      setText(v2g.status, `프레임이 너무 많습니다(${frameCount}). 구간이나 FPS를 줄이세요.`);
      return;
    }

    v2g.convert.disabled = true;
    v2g.progress.value = 0;
    v2g.download.classList.add('hidden');
    setText(v2g.status, `GIF 변환 중... ${frameCount}프레임`);

    try {
      const canvas = v2g.canvas;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;

      const gif = new window.GIF({
        workers: 0,
        quality,
        width: targetWidth,
        height: targetHeight,
        repeat: v2g.loop.checked ? 0 : -1,
        workerScript: 'src/vendor/gif.worker.js',
      });

      for (let i = 0; i < frameCount; i += 1) {
        const time = Math.min(end, start + i / fps);
        await seekVideo(v2g.video, time);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(v2g.video, 0, 0, canvas.width, canvas.height);
        gif.addFrame(ctx, { copy: true, delay: Math.round(1000 / fps) });
        v2g.progress.value = (i + 1) / (frameCount + 1);
      }

      const blob = await new Promise((resolve, reject) => {
        gif.on('finished', resolve);
        gif.on('abort', (error) => reject(error instanceof Error ? error : new Error('GIF 변환이 중단되었습니다.')));
        gif.render();
      });

      v2g.progress.value = 1;
      setDownload(v2g.download, blob, 'converted.gif');
      setText(v2g.status, `GIF 변환 완료: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      setText(v2g.status, `GIF 변환 실패: ${error.message}`);
    } finally {
      v2g.convert.disabled = false;
    }
  }

  async function loadGifFile(file) {
    if (!file) return;
    if (g2v.objectUrl) URL.revokeObjectURL(g2v.objectUrl);
    g2v.objectUrl = URL.createObjectURL(file);
    g2v.img.src = g2v.objectUrl;
    g2v.download?.classList.add('hidden');
    setText(g2v.status, 'GIF 로드 중...');
    await once(g2v.img, 'load');
    const width = g2v.img.naturalWidth || 320;
    const height = g2v.img.naturalHeight || 240;
    g2v.canvas.width = width;
    g2v.canvas.height = height;
    const ctx = g2v.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(g2v.img, 0, 0, width, height);
    setText(g2v.status, `GIF 로드 완료: ${width}x${height}`);
  }

  function chooseRecorderMime(preferred) {
    const candidates = [preferred, 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].filter(Boolean);
    return candidates.find((mime) => window.MediaRecorder?.isTypeSupported?.(mime)) || '';
  }

  async function convertGifToVideo() {
    if (!g2v.input.files?.[0]) {
      setText(g2v.status, '먼저 GIF 파일을 선택하세요.');
      return;
    }
    if (!window.MediaRecorder) {
      setText(g2v.status, '이 브라우저는 MediaRecorder를 지원하지 않습니다.');
      return;
    }
    if (!g2v.img.naturalWidth) await loadGifFile(g2v.input.files[0]);

    const sourceWidth = g2v.img.naturalWidth || 320;
    const sourceHeight = g2v.img.naturalHeight || 240;
    const targetWidthInput = Math.round(readNumber(g2v.width, 0));
    const targetWidth = targetWidthInput > 0 ? targetWidthInput : sourceWidth;
    const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth);
    const fps = Math.max(1, Math.min(60, Math.round(readNumber(g2v.fps, 24))));
    const duration = Math.max(0.5, Math.min(60, readNumber(g2v.duration, 3)));
    const mimeType = chooseRecorderMime(g2v.mime.value);

    if (!mimeType) {
      setText(g2v.status, '이 브라우저에서 지원되는 WebM 녹화 MIME을 찾지 못했습니다.');
      return;
    }

    g2v.convert.disabled = true;
    g2v.progress.value = 0;
    g2v.download.classList.add('hidden');
    setText(g2v.status, `WebM 변환 중... ${duration.toFixed(1)}초, ${fps}fps`);

    try {
      const canvas = g2v.canvas;
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      });

      const finished = new Promise((resolve) => {
        recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })), { once: true });
      });

      recorder.start();
      const startedAt = performance.now();
      const frameInterval = 1000 / fps;
      const totalFrames = Math.max(1, Math.ceil(duration * fps));

      for (let frame = 0; frame < totalFrames; frame += 1) {
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(g2v.img, 0, 0, targetWidth, targetHeight);
        g2v.progress.value = (frame + 1) / totalFrames;
        const nextTime = startedAt + (frame + 1) * frameInterval;
        const delay = Math.max(0, nextTime - performance.now());
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      const blob = await finished;
      setDownload(g2v.download, blob, 'converted.webm');
      setText(g2v.status, `WebM 변환 완료: ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
    } catch (error) {
      setText(g2v.status, `WebM 변환 실패: ${error.message}`);
    } finally {
      g2v.convert.disabled = false;
    }
  }

  v2g.input?.addEventListener('change', () => loadVideoFile(v2g.input.files?.[0]).catch((error) => setText(v2g.status, `영상 로드 실패: ${error.message}`)));
  v2g.loadMeta?.addEventListener('click', () => loadVideoFile(v2g.input.files?.[0]).catch((error) => setText(v2g.status, `영상 정보 읽기 실패: ${error.message}`)));
  v2g.convert?.addEventListener('click', convertVideoToGif);
  v2g.width?.addEventListener('input', drawVideoPreviewFrame);

  g2v.input?.addEventListener('change', () => loadGifFile(g2v.input.files?.[0]).catch((error) => setText(g2v.status, `GIF 로드 실패: ${error.message}`)));
  g2v.convert?.addEventListener('click', convertGifToVideo);
})();

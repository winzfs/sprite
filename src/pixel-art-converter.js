(() => {
  const VIEW_KEY = 'pixelArt';
  let objectUrl = '';
  let downloadUrl = '';
  let sourceImage = null;
  let sourceName = 'pixel-art';

  function $(id) {
    return document.getElementById(id);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function addNav() {
    if (document.querySelector(`[data-view="${VIEW_KEY}"]`)) return;
    const mediaGroup = Array.from(document.querySelectorAll('.nav-group')).find((group) => group.querySelector('[data-view="videoToGif"]'));
    const items = mediaGroup?.querySelector('.nav-group-items');
    if (!items) return;

    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.view = VIEW_KEY;
    button.textContent = '픽셀아트 변환';

    const bgButton = items.querySelector('[data-view="backgroundRemover"]');
    const help = items.querySelector('.nav-help');
    if (bgButton) bgButton.after(button);
    else if (help) items.insertBefore(button, help);
    else items.append(button);
  }

  function addView() {
    if ($(`view-${VIEW_KEY}`)) return;
    const main = document.querySelector('.main-content');
    if (!main) return;

    const section = document.createElement('section');
    section.id = `view-${VIEW_KEY}`;
    section.className = 'tool-view';
    section.innerHTML = `
      <header class="app-header">
        <h1>픽셀아트 변환</h1>
        <p>사진이나 그림을 낮은 해상도, 제한 팔레트, 디더링, 윤곽 강조로 픽셀아트풍 PNG로 변환합니다.</p>
      </header>
      <main class="converter-layout">
        <section class="panel">
          <div class="panel-title">변환 설정</div>
          <div class="panel-body controls">
            <label>이미지 파일 <input id="pixelArtInput" type="file" accept="image/*"></label>
            <div class="grid-2">
              <label>프리셋
                <select id="pixelArtPreset">
                  <option value="sprite">깔끔한 게임 스프라이트</option>
                  <option value="soft">부드러운 픽셀 일러스트</option>
                  <option value="retro">레트로 콘솔풍</option>
                  <option value="chunky">Chunky Pixel</option>
                  <option value="custom">사용자 설정</option>
                </select>
              </label>
              <label class="check-label"><input id="pixelArtKeepRatio" type="checkbox" checked> 비율 유지</label>
            </div>
            <div class="grid-2">
              <label>목표 너비 <input id="pixelArtWidth" type="number" min="8" max="512" value="64"></label>
              <label>목표 높이 <input id="pixelArtHeight" type="number" min="8" max="512" value="64"></label>
            </div>
            <div class="grid-2">
              <label>색상 수 <input id="pixelArtColors" type="range" min="4" max="96" value="24"></label>
              <label>현재 색상 수 <input id="pixelArtColorsText" type="text" value="24" readonly></label>
            </div>
            <div class="grid-2">
              <label>디더링
                <select id="pixelArtDither">
                  <option value="none">없음</option>
                  <option value="ordered">Ordered Bayer</option>
                  <option value="floyd">Floyd-Steinberg</option>
                </select>
              </label>
              <label>확대 배율 <input id="pixelArtScale" type="range" min="1" max="32" value="8"></label>
            </div>
            <div class="grid-2">
              <label>대비 <input id="pixelArtContrast" type="range" min="-100" max="100" value="18"></label>
              <label>채도 <input id="pixelArtSaturation" type="range" min="-100" max="120" value="14"></label>
            </div>
            <div class="grid-2">
              <label>윤곽 강조 <input id="pixelArtOutline" type="range" min="0" max="100" value="35"></label>
              <label>노이즈 정리 <input id="pixelArtCleanup" type="range" min="0" max="100" value="35"></label>
            </div>
            <div class="grid-2">
              <label>결과 배경
                <select id="pixelArtBackground">
                  <option value="transparent">투명 유지</option>
                  <option value="white">흰색</option>
                  <option value="black">검정</option>
                  <option value="gray">회색</option>
                </select>
              </label>
              <label class="check-label"><input id="pixelArtAutoRun" type="checkbox" checked> 설정 변경 시 자동 변환</label>
            </div>
            <div class="button-row">
              <button id="pixelArtRunButton" type="button" class="primary">픽셀아트 변환</button>
              <a id="pixelArtDownloadLink" class="download-link hidden" download="pixel-art.png">PNG 다운로드</a>
            </div>
            <div id="pixelArtStatus" class="status">이미지를 올린 뒤 해상도, 색상 수, 디더링을 조절하세요.</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">원본 / 결과 미리보기</div>
          <div class="panel-body controls">
            <div class="grid-2">
              <div>
                <div class="sub-title">원본</div>
                <canvas id="pixelArtSourceCanvas" class="media-canvas"></canvas>
              </div>
              <div>
                <div class="sub-title">픽셀아트 결과</div>
                <canvas id="pixelArtResultCanvas" class="media-canvas"></canvas>
              </div>
            </div>
            <div>
              <div class="sub-title">추출 팔레트</div>
              <div id="pixelArtPalette" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
            </div>
          </div>
        </section>
      </main>
    `;
    main.append(section);
  }

  function setStatus(text) {
    const status = $('pixelArtStatus');
    if (status) status.textContent = text;
  }

  function readInt(id, fallback, min, max) {
    const value = Number.parseInt($(id)?.value || String(fallback), 10);
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  }

  function readFloat(id, fallback, min, max) {
    const value = Number.parseFloat($(id)?.value || String(fallback));
    return clamp(Number.isFinite(value) ? value : fallback, min, max);
  }

  function syncTexts() {
    const colors = readInt('pixelArtColors', 24, 4, 96);
    const text = $('pixelArtColorsText');
    if (text) text.value = String(colors);
  }

  function applyPreset() {
    const preset = $('pixelArtPreset')?.value || 'sprite';
    if (preset === 'custom') return;
    const configs = {
      sprite: { w: 64, h: 64, c: 24, d: 'none', s: 8, contrast: 18, saturation: 14, outline: 35, cleanup: 35 },
      soft: { w: 96, h: 96, c: 48, d: 'ordered', s: 6, contrast: 8, saturation: 8, outline: 18, cleanup: 18 },
      retro: { w: 64, h: 64, c: 12, d: 'ordered', s: 8, contrast: 28, saturation: 24, outline: 42, cleanup: 48 },
      chunky: { w: 32, h: 32, c: 16, d: 'none', s: 14, contrast: 24, saturation: 18, outline: 45, cleanup: 55 },
    };
    const cfg = configs[preset] || configs.sprite;
    $('pixelArtWidth').value = cfg.w;
    $('pixelArtHeight').value = cfg.h;
    $('pixelArtColors').value = cfg.c;
    $('pixelArtDither').value = cfg.d;
    $('pixelArtScale').value = cfg.s;
    $('pixelArtContrast').value = cfg.contrast;
    $('pixelArtSaturation').value = cfg.saturation;
    $('pixelArtOutline').value = cfg.outline;
    $('pixelArtCleanup').value = cfg.cleanup;
    syncTexts();
  }

  function markCustom(event) {
    if (event?.target?.id === 'pixelArtPreset') return;
    const preset = $('pixelArtPreset');
    if (preset) preset.value = 'custom';
  }

  function adjustRatio(changed) {
    if (!$('pixelArtKeepRatio')?.checked || !sourceImage) return;
    const ratio = sourceImage.naturalWidth / Math.max(1, sourceImage.naturalHeight);
    const widthInput = $('pixelArtWidth');
    const heightInput = $('pixelArtHeight');
    if (changed === 'width') {
      heightInput.value = Math.max(8, Math.round(readInt('pixelArtWidth', 64, 8, 512) / ratio));
    } else {
      widthInput.value = Math.max(8, Math.round(readInt('pixelArtHeight', 64, 8, 512) * ratio));
    }
  }

  function drawSourcePreview() {
    const canvas = $('pixelArtSourceCanvas');
    if (!canvas || !sourceImage) return;
    const max = 420;
    const ratio = Math.min(1, max / Math.max(sourceImage.naturalWidth, sourceImage.naturalHeight));
    canvas.width = Math.max(1, Math.round(sourceImage.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(sourceImage.naturalHeight * ratio));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  }

  function adjustColor(data, contrast, saturation) {
    const c = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const sat = 1 + saturation / 100;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      let r = clamp(c * (data[i] - 128) + 128, 0, 255);
      let g = clamp(c * (data[i + 1] - 128) + 128, 0, 255);
      let b = clamp(c * (data[i + 2] - 128) + 128, 0, 255);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i] = clamp(gray + (r - gray) * sat, 0, 255);
      data[i + 1] = clamp(gray + (g - gray) * sat, 0, 255);
      data[i + 2] = clamp(gray + (b - gray) * sat, 0, 255);
    }
  }

  function getPixelsForPalette(data, maxSamples = 8000) {
    const pixels = [];
    const step = Math.max(4, Math.floor(data.length / 4 / maxSamples) * 4);
    for (let i = 0; i < data.length; i += step) {
      if (data[i + 3] < 16) continue;
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    return pixels;
  }

  function averageBucket(bucket) {
    let r = 0;
    let g = 0;
    let b = 0;
    bucket.forEach((pixel) => {
      r += pixel[0];
      g += pixel[1];
      b += pixel[2];
    });
    const len = Math.max(1, bucket.length);
    return [Math.round(r / len), Math.round(g / len), Math.round(b / len)];
  }

  function medianCut(pixels, colorCount) {
    if (!pixels.length) return [[0, 0, 0]];
    let buckets = [pixels.slice()];
    while (buckets.length < colorCount) {
      buckets.sort((a, b) => b.length - a.length);
      const bucket = buckets.shift();
      if (!bucket || bucket.length <= 1) {
        if (bucket) buckets.push(bucket);
        break;
      }
      let minR = 255; let minG = 255; let minB = 255;
      let maxR = 0; let maxG = 0; let maxB = 0;
      bucket.forEach((p) => {
        minR = Math.min(minR, p[0]); maxR = Math.max(maxR, p[0]);
        minG = Math.min(minG, p[1]); maxG = Math.max(maxG, p[1]);
        minB = Math.min(minB, p[2]); maxB = Math.max(maxB, p[2]);
      });
      const ranges = [maxR - minR, maxG - minG, maxB - minB];
      const channel = ranges.indexOf(Math.max(...ranges));
      bucket.sort((a, b) => a[channel] - b[channel]);
      const mid = Math.floor(bucket.length / 2);
      buckets.push(bucket.slice(0, mid), bucket.slice(mid));
    }
    return buckets.filter(Boolean).map(averageBucket).slice(0, colorCount);
  }

  function nearestColor(r, g, b, palette) {
    let best = palette[0];
    let bestDistance = Infinity;
    palette.forEach((color) => {
      const dr = r - color[0];
      const dg = g - color[1];
      const db = b - color[2];
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color;
      }
    });
    return best;
  }

  function quantizeNoDither(data, palette) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      const color = nearestColor(data[i], data[i + 1], data[i + 2], palette);
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
    }
  }

  function quantizeOrdered(data, width, height, palette) {
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 16) continue;
        const offset = (bayer[y % 4][x % 4] - 7.5) * 4;
        const color = nearestColor(
          clamp(data[i] + offset, 0, 255),
          clamp(data[i + 1] + offset, 0, 255),
          clamp(data[i + 2] + offset, 0, 255),
          palette,
        );
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
      }
    }
  }

  function quantizeFloyd(data, width, height, palette) {
    const buffer = new Float32Array(data.length);
    for (let i = 0; i < data.length; i += 1) buffer[i] = data[i];
    function addError(x, y, er, eg, eb, factor) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = (y * width + x) * 4;
      buffer[i] += er * factor;
      buffer[i + 1] += eg * factor;
      buffer[i + 2] += eb * factor;
    }
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] < 16) continue;
        const oldR = clamp(buffer[i], 0, 255);
        const oldG = clamp(buffer[i + 1], 0, 255);
        const oldB = clamp(buffer[i + 2], 0, 255);
        const color = nearestColor(oldR, oldG, oldB, palette);
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        const er = oldR - color[0];
        const eg = oldG - color[1];
        const eb = oldB - color[2];
        addError(x + 1, y, er, eg, eb, 7 / 16);
        addError(x - 1, y + 1, er, eg, eb, 3 / 16);
        addError(x, y + 1, er, eg, eb, 5 / 16);
        addError(x + 1, y + 1, er, eg, eb, 1 / 16);
      }
    }
  }

  function cleanupNoise(data, width, height, strength) {
    if (strength <= 0) return;
    const threshold = Math.round(1 + (strength / 100) * 3);
    const copy = new Uint8ClampedArray(data);
    function sameColor(i, j) {
      return copy[i + 3] === copy[j + 3]
        && Math.abs(copy[i] - copy[j]) < 3
        && Math.abs(copy[i + 1] - copy[j + 1]) < 3
        && Math.abs(copy[i + 2] - copy[j + 2]) < 3;
    }
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        let same = 0;
        const neighbors = [];
        for (let ny = y - 1; ny <= y + 1; ny += 1) {
          for (let nx = x - 1; nx <= x + 1; nx += 1) {
            if (nx === x && ny === y) continue;
            const ni = (ny * width + nx) * 4;
            neighbors.push(ni);
            if (sameColor(i, ni)) same += 1;
          }
        }
        if (same <= threshold) {
          const counts = new Map();
          neighbors.forEach((ni) => {
            const key = `${copy[ni]},${copy[ni + 1]},${copy[ni + 2]},${copy[ni + 3]}`;
            counts.set(key, (counts.get(key) || 0) + 1);
          });
          const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
          if (best && best[1] >= 3) {
            const [r, g, b, a] = best[0].split(',').map(Number);
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
          }
        }
      }
    }
  }

  function applyOutline(data, width, height, strength) {
    if (strength <= 0) return;
    const copy = new Uint8ClampedArray(data);
    const amount = strength / 100;
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = (y * width + x) * 4;
        if (copy[i + 3] < 16) continue;
        let edge = 0;
        const lum = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const ni = ((y + dy) * width + (x + dx)) * 4;
          const nl = 0.299 * copy[ni] + 0.587 * copy[ni + 1] + 0.114 * copy[ni + 2];
          edge = Math.max(edge, Math.abs(lum - nl));
          if (copy[ni + 3] < 16) edge = Math.max(edge, 80);
        });
        if (edge > 28) {
          const darken = 1 - amount * 0.42;
          data[i] = clamp(data[i] * darken, 0, 255);
          data[i + 1] = clamp(data[i + 1] * darken, 0, 255);
          data[i + 2] = clamp(data[i + 2] * darken, 0, 255);
        }
      }
    }
  }

  function fillBackground(ctx, width, height) {
    const bg = $('pixelArtBackground')?.value || 'transparent';
    if (bg === 'transparent') return;
    const color = bg === 'white' ? '#ffffff' : bg === 'black' ? '#000000' : '#808080';
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) {
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function drawPalette(palette) {
    const box = $('pixelArtPalette');
    if (!box) return;
    box.innerHTML = '';
    palette.forEach((color) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      const hex = `#${color.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
      swatch.title = hex;
      swatch.textContent = hex;
      swatch.style.cssText = `background:${hex};color:${(color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000 > 140 ? '#111' : '#fff'};border:1px solid rgba(0,0,0,.18);border-radius:8px;padding:6px 8px;font-size:11px;`;
      swatch.addEventListener('click', () => navigator.clipboard?.writeText(hex));
      box.append(swatch);
    });
  }

  function updateDownload(canvas) {
    const link = $('pixelArtDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = `${sourceName}-pixel-art.png`;
      link.classList.remove('hidden');
    }, 'image/png');
  }

  function convert() {
    if (!sourceImage) {
      setStatus('먼저 이미지를 선택하세요.');
      return;
    }
    syncTexts();
    const width = readInt('pixelArtWidth', 64, 8, 512);
    const height = readInt('pixelArtHeight', 64, 8, 512);
    const colors = readInt('pixelArtColors', 24, 4, 96);
    const scale = readInt('pixelArtScale', 8, 1, 32);
    const contrast = readFloat('pixelArtContrast', 0, -100, 100);
    const saturation = readFloat('pixelArtSaturation', 0, -100, 120);
    const outline = readInt('pixelArtOutline', 0, 0, 100);
    const cleanup = readInt('pixelArtCleanup', 0, 0, 100);
    const dither = $('pixelArtDither')?.value || 'none';

    const small = document.createElement('canvas');
    small.width = width;
    small.height = height;
    const smallCtx = small.getContext('2d', { willReadFrequently: true });
    smallCtx.imageSmoothingEnabled = true;
    smallCtx.clearRect(0, 0, width, height);
    smallCtx.drawImage(sourceImage, 0, 0, width, height);

    const imageData = smallCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    adjustColor(data, contrast, saturation);
    const palette = medianCut(getPixelsForPalette(data), colors);
    if (dither === 'ordered') quantizeOrdered(data, width, height, palette);
    else if (dither === 'floyd') quantizeFloyd(data, width, height, palette);
    else quantizeNoDither(data, palette);
    cleanupNoise(data, width, height, cleanup);
    applyOutline(data, width, height, outline);
    smallCtx.putImageData(imageData, 0, 0);
    fillBackground(smallCtx, width, height);

    const result = $('pixelArtResultCanvas');
    result.width = width * scale;
    result.height = height * scale;
    result.style.maxWidth = '100%';
    result.style.imageRendering = 'pixelated';
    const resultCtx = result.getContext('2d', { willReadFrequently: true });
    resultCtx.imageSmoothingEnabled = false;
    resultCtx.clearRect(0, 0, result.width, result.height);
    resultCtx.drawImage(small, 0, 0, result.width, result.height);

    drawPalette(palette);
    updateDownload(result);
    setStatus(`변환 완료: ${width}x${height} 기반, ${palette.length}색, ${scale}x 확대 PNG`);
  }

  function autoRun() {
    syncTexts();
    if (sourceImage && $('pixelArtAutoRun')?.checked) convert();
  }

  function bind() {
    const input = $('pixelArtInput');
    if (!input || input.dataset.pixelArtBound === 'true') return;
    input.dataset.pixelArtBound = 'true';

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(file);
      sourceName = file.name.replace(/\.[^.]+$/, '') || 'pixel-art';
      sourceImage = new Image();
      sourceImage.onload = () => {
        drawSourcePreview();
        if ($('pixelArtKeepRatio')?.checked) {
          const base = readInt('pixelArtWidth', 64, 8, 512);
          $('pixelArtHeight').value = Math.max(8, Math.round(base * sourceImage.naturalHeight / Math.max(1, sourceImage.naturalWidth)));
        }
        convert();
      };
      sourceImage.onerror = () => setStatus('이미지를 불러오지 못했습니다.');
      sourceImage.src = objectUrl;
    });

    $('pixelArtPreset')?.addEventListener('change', () => {
      applyPreset();
      autoRun();
    });
    $('pixelArtWidth')?.addEventListener('input', (event) => {
      markCustom(event);
      adjustRatio('width');
      autoRun();
    });
    $('pixelArtHeight')?.addEventListener('input', (event) => {
      markCustom(event);
      adjustRatio('height');
      autoRun();
    });
    ['pixelArtColors', 'pixelArtDither', 'pixelArtScale', 'pixelArtContrast', 'pixelArtSaturation', 'pixelArtOutline', 'pixelArtCleanup', 'pixelArtBackground'].forEach((id) => {
      $(id)?.addEventListener('input', (event) => { markCustom(event); autoRun(); });
      $(id)?.addEventListener('change', (event) => { markCustom(event); autoRun(); });
    });
    $('pixelArtRunButton')?.addEventListener('click', convert);
    syncTexts();
  }

  function install() {
    addNav();
    addView();
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
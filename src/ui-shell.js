(() => {
  const VIEW_BACKGROUND_REMOVER = 'backgroundRemover';
  const body = document.body;
  const menuButton = document.getElementById('menuToggleButton');
  const menuOverlay = document.getElementById('menuOverlay');

  function closeMenu() {
    body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    body.classList.add('menu-open');
    menuButton?.setAttribute('aria-expanded', 'true');
  }

  function toggleMenu() {
    if (body.classList.contains('menu-open')) closeMenu();
    else openMenu();
  }

  function showView(key) {
    document.querySelectorAll('.nav-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === key);
    });

    document.querySelectorAll('.tool-view').forEach((view) => {
      view.classList.toggle('active', view.id === `view-${key}`);
    });

    closeMenu();
  }

  function addBackgroundRemoverNav() {
    if (document.querySelector(`[data-view="${VIEW_BACKGROUND_REMOVER}"]`)) return;

    const mediaGroup = Array.from(document.querySelectorAll('.nav-group')).find((group) => group.querySelector('[data-view="videoToGif"]'));
    const items = mediaGroup?.querySelector('.nav-group-items');
    if (!items) return;

    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.view = VIEW_BACKGROUND_REMOVER;
    button.textContent = '배경색 제거';

    const help = items.querySelector('.nav-help');
    if (help) items.insertBefore(button, help);
    else items.append(button);
  }

  function addBackgroundRemoverView() {
    if (document.getElementById(`view-${VIEW_BACKGROUND_REMOVER}`)) return;

    const main = document.querySelector('.main-content');
    if (!main) return;

    const section = document.createElement('section');
    section.id = `view-${VIEW_BACKGROUND_REMOVER}`;
    section.className = 'tool-view';
    section.innerHTML = `
      <header class="app-header">
        <h1>배경색 제거</h1>
        <p>이미지에서 선택한 색상을 찾아 알파 채널 0의 투명 픽셀로 바꾸고 PNG로 저장합니다.</p>
      </header>
      <main class="converter-layout">
        <section class="panel">
          <div class="panel-title">제거 설정</div>
          <div class="panel-body controls">
            <label>그림 파일 <input id="bgRemoveInput" type="file" accept="image/*"></label>
            <div class="grid-2">
              <label>지울 색상 <input id="bgRemoveColor" type="color" value="#00ff00"></label>
              <label>허용 오차 <input id="bgRemoveTolerance" type="range" min="0" max="160" value="34"></label>
            </div>
            <div class="grid-2">
              <label>현재 색상값 <input id="bgRemoveColorText" type="text" value="#00ff00" readonly></label>
              <label>현재 오차값 <input id="bgRemoveToleranceText" type="text" value="34" readonly></label>
            </div>
            <div class="grid-2">
              <label>제거 강도
                <select id="bgRemoveStrength">
                  <option value="precise">정밀</option>
                  <option value="normal" selected>기본</option>
                  <option value="clean">깔끔</option>
                  <option value="aggressive">강하게</option>
                </select>
              </label>
              <label class="check-label"><input id="bgRemoveCleanupInput" type="checkbox" checked> 가장자리 자잘한 픽셀 정리</label>
            </div>
            <div class="grid-2">
              <label>미리보기 배경
                <select id="bgRemovePreviewBg">
                  <option value="checker">체커보드</option>
                  <option value="white">흰색</option>
                  <option value="dark">어두운색</option>
                  <option value="transparent">기본 투명</option>
                </select>
              </label>
              <label>미리보기 확대 <input id="bgRemovePreviewZoom" type="range" min="1" max="8" value="2"></label>
            </div>
            <div class="grid-2">
              <label>현재 확대 <input id="bgRemovePreviewZoomText" type="text" value="2x" readonly></label>
              <label class="check-label"><input id="bgRemoveAutoApplyInput" type="checkbox" checked> 설정 변경 시 자동 적용</label>
            </div>
            <div class="button-row">
              <button id="bgRemoveApplyButton" type="button" class="primary">투명 처리</button>
              <button id="bgRemoveResetViewButton" type="button">미리보기 위치 초기화</button>
              <a id="bgRemoveDownloadLink" class="download-link hidden" download="transparent-background.png">PNG 다운로드</a>
            </div>
            <div id="bgRemoveStatus" class="status">이미지를 올린 뒤 색상 피커로 지울 색을 선택하세요. 원본 미리보기는 짧게 터치하면 색상 선택, 터치 드래그하면 이동합니다.</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">원본 / 결과 미리보기</div>
          <div class="panel-body controls">
            <div class="grid-2">
              <div>
                <div class="sub-title">원본 클릭 색상 추출 · 터치/드래그 이동</div>
                <div id="bgRemoveOriginalWrap" style="overflow:auto; max-height:520px; border-radius:12px; cursor:grab; touch-action:none; user-select:none; overscroll-behavior:contain;">
                  <canvas id="bgRemoveOriginalCanvas" class="media-canvas"></canvas>
                </div>
              </div>
              <div>
                <div class="sub-title">투명 처리 결과 · 터치/드래그 이동</div>
                <div id="bgRemoveResultWrap" style="overflow:auto; max-height:520px; border-radius:12px; cursor:grab; touch-action:none; user-select:none; overscroll-behavior:contain;">
                  <canvas id="bgRemoveResultCanvas" class="media-canvas"></canvas>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    `;

    main.append(section);
  }

  function initBackgroundRemover() {
    const input = document.getElementById('bgRemoveInput');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';

    const colorInput = document.getElementById('bgRemoveColor');
    const colorText = document.getElementById('bgRemoveColorText');
    const toleranceInput = document.getElementById('bgRemoveTolerance');
    const toleranceText = document.getElementById('bgRemoveToleranceText');
    const strengthInput = document.getElementById('bgRemoveStrength');
    const previewBgInput = document.getElementById('bgRemovePreviewBg');
    const previewZoomInput = document.getElementById('bgRemovePreviewZoom');
    const previewZoomText = document.getElementById('bgRemovePreviewZoomText');
    const cleanupInput = document.getElementById('bgRemoveCleanupInput');
    const autoApplyInput = document.getElementById('bgRemoveAutoApplyInput');
    const applyButton = document.getElementById('bgRemoveApplyButton');
    const resetViewButton = document.getElementById('bgRemoveResetViewButton');
    const downloadLink = document.getElementById('bgRemoveDownloadLink');
    const status = document.getElementById('bgRemoveStatus');
    const originalWrap = document.getElementById('bgRemoveOriginalWrap');
    const resultWrap = document.getElementById('bgRemoveResultWrap');
    const originalCanvas = document.getElementById('bgRemoveOriginalCanvas');
    const resultCanvas = document.getElementById('bgRemoveResultCanvas');
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    const resultCtx = resultCanvas.getContext('2d', { willReadFrequently: true });

    let image = null;
    let imageName = 'transparent-background';
    let objectUrl = '';
    let downloadObjectUrl = '';

    function setStatus(text) {
      if (status) status.textContent = text;
    }

    function setColor(hex) {
      const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : '#00ff00';
      colorInput.value = normalized;
      colorText.value = normalized;
    }

    function readTolerance() {
      const value = Number.parseInt(toleranceInput.value, 10);
      return Number.isFinite(value) ? Math.max(0, Math.min(160, value)) : 0;
    }

    function readZoom() {
      const value = Number.parseInt(previewZoomInput.value, 10);
      return Number.isFinite(value) ? Math.max(1, Math.min(8, value)) : 1;
    }

    function readStrength() {
      const key = strengthInput?.value || 'normal';
      if (key === 'precise') return { key, edgeBoost: 10, passes: 1, isolatedMax: 0, soften: false };
      if (key === 'clean') return { key, edgeBoost: 38, passes: 2, isolatedMax: 2, soften: true };
      if (key === 'aggressive') return { key, edgeBoost: 62, passes: 3, isolatedMax: 3, soften: true };
      return { key, edgeBoost: 24, passes: 1, isolatedMax: 1, soften: true };
    }

    function hexToRgb(hex) {
      const value = hex.replace('#', '');
      return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
      };
    }

    function rgbToHex(r, g, b) {
      return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
    }

    function colorDistance(data, index, target) {
      const dr = data[index] - target.r;
      const dg = data[index + 1] - target.g;
      const db = data[index + 2] - target.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    function colorWithinTolerance(data, index, target, tolerance) {
      return colorDistance(data, index, target) <= tolerance;
    }

    function pixelIndex(width, x, y) {
      return (y * width + x) * 4;
    }

    function countTransparentNeighbors(data, width, height, x, y) {
      let count = 0;
      for (let ny = y - 1; ny <= y + 1; ny += 1) {
        for (let nx = x - 1; nx <= x + 1; nx += 1) {
          if (nx === x && ny === y) continue;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[pixelIndex(width, nx, ny) + 3] === 0) count += 1;
        }
      }
      return count;
    }

    function countOpaqueNeighbors(data, width, height, x, y) {
      let count = 0;
      for (let ny = y - 1; ny <= y + 1; ny += 1) {
        for (let nx = x - 1; nx <= x + 1; nx += 1) {
          if (nx === x && ny === y) continue;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (data[pixelIndex(width, nx, ny) + 3] > 0) count += 1;
        }
      }
      return count;
    }

    function cleanupEdgePixels(data, width, height, target, tolerance, strength) {
      let totalRemoved = 0;
      const edgeTolerance = Math.min(255, tolerance + strength.edgeBoost);
      const softenTolerance = Math.min(255, tolerance + strength.edgeBoost * 0.55);

      for (let pass = 0; pass < strength.passes; pass += 1) {
        const removeIndexes = new Set();
        const softenIndexes = new Map();

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = pixelIndex(width, x, y);
            if (data[i + 3] === 0) continue;

            const distance = colorDistance(data, i, target);
            const transparentNeighbors = countTransparentNeighbors(data, width, height, x, y);
            const opaqueNeighbors = countOpaqueNeighbors(data, width, height, x, y);

            if (transparentNeighbors > 0 && distance <= edgeTolerance) {
              removeIndexes.add(i);
              continue;
            }

            if (opaqueNeighbors <= strength.isolatedMax && distance <= edgeTolerance) {
              removeIndexes.add(i);
              continue;
            }

            if (strength.soften && transparentNeighbors > 0 && distance <= softenTolerance) {
              const fade = Math.max(0, Math.min(1, (distance - tolerance) / Math.max(1, softenTolerance - tolerance)));
              const alpha = Math.round(data[i + 3] * fade);
              softenIndexes.set(i, alpha);
            }
          }
        }

        softenIndexes.forEach((alpha, i) => {
          data[i + 3] = Math.min(data[i + 3], alpha);
        });

        removeIndexes.forEach((i) => {
          if (data[i + 3] !== 0) totalRemoved += 1;
          data[i + 3] = 0;
        });

        if (!removeIndexes.size) break;
      }

      return totalRemoved;
    }

    function revokeDownloadUrl() {
      if (downloadObjectUrl) URL.revokeObjectURL(downloadObjectUrl);
      downloadObjectUrl = '';
      downloadLink?.classList.add('hidden');
    }

    function syncControls() {
      setColor(colorInput.value);
      toleranceText.value = String(readTolerance());
      previewZoomText.value = `${readZoom()}x`;
    }

    function applyPreviewBackground() {
      const value = previewBgInput?.value || 'checker';
      const canvases = [originalCanvas, resultCanvas];
      canvases.forEach((canvas) => {
        canvas.style.backgroundColor = '';
        canvas.style.backgroundImage = '';
        canvas.style.backgroundSize = '';
        canvas.style.backgroundPosition = '';
        if (value === 'white') {
          canvas.style.backgroundColor = '#ffffff';
        } else if (value === 'dark') {
          canvas.style.backgroundColor = '#1f2937';
        } else if (value === 'checker') {
          canvas.style.backgroundColor = '#ffffff';
          canvas.style.backgroundImage = 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)';
          canvas.style.backgroundSize = '20px 20px';
          canvas.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
        }
      });
    }

    function applyPreviewZoom() {
      const zoom = readZoom();
      [originalCanvas, resultCanvas].forEach((canvas) => {
        if (!canvas.width || !canvas.height) return;
        canvas.style.width = `${canvas.width * zoom}px`;
        canvas.style.height = `${canvas.height * zoom}px`;
        canvas.style.maxWidth = 'none';
        canvas.style.imageRendering = zoom > 1 ? 'pixelated' : 'auto';
      });
      previewZoomText.value = `${zoom}x`;
    }

    function resetPreviewPosition() {
      [originalWrap, resultWrap].forEach((wrap) => {
        if (!wrap) return;
        wrap.scrollLeft = 0;
        wrap.scrollTop = 0;
      });
    }

    function installDragPan(wrap) {
      if (!wrap || wrap.dataset.panBound === 'true') return;
      wrap.dataset.panBound = 'true';

      let isDragging = false;
      let pointerId = null;
      let startX = 0;
      let startY = 0;
      let startScrollLeft = 0;
      let startScrollTop = 0;

      wrap.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        isDragging = true;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
        startScrollLeft = wrap.scrollLeft;
        startScrollTop = wrap.scrollTop;
        wrap.dataset.dragMoved = 'false';
        wrap.style.cursor = 'grabbing';
        wrap.setPointerCapture?.(event.pointerId);
      });

      wrap.addEventListener('pointermove', (event) => {
        if (!isDragging || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) + Math.abs(dy) > 4) wrap.dataset.dragMoved = 'true';
        wrap.scrollLeft = startScrollLeft - dx;
        wrap.scrollTop = startScrollTop - dy;
        event.preventDefault();
      });

      const stopDrag = (event) => {
        if (!isDragging || event.pointerId !== pointerId) return;
        isDragging = false;
        pointerId = null;
        wrap.style.cursor = 'grab';
        wrap.releasePointerCapture?.(event.pointerId);
        window.setTimeout(() => {
          wrap.dataset.dragMoved = 'false';
        }, 80);
      };

      wrap.addEventListener('pointerup', stopDrag);
      wrap.addEventListener('pointercancel', stopDrag);
      wrap.addEventListener('lostpointercapture', () => {
        isDragging = false;
        pointerId = null;
        wrap.style.cursor = 'grab';
      });
    }

    function drawImageToCanvases() {
      if (!image) return;
      originalCanvas.width = image.naturalWidth || image.width;
      originalCanvas.height = image.naturalHeight || image.height;
      resultCanvas.width = originalCanvas.width;
      resultCanvas.height = originalCanvas.height;

      originalCtx.imageSmoothingEnabled = false;
      resultCtx.imageSmoothingEnabled = false;
      originalCtx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
      resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      originalCtx.drawImage(image, 0, 0);
      resultCtx.drawImage(image, 0, 0);
      applyPreviewBackground();
      applyPreviewZoom();
      resetPreviewPosition();
    }

    function updateDownload() {
      revokeDownloadUrl();
      resultCanvas.toBlob((blob) => {
        if (!blob) {
          setStatus('PNG 생성에 실패했습니다.');
          return;
        }
        downloadObjectUrl = URL.createObjectURL(blob);
        downloadLink.href = downloadObjectUrl;
        downloadLink.download = `${imageName}-transparent.png`;
        downloadLink.classList.remove('hidden');
      }, 'image/png');
    }

    function removeSelectedColor() {
      if (!image) {
        setStatus('먼저 이미지를 선택하세요.');
        return;
      }

      syncControls();
      revokeDownloadUrl();
      resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
      resultCtx.drawImage(image, 0, 0);

      const imageData = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
      const data = imageData.data;
      const target = hexToRgb(colorInput.value);
      const tolerance = readTolerance();
      const strength = readStrength();
      let removed = 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if (colorWithinTolerance(data, i, target, tolerance)) {
          data[i + 3] = 0;
          removed += 1;
        }
      }

      let cleanupRemoved = 0;
      if (cleanupInput?.checked) {
        cleanupRemoved = cleanupEdgePixels(data, resultCanvas.width, resultCanvas.height, target, tolerance, strength);
        removed += cleanupRemoved;
      }

      resultCtx.putImageData(imageData, 0, 0);
      updateDownload();
      applyPreviewBackground();
      applyPreviewZoom();

      const total = resultCanvas.width * resultCanvas.height;
      const ratio = total ? ((removed / total) * 100).toFixed(2) : '0.00';
      const cleanupText = cleanupRemoved ? ` / 가장자리 ${cleanupRemoved.toLocaleString()}픽셀 추가 정리` : '';
      setStatus(`${colorInput.value} 색상 기준으로 ${removed.toLocaleString()}픽셀을 투명 처리했습니다. (${ratio}%)${cleanupText}`);
    }

    function autoApply() {
      syncControls();
      if (image && autoApplyInput?.checked) removeSelectedColor();
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      revokeDownloadUrl();

      imageName = file.name.replace(/\.[^.]+$/, '') || 'transparent-background';
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      image.onload = () => {
        drawImageToCanvases();
        setStatus(`로드 완료: ${file.name} / ${originalCanvas.width}x${originalCanvas.height}. 짧게 터치하면 색상 선택, 터치 드래그하면 미리보기를 이동합니다.`);
      };
      image.onerror = () => {
        image = null;
        setStatus('이미지를 불러오지 못했습니다.');
      };
      image.src = objectUrl;
    });

    colorInput.addEventListener('input', autoApply);
    toleranceInput.addEventListener('input', autoApply);
    strengthInput?.addEventListener('change', autoApply);
    previewBgInput?.addEventListener('change', applyPreviewBackground);
    previewZoomInput?.addEventListener('input', () => {
      syncControls();
      applyPreviewZoom();
    });
    cleanupInput?.addEventListener('change', autoApply);
    applyButton.addEventListener('click', removeSelectedColor);
    resetViewButton?.addEventListener('click', resetPreviewPosition);

    originalCanvas.addEventListener('click', (event) => {
      if (!image || !originalCanvas.width || !originalCanvas.height) return;
      if (originalWrap?.dataset.dragMoved === 'true') return;
      const rect = originalCanvas.getBoundingClientRect();
      const scaleX = originalCanvas.width / rect.width;
      const scaleY = originalCanvas.height / rect.height;
      const x = Math.max(0, Math.min(originalCanvas.width - 1, Math.floor((event.clientX - rect.left) * scaleX)));
      const y = Math.max(0, Math.min(originalCanvas.height - 1, Math.floor((event.clientY - rect.top) * scaleY)));
      const pixel = originalCtx.getImageData(x, y, 1, 1).data;
      setColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
      removeSelectedColor();
    });

    installDragPan(originalWrap);
    installDragPan(resultWrap);
    syncControls();
    applyPreviewBackground();
    applyPreviewZoom();
  }

  function installBackgroundRemover() {
    addBackgroundRemoverNav();
    addBackgroundRemoverView();
    initBackgroundRemover();
  }

  window.SpriteToolShell = { showView, closeMenu, openMenu };

  installBackgroundRemover();

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.nav-btn');
    if (button?.dataset?.view) showView(button.dataset.view);
  });

  menuButton?.addEventListener('click', toggleMenu);
  menuOverlay?.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  showView('sprite');
})();
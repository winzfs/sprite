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
              <label>허용 오차 <input id="bgRemoveTolerance" type="range" min="0" max="100" value="8"></label>
            </div>
            <div class="grid-2">
              <label>현재 색상값 <input id="bgRemoveColorText" type="text" value="#00ff00" readonly></label>
              <label>현재 오차값 <input id="bgRemoveToleranceText" type="text" value="8" readonly></label>
            </div>
            <div class="button-row">
              <button id="bgRemoveApplyButton" type="button" class="primary">투명 처리</button>
              <a id="bgRemoveDownloadLink" class="download-link hidden" download="transparent-background.png">PNG 다운로드</a>
            </div>
            <div id="bgRemoveStatus" class="status">이미지를 올린 뒤 색상 피커로 지울 색을 선택하세요. 원본 미리보기를 클릭하면 클릭한 픽셀 색상도 선택됩니다.</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">원본 / 결과 미리보기</div>
          <div class="panel-body controls">
            <div class="grid-2">
              <div>
                <div class="sub-title">원본 클릭 색상 추출</div>
                <canvas id="bgRemoveOriginalCanvas" class="media-canvas"></canvas>
              </div>
              <div>
                <div class="sub-title">투명 처리 결과</div>
                <canvas id="bgRemoveResultCanvas" class="media-canvas"></canvas>
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
    const applyButton = document.getElementById('bgRemoveApplyButton');
    const downloadLink = document.getElementById('bgRemoveDownloadLink');
    const status = document.getElementById('bgRemoveStatus');
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
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
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

    function revokeDownloadUrl() {
      if (downloadObjectUrl) URL.revokeObjectURL(downloadObjectUrl);
      downloadObjectUrl = '';
      downloadLink?.classList.add('hidden');
    }

    function syncControls() {
      setColor(colorInput.value);
      toleranceText.value = String(readTolerance());
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
      let removed = 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const dr = Math.abs(data[i] - target.r);
        const dg = Math.abs(data[i + 1] - target.g);
        const db = Math.abs(data[i + 2] - target.b);
        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
          data[i + 3] = 0;
          removed += 1;
        }
      }

      resultCtx.putImageData(imageData, 0, 0);
      updateDownload();

      const total = resultCanvas.width * resultCanvas.height;
      const ratio = total ? ((removed / total) * 100).toFixed(2) : '0.00';
      setStatus(`${colorInput.value} 색상 기준으로 ${removed.toLocaleString()}픽셀을 투명 처리했습니다. (${ratio}%)`);
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
        setStatus(`로드 완료: ${file.name} / ${originalCanvas.width}x${originalCanvas.height}. 색상을 고른 뒤 투명 처리하세요.`);
      };
      image.onerror = () => {
        image = null;
        setStatus('이미지를 불러오지 못했습니다.');
      };
      image.src = objectUrl;
    });

    colorInput.addEventListener('input', () => {
      syncControls();
      if (image) removeSelectedColor();
    });
    toleranceInput.addEventListener('input', () => {
      syncControls();
      if (image) removeSelectedColor();
    });
    applyButton.addEventListener('click', removeSelectedColor);

    originalCanvas.addEventListener('click', (event) => {
      if (!image || !originalCanvas.width || !originalCanvas.height) return;
      const rect = originalCanvas.getBoundingClientRect();
      const scaleX = originalCanvas.width / rect.width;
      const scaleY = originalCanvas.height / rect.height;
      const x = Math.max(0, Math.min(originalCanvas.width - 1, Math.floor((event.clientX - rect.left) * scaleX)));
      const y = Math.max(0, Math.min(originalCanvas.height - 1, Math.floor((event.clientY - rect.top) * scaleY)));
      const pixel = originalCtx.getImageData(x, y, 1, 1).data;
      setColor(rgbToHex(pixel[0], pixel[1], pixel[2]));
      removeSelectedColor();
    });

    syncControls();
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
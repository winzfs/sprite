(() => {
  const VIEW_KEY = 'audioConverter';
  const LOCAL_MP3_FORMAT = 'mp3-lame';
  let lastDecoded = null;
  let lastFile = null;

  const recorderFormats = [
    { value: 'audio/mp4;codecs=mp4a.40.2', label: 'M4A / AAC' },
    { value: 'audio/mp4', label: 'MP4 Audio / M4A' },
    { value: 'audio/aac', label: 'AAC' },
    { value: 'audio/webm;codecs=opus', label: 'WebM / Opus' },
    { value: 'audio/ogg;codecs=opus', label: 'Ogg / Opus' },
    { value: 'audio/webm', label: 'WebM' },
    { value: 'audio/ogg', label: 'Ogg' },
  ];

  const $ = (id) => document.getElementById(id);

  function setStatus(message) {
    const status = $('audioStatus');
    if (status) status.textContent = message;
  }

  function readNumber(input, fallback) {
    const value = Number.parseFloat(input?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    $('menuToggleButton')?.setAttribute('aria-expanded', 'false');
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

  function addNav() {
    if (document.querySelector(`[data-view="${VIEW_KEY}"]`)) return;
    const mediaGroup = Array.from(document.querySelectorAll('.nav-group')).find((group) => group.querySelector('[data-view="videoToGif"]'));
    const items = mediaGroup?.querySelector('.nav-group-items');
    if (!items) return;

    const button = document.createElement('button');
    button.className = 'nav-btn';
    button.type = 'button';
    button.dataset.view = VIEW_KEY;
    button.textContent = '음원 변환';
    button.addEventListener('click', () => showView(VIEW_KEY));

    const help = items.querySelector('.nav-help');
    if (help) items.insertBefore(button, help);
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
        <h1>음원 변환</h1>
        <p>MP3, WAV 등 브라우저가 디코딩할 수 있는 오디오를 로컬에서 변환합니다. 서버 업로드는 없습니다.</p>
      </header>
      <main class="converter-layout">
        <section class="panel">
          <div class="panel-title">변환 설정</div>
          <div class="panel-body controls">
            <label>오디오 파일 <input id="audioInput" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/webm,audio/mp4,audio/aac,audio/flac,audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac,.flac"></label>
            <div class="grid-2">
              <label>출력 포맷
                <select id="audioFormatInput">
                  <option value="wav">WAV / PCM 16-bit</option>
                </select>
              </label>
              <label>비트전송률(kbps) <input id="audioBitrateInput" type="number" min="32" max="512" step="16" value="128"></label>
            </div>
            <div class="grid-2">
              <label>샘플레이트
                <select id="audioSampleRateInput">
                  <option value="0">원본 유지</option>
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                  <option value="32000">32 kHz</option>
                  <option value="22050">22.05 kHz</option>
                </select>
              </label>
              <label>채널
                <select id="audioChannelsInput">
                  <option value="0">원본 유지</option>
                  <option value="1">모노</option>
                  <option value="2">스테레오</option>
                </select>
              </label>
            </div>
            <pre id="audioEstimateInfo" class="media-info">출력 예상 정보: 파일을 선택하세요.</pre>
            <div class="button-row">
              <button id="audioReadButton" type="button">정보 읽기</button>
              <button id="audioConvertButton" type="button" class="primary">변환</button>
              <a id="audioDownloadLink" class="download-link hidden" download="converted.wav">다운로드</a>
            </div>
            <progress id="audioProgress" value="0" max="1"></progress>
            <div id="audioStatus" class="status">지원 입력: MP3, WAV, Ogg, WebM, M4A/AAC, FLAC 등. MP3는 저장소 내 로컬 인코더를 사용합니다.</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">미리보기 / 정보</div>
          <div class="panel-body controls">
            <audio id="audioPreview" class="audio-preview" controls></audio>
            <pre id="audioInfo" class="media-info">파일을 선택하세요.</pre>
            <pre id="audioOutputInfo" class="media-info">출력 결과 정보: 아직 변환 전입니다.</pre>
          </div>
        </section>
      </main>
    `;
    main.append(section);
  }

  function addOption(select, value, label) {
    if (!select || select.querySelector(`option[value="${value}"]`)) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  function populateFormats() {
    const select = $('audioFormatInput');
    if (!select) return;

    if (window.SpriteMp3Encoder?.isAvailable?.()) {
      addOption(select, LOCAL_MP3_FORMAT, 'MP3 / LAME 로컬');
    }

    recorderFormats.forEach((format) => {
      if (!window.MediaRecorder?.isTypeSupported?.(format.value)) return;
      addOption(select, format.value, format.label);
    });
  }

  async function decodeFile(file) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('이 브라우저는 Web Audio API를 지원하지 않습니다.');
    const context = new AudioContextClass();
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await context.decodeAudioData(arrayBuffer);
    } finally {
      await context.close().catch(() => {});
    }
  }

  function getTargetSpec(buffer) {
    const sampleRate = Math.round(readNumber($('audioSampleRateInput'), 0)) || buffer?.sampleRate || 44100;
    const channels = Math.round(readNumber($('audioChannelsInput'), 0)) || buffer?.numberOfChannels || 2;
    const format = $('audioFormatInput')?.value || 'wav';
    const maxBitrate = format === LOCAL_MP3_FORMAT ? 320 : 512;
    const bitrate = Math.max(32, Math.min(maxBitrate, Math.round(readNumber($('audioBitrateInput'), 128))));
    return { sampleRate, channels, format, bitrate };
  }

  function outputExtension(format) {
    if (format === 'wav') return 'wav';
    if (format === LOCAL_MP3_FORMAT || format.includes('mpeg') || format.includes('mp3')) return 'mp3';
    if (format.includes('ogg')) return 'ogg';
    if (format.includes('mp4')) return 'm4a';
    if (format.includes('aac')) return 'aac';
    return 'webm';
  }

  function outputFormatLabel(format) {
    if (format === 'wav') return 'WAV / PCM 16-bit';
    if (format === LOCAL_MP3_FORMAT) return 'MP3 / LAME 로컬';
    const match = recorderFormats.find((item) => item.value === format);
    return match ? match.label : format;
  }

  function estimateOutputBytes(buffer) {
    if (!buffer) return null;
    const { sampleRate, channels, format, bitrate } = getTargetSpec(buffer);
    if (format === 'wav') {
      return 44 + Math.ceil(buffer.duration * sampleRate) * channels * 2;
    }
    return Math.ceil((buffer.duration * bitrate * 1000) / 8);
  }

  function updateEstimate() {
    const estimate = $('audioEstimateInfo');
    if (!estimate) return;
    if (!lastDecoded) {
      estimate.textContent = '출력 예상 정보: 파일을 선택하세요.';
      return;
    }

    const { sampleRate, channels, format, bitrate } = getTargetSpec(lastDecoded);
    const estimatedBytes = estimateOutputBytes(lastDecoded);
    const ext = outputExtension(format);
    const isCompressed = format !== 'wav';
    const note = format === LOCAL_MP3_FORMAT
      ? '참고: MP3는 저장소 내 로컬 LAME 인코더로 생성합니다.'
      : (isCompressed ? '참고: 압축 포맷 실제 용량은 브라우저 인코더에 따라 달라질 수 있습니다.' : '참고: WAV는 무압축이라 예상 용량과 실제 용량이 거의 같습니다.');

    estimate.textContent = [
      '출력 예상 정보',
      `예상 포맷: ${outputFormatLabel(format)}`,
      `예상 확장자: .${ext}`,
      `예상 샘플레이트: ${sampleRate} Hz`,
      `예상 채널: ${channels}`,
      isCompressed ? `목표 비트전송률: ${bitrate} kbps` : '비트전송률: WAV PCM은 설정값을 사용하지 않음',
      `예상 용량: 약 ${formatBytes(estimatedBytes)}`,
      note,
    ].join('\n');
  }

  function updateInfo(file, buffer) {
    const info = $('audioInfo');
    if (!info) return;
    const sourceBitrate = buffer.duration > 0 ? (file.size * 8 / buffer.duration / 1000) : 0;
    info.textContent = [
      '입력 정보',
      `파일명: ${file.name}`,
      `입력 용량: ${formatBytes(file.size)}`,
      `입력 평균 비트전송률: 약 ${sourceBitrate.toFixed(0)} kbps`,
      `길이: ${buffer.duration.toFixed(2)}초`,
      `샘플레이트: ${buffer.sampleRate} Hz`,
      `채널: ${buffer.numberOfChannels}`,
    ].join('\n');
    lastFile = file;
    lastDecoded = buffer;
    updateEstimate();
  }

  function updateOutputInfo({ file, blob, format, rendered, ext }) {
    const outputInfo = $('audioOutputInfo');
    if (!outputInfo) return;
    const bitrate = rendered.duration > 0 ? (blob.size * 8 / rendered.duration / 1000) : 0;
    const sourceSize = file?.size || 0;
    const ratio = sourceSize > 0 ? (blob.size / sourceSize) * 100 : 0;
    outputInfo.textContent = [
      '출력 결과 정보',
      `파일명: ${(file?.name || 'converted').replace(/\.[^.]+$/, '')}.${ext}`,
      `실제 용량: ${formatBytes(blob.size)}`,
      `입력 대비: ${ratio.toFixed(1)}%`,
      `실제 평균 비트전송률: 약 ${bitrate.toFixed(0)} kbps`,
      `출력 포맷: ${outputFormatLabel(format)}`,
      `출력 샘플레이트: ${rendered.sampleRate} Hz`,
      `출력 채널: ${rendered.numberOfChannels}`,
      `길이: ${rendered.duration.toFixed(2)}초`,
    ].join('\n');
  }

  async function renderBuffer(sourceBuffer) {
    const requestedSampleRate = Math.round(readNumber($('audioSampleRateInput'), 0));
    const requestedChannels = Math.round(readNumber($('audioChannelsInput'), 0));
    const sampleRate = requestedSampleRate || sourceBuffer.sampleRate;
    const channels = requestedChannels || sourceBuffer.numberOfChannels;
    const length = Math.max(1, Math.ceil(sourceBuffer.duration * sampleRate));
    const offline = new OfflineAudioContext(channels, length, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = sourceBuffer;
    source.connect(offline.destination);
    source.start(0);
    return offline.startRendering();
  }

  function writeText(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function encodeWav(buffer) {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;
    const bytesPerSample = 2;
    const blockAlign = channels * bytesPerSample;
    const dataSize = samples * blockAlign;
    const output = new ArrayBuffer(44 + dataSize);
    const view = new DataView(output);

    writeText(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeText(view, 8, 'WAVE');
    writeText(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeText(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const data = [];
    for (let channel = 0; channel < channels; channel += 1) data.push(buffer.getChannelData(channel));
    let offset = 44;
    for (let i = 0; i < samples; i += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, data[channel][i] || 0));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([output], { type: 'audio/wav' });
  }

  function recordCompressed(buffer, mimeType, bitrateKbps) {
    return new Promise(async (resolve, reject) => {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass({ sampleRate: buffer.sampleRate });
      const source = context.createBufferSource();
      const destination = context.createMediaStreamDestination();
      const chunks = [];
      let recorder;

      try {
        recorder = new MediaRecorder(destination.stream, {
          mimeType,
          audioBitsPerSecond: bitrateKbps * 1000,
        });
      } catch (error) {
        await context.close().catch(() => {});
        reject(error);
        return;
      }

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      });
      recorder.addEventListener('stop', async () => {
        destination.stream.getTracks().forEach((track) => track.stop());
        await context.close().catch(() => {});
        resolve(new Blob(chunks, { type: mimeType }));
      }, { once: true });

      source.buffer = buffer;
      source.connect(destination);
      source.addEventListener('ended', () => setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 120), { once: true });
      recorder.start();
      source.start(0);
      await context.resume();
    });
  }

  function setDownload(blob, fileName) {
    const link = $('audioDownloadLink');
    if (!link) return;
    if (link.dataset.objectUrl) URL.revokeObjectURL(link.dataset.objectUrl);
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    link.dataset.objectUrl = url;
    link.classList.remove('hidden');
  }

  async function readInfo() {
    const input = $('audioInput');
    const file = input?.files?.[0];
    if (!file) {
      setStatus('먼저 오디오 파일을 선택하세요.');
      return;
    }
    try {
      setStatus('오디오 정보를 읽는 중...');
      const buffer = await decodeFile(file);
      updateInfo(file, buffer);
      setStatus('오디오 정보 읽기 완료');
    } catch (error) {
      setStatus(`오디오 정보 읽기 실패: ${error.message}`);
    }
  }

  async function convert() {
    const input = $('audioInput');
    const file = input?.files?.[0];
    const convertButton = $('audioConvertButton');
    const progress = $('audioProgress');
    if (!file) {
      setStatus('먼저 오디오 파일을 선택하세요.');
      return;
    }

    try {
      convertButton.disabled = true;
      progress.value = 0;
      $('audioDownloadLink')?.classList.add('hidden');
      $('audioOutputInfo').textContent = '출력 결과 정보: 변환 중...';
      setStatus('오디오 디코딩 중...');
      const decoded = await decodeFile(file);
      updateInfo(file, decoded);
      progress.value = 0.15;

      setStatus('샘플레이트/채널 변환 중...');
      const rendered = await renderBuffer(decoded);
      progress.value = 0.35;

      const format = $('audioFormatInput').value;
      const bitrate = Math.max(32, Math.min(format === LOCAL_MP3_FORMAT ? 320 : 512, Math.round(readNumber($('audioBitrateInput'), 128))));
      let blob;
      let ext;
      if (format === 'wav') {
        setStatus('WAV 생성 중...');
        blob = encodeWav(rendered);
        ext = 'wav';
      } else if (format === LOCAL_MP3_FORMAT) {
        if (!window.SpriteMp3Encoder?.isAvailable?.()) throw new Error('로컬 MP3 인코더가 로드되지 않았습니다.');
        setStatus(`MP3 생성 중... ${bitrate}kbps`);
        blob = await window.SpriteMp3Encoder.encode(rendered, bitrate, (ratio) => {
          progress.value = 0.35 + Math.min(0.6, ratio * 0.6);
        });
        ext = 'mp3';
      } else {
        if (!window.MediaRecorder?.isTypeSupported?.(format)) throw new Error(`${format} 출력은 이 브라우저에서 지원하지 않습니다.`);
        setStatus(`압축 오디오 생성 중... ${bitrate}kbps`);
        blob = await recordCompressed(rendered, format, bitrate);
        ext = outputExtension(format);
      }

      progress.value = 1;
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'converted';
      setDownload(blob, `${baseName}.${ext}`);
      updateOutputInfo({ file, blob, format, rendered, ext });
      setStatus(`변환 완료: ${formatBytes(blob.size)}`);
    } catch (error) {
      setStatus(`오디오 변환 실패: ${error.message}`);
    } finally {
      convertButton.disabled = false;
    }
  }

  function bind() {
    const input = $('audioInput');
    if (!input || input.dataset.bound === 'true') return;
    input.dataset.bound = 'true';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const preview = $('audioPreview');
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      const url = URL.createObjectURL(file);
      preview.src = url;
      preview.dataset.objectUrl = url;
      $('audioOutputInfo').textContent = '출력 결과 정보: 아직 변환 전입니다.';
      readInfo();
    });
    $('audioReadButton')?.addEventListener('click', readInfo);
    $('audioConvertButton')?.addEventListener('click', convert);
    $('audioFormatInput')?.addEventListener('change', updateEstimate);
    $('audioBitrateInput')?.addEventListener('input', updateEstimate);
    $('audioSampleRateInput')?.addEventListener('change', updateEstimate);
    $('audioChannelsInput')?.addEventListener('change', updateEstimate);
  }

  addNav();
  addView();
  populateFormats();
  bind();
})();

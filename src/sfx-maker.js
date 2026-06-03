(() => {
  const VIEW_KEY = 'sfxMaker';
  const STYLE_ID = 'sfxMakerStyle';
  let audioContext = null;
  let currentSource = null;
  let lastBuffer = null;
  let downloadUrl = '';

  const presets = [
    { id: 'ui-click', icon: '🖱️', name: 'UI 클릭', desc: '짧고 또렷한 버튼 클릭음', wave: 'square', duration: 0.08, startFreq: 920, endFreq: 520, volume: 0.45, attack: 0.002, decay: 0.045, sustain: 0.08, release: 0.02, noise: 0.04, vibratoDepth: 0, vibratoRate: 0, filter: 5200, punch: 0.45, bitcrush: 0 },
    { id: 'ui-confirm', icon: '✅', name: '확인', desc: '가볍고 긍정적인 확인음', wave: 'sine', duration: 0.18, startFreq: 660, endFreq: 980, volume: 0.55, attack: 0.006, decay: 0.08, sustain: 0.35, release: 0.05, noise: 0, vibratoDepth: 0.02, vibratoRate: 7, filter: 7200, punch: 0.2, bitcrush: 0 },
    { id: 'ui-cancel', icon: '↩️', name: '취소', desc: '낮게 떨어지는 취소/뒤로가기', wave: 'triangle', duration: 0.16, startFreq: 520, endFreq: 260, volume: 0.5, attack: 0.004, decay: 0.07, sustain: 0.2, release: 0.05, noise: 0.02, vibratoDepth: 0, vibratoRate: 0, filter: 4800, punch: 0.25, bitcrush: 0 },
    { id: 'notify', icon: '🔔', name: '알림', desc: '맑은 2단 알림음', wave: 'sine', duration: 0.32, startFreq: 880, endFreq: 1320, volume: 0.5, attack: 0.004, decay: 0.1, sustain: 0.35, release: 0.08, noise: 0, vibratoDepth: 0.01, vibratoRate: 9, filter: 9000, punch: 0.1, bitcrush: 0, arpeggio: '0,7' },
    { id: 'coin', icon: '🪙', name: '코인 획득', desc: '게임 재화 획득 느낌', wave: 'square', duration: 0.26, startFreq: 760, endFreq: 1520, volume: 0.55, attack: 0.002, decay: 0.08, sustain: 0.25, release: 0.05, noise: 0.02, vibratoDepth: 0, vibratoRate: 0, filter: 6200, punch: 0.4, bitcrush: 0.12, arpeggio: '0,7,12' },
    { id: 'jump', icon: '🦘', name: '점프', desc: '통통 튀는 상승 피치', wave: 'square', duration: 0.22, startFreq: 240, endFreq: 760, volume: 0.48, attack: 0.003, decay: 0.08, sustain: 0.25, release: 0.04, noise: 0.02, vibratoDepth: 0.015, vibratoRate: 10, filter: 5400, punch: 0.18, bitcrush: 0.08 },
    { id: 'land', icon: '👣', name: '착지', desc: '낮고 짧은 둔탁함', wave: 'sine', duration: 0.13, startFreq: 170, endFreq: 90, volume: 0.55, attack: 0.001, decay: 0.06, sustain: 0.12, release: 0.04, noise: 0.22, vibratoDepth: 0, vibratoRate: 0, filter: 1500, punch: 0.7, bitcrush: 0.04 },
    { id: 'hit-soft', icon: '👊', name: '가벼운 타격', desc: '짧은 펀치/피격음', wave: 'triangle', duration: 0.12, startFreq: 210, endFreq: 120, volume: 0.62, attack: 0.001, decay: 0.055, sustain: 0.08, release: 0.035, noise: 0.35, vibratoDepth: 0, vibratoRate: 0, filter: 2400, punch: 0.9, bitcrush: 0.1 },
    { id: 'hit-heavy', icon: '💥', name: '강한 타격', desc: '무게감 있는 충돌음', wave: 'sine', duration: 0.22, startFreq: 160, endFreq: 58, volume: 0.8, attack: 0.001, decay: 0.09, sustain: 0.18, release: 0.06, noise: 0.55, vibratoDepth: 0.01, vibratoRate: 18, filter: 1800, punch: 1, bitcrush: 0.08 },
    { id: 'explosion', icon: '💣', name: '폭발', desc: '노이즈 중심의 폭발 효과', wave: 'noise', duration: 0.55, startFreq: 90, endFreq: 42, volume: 0.82, attack: 0.001, decay: 0.18, sustain: 0.35, release: 0.18, noise: 0.95, vibratoDepth: 0.02, vibratoRate: 8, filter: 1200, punch: 1, bitcrush: 0.18 },
    { id: 'laser', icon: '🔫', name: '레이저', desc: '빠르게 내려가는 SF 레이저', wave: 'sawtooth', duration: 0.24, startFreq: 1700, endFreq: 240, volume: 0.58, attack: 0.001, decay: 0.08, sustain: 0.22, release: 0.055, noise: 0.04, vibratoDepth: 0.02, vibratoRate: 22, filter: 6200, punch: 0.45, bitcrush: 0.05 },
    { id: 'power-up', icon: '⚡', name: '파워업', desc: '상승 아르페지오 강화음', wave: 'square', duration: 0.48, startFreq: 420, endFreq: 1320, volume: 0.58, attack: 0.004, decay: 0.12, sustain: 0.42, release: 0.08, noise: 0.02, vibratoDepth: 0.015, vibratoRate: 8, filter: 7000, punch: 0.22, bitcrush: 0.06, arpeggio: '0,4,7,12' },
    { id: 'power-down', icon: '🪫', name: '파워다운', desc: '힘 빠지는 하강음', wave: 'triangle', duration: 0.44, startFreq: 680, endFreq: 110, volume: 0.5, attack: 0.006, decay: 0.15, sustain: 0.32, release: 0.12, noise: 0.05, vibratoDepth: 0.018, vibratoRate: 6, filter: 3600, punch: 0.1, bitcrush: 0.08 },
    { id: 'heal', icon: '💚', name: '힐', desc: '부드러운 회복/힐링 사운드', wave: 'sine', duration: 0.55, startFreq: 520, endFreq: 1040, volume: 0.46, attack: 0.02, decay: 0.18, sustain: 0.5, release: 0.16, noise: 0, vibratoDepth: 0.025, vibratoRate: 5, filter: 9000, punch: 0.05, bitcrush: 0, arpeggio: '0,5,9,12' },
    { id: 'magic', icon: '✨', name: '마법 시전', desc: '반짝이는 주문 시전음', wave: 'sine', duration: 0.62, startFreq: 360, endFreq: 1420, volume: 0.5, attack: 0.015, decay: 0.2, sustain: 0.45, release: 0.18, noise: 0.12, vibratoDepth: 0.035, vibratoRate: 11, filter: 7800, punch: 0.12, bitcrush: 0.02, arpeggio: '0,3,7,10,14' },
    { id: 'success', icon: '🏆', name: '강화 성공', desc: '성공 팡파르 느낌', wave: 'square', duration: 0.7, startFreq: 520, endFreq: 1560, volume: 0.58, attack: 0.004, decay: 0.18, sustain: 0.5, release: 0.14, noise: 0.05, vibratoDepth: 0.012, vibratoRate: 8, filter: 7600, punch: 0.24, bitcrush: 0.04, arpeggio: '0,4,7,12,16' },
    { id: 'fail', icon: '💔', name: '강화 실패', desc: '불길하게 떨어지는 실패음', wave: 'sawtooth', duration: 0.56, startFreq: 440, endFreq: 70, volume: 0.62, attack: 0.006, decay: 0.16, sustain: 0.35, release: 0.14, noise: 0.18, vibratoDepth: 0.025, vibratoRate: 7, filter: 2800, punch: 0.25, bitcrush: 0.12 },
    { id: 'warning', icon: '🚨', name: '경고', desc: '긴장감 있는 경고음', wave: 'square', duration: 0.65, startFreq: 620, endFreq: 620, volume: 0.55, attack: 0.004, decay: 0.12, sustain: 0.62, release: 0.08, noise: 0.02, vibratoDepth: 0.06, vibratoRate: 5.5, filter: 5000, punch: 0.15, bitcrush: 0.02 },
    { id: 'glitch', icon: '📡', name: '글리치', desc: '깨지는 전자 노이즈', wave: 'sawtooth', duration: 0.33, startFreq: 920, endFreq: 180, volume: 0.62, attack: 0.001, decay: 0.12, sustain: 0.24, release: 0.06, noise: 0.42, vibratoDepth: 0.08, vibratoRate: 30, filter: 4400, punch: 0.5, bitcrush: 0.55 },
    { id: 'menu-open', icon: '📂', name: '메뉴 열림', desc: '작게 펼쳐지는 UI 사운드', wave: 'triangle', duration: 0.21, startFreq: 380, endFreq: 760, volume: 0.42, attack: 0.003, decay: 0.08, sustain: 0.28, release: 0.04, noise: 0.01, vibratoDepth: 0.005, vibratoRate: 8, filter: 6200, punch: 0.1, bitcrush: 0, arpeggio: '0,5' },
    { id: 'menu-close', icon: '📁', name: '메뉴 닫힘', desc: '짧게 접히는 UI 사운드', wave: 'triangle', duration: 0.18, startFreq: 740, endFreq: 360, volume: 0.42, attack: 0.003, decay: 0.07, sustain: 0.22, release: 0.045, noise: 0.01, vibratoDepth: 0.005, vibratoRate: 8, filter: 5200, punch: 0.1, bitcrush: 0 },
    { id: 'pickup', icon: '🎁', name: '아이템 획득', desc: '상큼한 아이템 픽업', wave: 'square', duration: 0.34, startFreq: 620, endFreq: 1240, volume: 0.52, attack: 0.003, decay: 0.1, sustain: 0.35, release: 0.08, noise: 0.03, vibratoDepth: 0.01, vibratoRate: 10, filter: 7200, punch: 0.25, bitcrush: 0.04, arpeggio: '0,7,12' },
    { id: 'typing', icon: '⌨️', name: '타이핑', desc: '짧은 텍스트 출력음', wave: 'square', duration: 0.045, startFreq: 780, endFreq: 690, volume: 0.28, attack: 0.001, decay: 0.025, sustain: 0.05, release: 0.01, noise: 0.05, vibratoDepth: 0, vibratoRate: 0, filter: 4800, punch: 0.35, bitcrush: 0.18 },
    { id: 'portal', icon: '🌀', name: '포탈', desc: '회전하는 공간 이동음', wave: 'sine', duration: 0.95, startFreq: 180, endFreq: 980, volume: 0.48, attack: 0.04, decay: 0.25, sustain: 0.55, release: 0.25, noise: 0.18, vibratoDepth: 0.08, vibratoRate: 3.5, filter: 6400, punch: 0.05, bitcrush: 0.03, arpeggio: '0,7,3,10,12' },
  ];

  const defaultParams = { ...presets[0] };

  function $(id) { return document.getElementById(id); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-${VIEW_KEY} .sfx-app { display:grid; gap:18px; }
      .sfx-hero { position:relative; overflow:hidden; border-radius:28px; padding:24px; color:#fff; background: radial-gradient(circle at 10% 10%, rgba(96,165,250,.7), transparent 34%), radial-gradient(circle at 90% 12%, rgba(236,72,153,.55), transparent 32%), linear-gradient(135deg,#111827,#312e81 52%,#0f172a); box-shadow:0 24px 70px rgba(15,23,42,.26); }
      .sfx-hero::after { content:''; position:absolute; inset:auto -80px -110px auto; width:240px; height:240px; border-radius:999px; background:rgba(255,255,255,.12); filter:blur(2px); }
      .sfx-hero-top { position:relative; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
      .sfx-kicker { display:inline-flex; align-items:center; gap:8px; padding:7px 11px; border-radius:999px; background:rgba(255,255,255,.16); font-weight:900; font-size:12px; letter-spacing:.02em; }
      .sfx-hero h1 { margin:12px 0 8px; font-size:34px; line-height:1.05; }
      .sfx-hero p { margin:0; max-width:720px; color:rgba(255,255,255,.78); }
      .sfx-transport { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
      .sfx-big-button { border:0; border-radius:18px; padding:14px 18px; font-weight:950; cursor:pointer; box-shadow:0 12px 30px rgba(0,0,0,.22); }
      .sfx-big-button.primary { color:#111827; background:#fff; }
      .sfx-big-button.dark { color:#fff; background:rgba(15,23,42,.75); border:1px solid rgba(255,255,255,.16); }
      .sfx-big-button.hot { color:#fff; background:linear-gradient(135deg,#f97316,#ec4899); }
      .sfx-main-grid { display:grid; grid-template-columns:minmax(280px, 1.05fr) minmax(300px, .95fr); gap:18px; align-items:start; }
      .sfx-card { border:1px solid rgba(148,163,184,.24); border-radius:24px; background:rgba(255,255,255,.9); box-shadow:0 16px 48px rgba(15,23,42,.08); overflow:hidden; }
      .sfx-card-head { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:16px 18px; border-bottom:1px solid rgba(148,163,184,.18); background:linear-gradient(180deg,rgba(248,250,252,.92),rgba(255,255,255,.72)); }
      .sfx-card-title { margin:0; font-size:16px; font-weight:950; color:#0f172a; }
      .sfx-card-sub { margin:4px 0 0; font-size:12px; color:#64748b; }
      .sfx-card-body { padding:16px; }
      .sfx-preset-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; max-height:500px; overflow:auto; padding-right:4px; }
      .sfx-preset { text-align:left; border:1px solid rgba(148,163,184,.28); border-radius:18px; padding:12px; background:linear-gradient(180deg,#fff,#f8fafc); cursor:pointer; transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
      .sfx-preset:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(15,23,42,.12); border-color:rgba(99,102,241,.45); }
      .sfx-preset.active { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.16), 0 12px 28px rgba(15,23,42,.12); }
      .sfx-preset-icon { font-size:23px; }
      .sfx-preset-name { margin-top:7px; font-weight:950; color:#111827; }
      .sfx-preset-desc { margin-top:4px; font-size:11px; color:#64748b; line-height:1.35; }
      .sfx-control-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .sfx-control { border:1px solid rgba(148,163,184,.22); border-radius:17px; padding:11px 12px; background:#fff; }
      .sfx-control.wide { grid-column:1 / -1; }
      .sfx-control label { display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:12px; color:#475569; font-weight:900; margin-bottom:8px; }
      .sfx-control output { color:#111827; font-variant-numeric:tabular-nums; }
      .sfx-control input[type='range'] { width:100%; accent-color:#6366f1; }
      .sfx-control select, .sfx-control input[type='text'] { width:100%; border:1px solid rgba(148,163,184,.45); border-radius:12px; padding:10px 11px; background:#fff; color:#111827; font-weight:800; }
      .sfx-wave-wrap { display:grid; gap:12px; }
      .sfx-screen { border-radius:20px; background:linear-gradient(180deg,#0f172a,#111827); padding:14px; border:1px solid rgba(15,23,42,.35); box-shadow:inset 0 0 0 1px rgba(255,255,255,.04); }
      #sfxWaveCanvas { display:block; width:100%; height:150px; border-radius:14px; background:linear-gradient(180deg,rgba(30,41,59,.8),rgba(15,23,42,.95)); }
      .sfx-readout { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
      .sfx-meter { border-radius:16px; padding:12px; background:#f8fafc; border:1px solid rgba(148,163,184,.22); }
      .sfx-meter small { display:block; color:#64748b; font-size:11px; font-weight:800; }
      .sfx-meter strong { display:block; margin-top:4px; color:#0f172a; font-size:18px; }
      .sfx-download { display:inline-flex; align-items:center; justify-content:center; text-decoration:none; border-radius:18px; padding:14px 16px; font-weight:950; color:#fff; background:linear-gradient(135deg,#4f46e5,#06b6d4); box-shadow:0 16px 36px rgba(79,70,229,.25); }
      .sfx-download.hidden { display:none; }
      .sfx-status { color:#64748b; font-size:12px; line-height:1.45; }
      @media (max-width: 960px) { .sfx-main-grid { grid-template-columns:1fr; } .sfx-hero h1 { font-size:28px; } }
      @media (max-width: 640px) { .sfx-control-grid { grid-template-columns:1fr; } .sfx-readout { grid-template-columns:1fr; } .sfx-hero { padding:18px; border-radius:22px; } .sfx-big-button { flex:1; } }
      @media (prefers-color-scheme: dark) {
        .sfx-card { background:rgba(17,24,39,.92); border-color:rgba(75,85,99,.45); }
        .sfx-card-head { background:linear-gradient(180deg,rgba(31,41,55,.92),rgba(17,24,39,.72)); border-color:rgba(75,85,99,.4); }
        .sfx-card-title, .sfx-preset-name, .sfx-control output, .sfx-meter strong { color:#f9fafb; }
        .sfx-card-sub, .sfx-preset-desc, .sfx-status, .sfx-meter small { color:#9ca3af; }
        .sfx-preset, .sfx-control, .sfx-meter { background:#111827; border-color:rgba(75,85,99,.5); }
        .sfx-control label { color:#d1d5db; }
        .sfx-control select, .sfx-control input[type='text'] { background:#0f172a; color:#f9fafb; border-color:#374151; }
      }
    `;
    document.head.append(style);
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
    button.textContent = '효과음 제작기';
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
      <div class="sfx-app">
        <section class="sfx-hero">
          <div class="sfx-hero-top">
            <div>
              <div class="sfx-kicker">🎛️ Web Audio SFX Studio</div>
              <h1>효과음 제작기</h1>
              <p>프리셋을 고르고 피치, 감쇠, 노이즈, 필터를 조절해 게임/웹/디스코드용 효과음을 바로 만들고 WAV로 저장합니다.</p>
            </div>
            <div class="sfx-transport">
              <button id="sfxPreviewButton" class="sfx-big-button primary" type="button">▶ 미리듣기</button>
              <button id="sfxStopButton" class="sfx-big-button dark" type="button">■ 정지</button>
              <button id="sfxRandomButton" class="sfx-big-button hot" type="button">🎲 랜덤</button>
            </div>
          </div>
        </section>

        <main class="sfx-main-grid">
          <section class="sfx-card">
            <div class="sfx-card-head">
              <div><h2 class="sfx-card-title">프리셋</h2><p class="sfx-card-sub">카드를 누르면 앱처럼 바로 세팅됩니다.</p></div>
            </div>
            <div class="sfx-card-body"><div id="sfxPresetGrid" class="sfx-preset-grid"></div></div>
          </section>

          <section class="sfx-card">
            <div class="sfx-card-head">
              <div><h2 class="sfx-card-title">미리보기 / 출력</h2><p class="sfx-card-sub">생성된 파형을 확인하고 WAV로 다운로드합니다.</p></div>
            </div>
            <div class="sfx-card-body sfx-wave-wrap">
              <div class="sfx-screen"><canvas id="sfxWaveCanvas" width="900" height="240"></canvas></div>
              <div class="sfx-readout">
                <div class="sfx-meter"><small>프리셋</small><strong id="sfxCurrentName">UI 클릭</strong></div>
                <div class="sfx-meter"><small>길이</small><strong id="sfxDurationReadout">0.08s</strong></div>
                <div class="sfx-meter"><small>형식</small><strong>WAV</strong></div>
              </div>
              <a id="sfxDownloadLink" class="sfx-download hidden" download="sfx.wav">⬇ WAV 다운로드</a>
              <div id="sfxStatus" class="sfx-status">프리셋을 선택하거나 값을 조절한 뒤 미리듣기를 누르세요.</div>
            </div>
          </section>

          <section class="sfx-card" style="grid-column:1 / -1;">
            <div class="sfx-card-head">
              <div><h2 class="sfx-card-title">사운드 조절</h2><p class="sfx-card-sub">짧은 효과음에 자주 쓰는 파라미터만 모았습니다.</p></div>
            </div>
            <div class="sfx-card-body">
              <div class="sfx-control-grid">
                <div class="sfx-control"><label>파형</label><select id="sfxWave"><option value="sine">Sine</option><option value="square">Square</option><option value="triangle">Triangle</option><option value="sawtooth">Sawtooth</option><option value="noise">Noise</option></select></div>
                <div class="sfx-control"><label>파일 이름</label><input id="sfxNameInput" type="text" value="ui-click"></div>
                ${rangeControl('sfxDuration', '길이', 0.03, 1.5, 0.01, 's')}
                ${rangeControl('sfxVolume', '볼륨', 0, 1, 0.01, '')}
                ${rangeControl('sfxStartFreq', '시작 피치', 40, 2200, 1, 'Hz')}
                ${rangeControl('sfxEndFreq', '끝 피치', 30, 2200, 1, 'Hz')}
                ${rangeControl('sfxAttack', '어택', 0.001, 0.2, 0.001, 's')}
                ${rangeControl('sfxDecay', '감쇠', 0.005, 0.5, 0.005, 's')}
                ${rangeControl('sfxSustain', '서스테인', 0, 1, 0.01, '')}
                ${rangeControl('sfxRelease', '릴리즈', 0.005, 0.5, 0.005, 's')}
                ${rangeControl('sfxNoise', '노이즈', 0, 1, 0.01, '')}
                ${rangeControl('sfxFilter', '필터', 200, 12000, 10, 'Hz')}
                ${rangeControl('sfxVibratoDepth', '비브라토 깊이', 0, 0.12, 0.001, '')}
                ${rangeControl('sfxVibratoRate', '비브라토 속도', 0, 40, 0.1, 'Hz')}
                ${rangeControl('sfxPunch', '펀치감', 0, 1, 0.01, '')}
                ${rangeControl('sfxBitcrush', '비트크러시', 0, 0.9, 0.01, '')}
                <div class="sfx-control wide"><label>아르페지오 <output id="sfxArpeggioOut">0</output></label><input id="sfxArpeggio" type="text" value="0" placeholder="예: 0,4,7,12"></div>
              </div>
            </div>
          </section>
        </main>
      </div>
    `;
    main.append(section);
  }

  function rangeControl(id, label, min, max, step, unit) {
    return `<div class="sfx-control"><label>${label} <output id="${id}Out"></output></label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}"></div>`;
  }

  function renderPresets() {
    const grid = $('sfxPresetGrid');
    if (!grid || grid.dataset.rendered === 'true') return;
    grid.dataset.rendered = 'true';
    presets.forEach((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sfx-preset';
      button.dataset.presetId = preset.id;
      button.innerHTML = `<div class="sfx-preset-icon">${preset.icon}</div><div class="sfx-preset-name">${preset.name}</div><div class="sfx-preset-desc">${preset.desc}</div>`;
      button.addEventListener('click', () => applyPreset(preset.id, true));
      grid.append(button);
    });
  }

  function setValue(id, value) {
    const element = $(id);
    if (!element) return;
    element.value = String(value);
  }

  function getValue(id, fallback) {
    const element = $(id);
    if (!element) return fallback;
    const value = Number.parseFloat(element.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function getParams() {
    return {
      id: $('sfxNameInput')?.value || 'sfx',
      wave: $('sfxWave')?.value || 'sine',
      duration: getValue('sfxDuration', defaultParams.duration),
      startFreq: getValue('sfxStartFreq', defaultParams.startFreq),
      endFreq: getValue('sfxEndFreq', defaultParams.endFreq),
      volume: getValue('sfxVolume', defaultParams.volume),
      attack: getValue('sfxAttack', defaultParams.attack),
      decay: getValue('sfxDecay', defaultParams.decay),
      sustain: getValue('sfxSustain', defaultParams.sustain),
      release: getValue('sfxRelease', defaultParams.release),
      noise: getValue('sfxNoise', defaultParams.noise),
      vibratoDepth: getValue('sfxVibratoDepth', defaultParams.vibratoDepth),
      vibratoRate: getValue('sfxVibratoRate', defaultParams.vibratoRate),
      filter: getValue('sfxFilter', defaultParams.filter),
      punch: getValue('sfxPunch', defaultParams.punch),
      bitcrush: getValue('sfxBitcrush', defaultParams.bitcrush),
      arpeggio: $('sfxArpeggio')?.value || '0',
    };
  }

  function applyPreset(id, preview = false) {
    const preset = presets.find((item) => item.id === id) || presets[0];
    setValue('sfxWave', preset.wave);
    setValue('sfxNameInput', preset.id);
    setValue('sfxDuration', preset.duration);
    setValue('sfxVolume', preset.volume);
    setValue('sfxStartFreq', preset.startFreq);
    setValue('sfxEndFreq', preset.endFreq);
    setValue('sfxAttack', preset.attack);
    setValue('sfxDecay', preset.decay);
    setValue('sfxSustain', preset.sustain);
    setValue('sfxRelease', preset.release);
    setValue('sfxNoise', preset.noise);
    setValue('sfxFilter', preset.filter);
    setValue('sfxVibratoDepth', preset.vibratoDepth);
    setValue('sfxVibratoRate', preset.vibratoRate);
    setValue('sfxPunch', preset.punch);
    setValue('sfxBitcrush', preset.bitcrush);
    setValue('sfxArpeggio', preset.arpeggio || '0');
    document.querySelectorAll('.sfx-preset').forEach((button) => button.classList.toggle('active', button.dataset.presetId === id));
    $('sfxCurrentName').textContent = preset.name;
    updateOutputs();
    generateAndRender();
    if (preview) playPreview();
  }

  function updateOutputs() {
    const map = [
      ['sfxDuration', 's'], ['sfxVolume', ''], ['sfxStartFreq', 'Hz'], ['sfxEndFreq', 'Hz'], ['sfxAttack', 's'], ['sfxDecay', 's'], ['sfxSustain', ''], ['sfxRelease', 's'], ['sfxNoise', ''], ['sfxFilter', 'Hz'], ['sfxVibratoDepth', ''], ['sfxVibratoRate', 'Hz'], ['sfxPunch', ''], ['sfxBitcrush', '']
    ];
    map.forEach(([id, unit]) => {
      const input = $(id);
      const output = $(`${id}Out`);
      if (!input || !output) return;
      output.textContent = `${input.value}${unit}`;
    });
    const arpOut = $('sfxArpeggioOut');
    if (arpOut) arpOut.textContent = $('sfxArpeggio')?.value || '0';
    const duration = $('sfxDuration')?.value || '0';
    const readout = $('sfxDurationReadout');
    if (readout) readout.textContent = `${Number(duration).toFixed(2)}s`;
  }

  function waveSample(type, phase) {
    const p = phase % (Math.PI * 2);
    if (type === 'square') return Math.sin(p) >= 0 ? 1 : -1;
    if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(p));
    if (type === 'sawtooth') return 2 * (p / (Math.PI * 2)) - 1;
    if (type === 'noise') return Math.random() * 2 - 1;
    return Math.sin(p);
  }

  function envelopeAt(t, p) {
    const duration = p.duration;
    if (t < p.attack) return t / Math.max(0.0001, p.attack);
    if (t < p.attack + p.decay) {
      const k = (t - p.attack) / Math.max(0.0001, p.decay);
      return lerp(1, p.sustain, k);
    }
    if (t > duration - p.release) {
      const k = (duration - t) / Math.max(0.0001, p.release);
      return Math.max(0, p.sustain * k);
    }
    return p.sustain;
  }

  function parseArpeggio(text) {
    const values = String(text || '0').split(',').map((item) => Number.parseFloat(item.trim())).filter(Number.isFinite);
    return values.length ? values : [0];
  }

  function synthesize(params) {
    const sampleRate = 44100;
    const total = Math.max(1, Math.floor(params.duration * sampleRate));
    const samples = new Float32Array(total);
    const arp = parseArpeggio(params.arpeggio);
    let phase = 0;
    let lowpass = 0;
    let hold = 0;
    let heldValue = 0;
    const crushStep = Math.max(1, Math.round(1 + params.bitcrush * 40));
    for (let i = 0; i < total; i += 1) {
      const t = i / sampleRate;
      const n = i / Math.max(1, total - 1);
      const arpIndex = Math.min(arp.length - 1, Math.floor(n * arp.length));
      const semitone = arp[arpIndex] || 0;
      const baseFreq = lerp(params.startFreq, params.endFreq, Math.pow(n, 0.82));
      const vibrato = 1 + Math.sin(t * Math.PI * 2 * params.vibratoRate) * params.vibratoDepth;
      const freq = baseFreq * Math.pow(2, semitone / 12) * vibrato;
      phase += (Math.PI * 2 * freq) / sampleRate;
      const tonal = waveSample(params.wave, phase);
      const noise = Math.random() * 2 - 1;
      const punch = 1 + params.punch * Math.exp(-n * 22);
      let value = (tonal * (1 - params.noise) + noise * params.noise) * envelopeAt(t, params) * params.volume * punch;
      const cutoff = clamp(params.filter, 80, 16000);
      const alpha = clamp((Math.PI * 2 * cutoff) / (Math.PI * 2 * cutoff + sampleRate), 0.001, 0.99);
      lowpass += alpha * (value - lowpass);
      value = lowpass;
      if (params.bitcrush > 0) {
        if (hold % crushStep === 0) heldValue = value;
        hold += 1;
        const levels = Math.max(4, Math.round(256 - params.bitcrush * 224));
        value = Math.round(heldValue * levels) / levels;
      }
      samples[i] = clamp(value, -1, 1);
    }
    return { samples, sampleRate };
  }

  function generateAndRender() {
    const params = getParams();
    lastBuffer = synthesize(params);
    drawWave(lastBuffer.samples);
    updateDownload(lastBuffer, params.id);
    const status = $('sfxStatus');
    if (status) status.textContent = `생성 완료: ${params.wave}, ${params.duration.toFixed(2)}초, ${params.startFreq.toFixed(0)}Hz → ${params.endFreq.toFixed(0)}Hz`;
  }

  function getAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
  }

  function stopPreview() {
    try { currentSource?.stop(); } catch (error) {}
    currentSource = null;
  }

  async function playPreview() {
    stopPreview();
    updateOutputs();
    generateAndRender();
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = ctx.createBuffer(1, lastBuffer.samples.length, lastBuffer.sampleRate);
    buffer.copyToChannel(lastBuffer.samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 0.95;
    source.connect(gain).connect(ctx.destination);
    source.onended = () => { if (currentSource === source) currentSource = null; };
    currentSource = source;
    source.start();
  }

  function drawWave(samples) {
    const canvas = $('sfxWaveCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#22d3ee');
    gradient.addColorStop(0.5, '#a78bfa');
    gradient.addColorStop(1, '#fb7185');
    ctx.strokeStyle = 'rgba(148,163,184,.16)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      const start = Math.floor((x / width) * samples.length);
      const end = Math.max(start + 1, Math.floor(((x + 1) / width) * samples.length));
      let min = 1, max = -1;
      for (let i = start; i < end; i += 1) { min = Math.min(min, samples[i]); max = Math.max(max, samples[i]); }
      const y1 = height / 2 - max * height * 0.42;
      const y2 = height / 2 - min * height * 0.42;
      ctx.moveTo(x, y1); ctx.lineTo(x, y2);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  }

  function encodeWav({ samples, sampleRate }) {
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const sample = clamp(samples[i], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function writeString(view, offset, text) {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  }

  function updateDownload(buffer, name) {
    const link = $('sfxDownloadLink');
    if (!link) return;
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    const blob = encodeWav(buffer);
    downloadUrl = URL.createObjectURL(blob);
    const safeName = String(name || 'sfx').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sfx';
    link.href = downloadUrl;
    link.download = `${safeName}.wav`;
    link.classList.remove('hidden');
  }

  function randomize() {
    const waves = ['sine', 'square', 'triangle', 'sawtooth'];
    setValue('sfxWave', waves[Math.floor(Math.random() * waves.length)]);
    setValue('sfxNameInput', `random-sfx-${Math.floor(Math.random() * 9999)}`);
    setValue('sfxDuration', (0.08 + Math.random() * 0.65).toFixed(2));
    setValue('sfxVolume', (0.35 + Math.random() * 0.45).toFixed(2));
    setValue('sfxStartFreq', Math.round(120 + Math.random() * 1500));
    setValue('sfxEndFreq', Math.round(60 + Math.random() * 1500));
    setValue('sfxAttack', (0.001 + Math.random() * 0.035).toFixed(3));
    setValue('sfxDecay', (0.04 + Math.random() * 0.22).toFixed(3));
    setValue('sfxSustain', (0.05 + Math.random() * 0.55).toFixed(2));
    setValue('sfxRelease', (0.02 + Math.random() * 0.16).toFixed(3));
    setValue('sfxNoise', (Math.random() * 0.45).toFixed(2));
    setValue('sfxFilter', Math.round(800 + Math.random() * 8500));
    setValue('sfxVibratoDepth', (Math.random() * 0.08).toFixed(3));
    setValue('sfxVibratoRate', (Math.random() * 28).toFixed(1));
    setValue('sfxPunch', (Math.random()).toFixed(2));
    setValue('sfxBitcrush', (Math.random() * 0.45).toFixed(2));
    setValue('sfxArpeggio', Math.random() > 0.55 ? '0,4,7,12' : '0');
    document.querySelectorAll('.sfx-preset').forEach((button) => button.classList.remove('active'));
    $('sfxCurrentName').textContent = '랜덤 효과음';
    updateOutputs();
    playPreview();
  }

  function bind() {
    const preview = $('sfxPreviewButton');
    if (!preview || preview.dataset.bound === 'true') return;
    preview.dataset.bound = 'true';
    preview.addEventListener('click', playPreview);
    $('sfxStopButton')?.addEventListener('click', stopPreview);
    $('sfxRandomButton')?.addEventListener('click', randomize);
    const ids = ['sfxWave', 'sfxNameInput', 'sfxDuration', 'sfxVolume', 'sfxStartFreq', 'sfxEndFreq', 'sfxAttack', 'sfxDecay', 'sfxSustain', 'sfxRelease', 'sfxNoise', 'sfxFilter', 'sfxVibratoDepth', 'sfxVibratoRate', 'sfxPunch', 'sfxBitcrush', 'sfxArpeggio'];
    ids.forEach((id) => {
      const element = $(id);
      element?.addEventListener('input', () => { updateOutputs(); generateAndRender(); });
      element?.addEventListener('change', () => { updateOutputs(); generateAndRender(); });
    });
    applyPreset('ui-click', false);
  }

  function install() {
    ensureStyle();
    addNav();
    addView();
    renderPresets();
    bind();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
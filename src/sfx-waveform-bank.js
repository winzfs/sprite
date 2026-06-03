(() => {
  const STYLE_ID = 'sfxWaveformBankStyle';
  const WAVEFORMS = [
    ['sine', 'Sine'],
    ['square', 'Square'],
    ['triangle', 'Triangle'],
    ['sawtooth', 'Sawtooth'],
    ['noise', 'Noise'],
    ['soft-square', 'Soft Square'],
    ['warm-saw', 'Warm Saw'],
    ['bell', 'Bell'],
    ['glass', 'Glass'],
    ['pluck', 'Pluck'],
    ['fm-bell', 'FM Bell'],
    ['metallic', 'Metallic'],
    ['organ', 'Organ'],
    ['bass-thump', 'Bass Thump'],
    ['air-noise', 'Air Noise'],
    ['sparkle', 'Sparkle'],
    ['digital-blip', 'Digital Blip'],
    ['chime', 'Chime'],
    ['wood', 'Wood'],
    ['zap', 'Zap'],
    ['sweep', 'Sweep'],
    ['water-drop', 'Water Drop'],
    ['crystal', 'Crystal'],
    ['soft-pad', 'Soft Pad'],
  ];

  function $(id) { return document.getElementById(id); }

  function ensureStyle() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .sfx-wave-bank-note {
        grid-column:1/-1;
        padding:12px 14px;
        border-radius:18px;
        border:1px solid rgba(99,102,241,.2);
        background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(14,165,233,.07));
        color:#475569;
        font-size:12px;
        line-height:1.45;
      }
      .sfx-wave-bank-note b { color:#0f172a; }
      @media (prefers-color-scheme: dark) {
        .sfx-wave-bank-note { color:#d1d5db; background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(14,165,233,.1)); border-color:rgba(99,102,241,.34); }
        .sfx-wave-bank-note b { color:#f8fafc; }
      }
    `;
    document.head.append(style);
  }

  function installWaveforms() {
    const select = $('sfxWave');
    if (!select || select.dataset.waveformBankInstalled === 'true') return;
    const current = select.value || 'sine';
    select.innerHTML = WAVEFORMS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    select.value = WAVEFORMS.some(([value]) => value === current) ? current : 'sine';
    select.dataset.waveformBankInstalled = 'true';

    const control = select.closest('.sfx-control');
    if (control && !document.getElementById('sfxWaveBankNote')) {
      const note = document.createElement('div');
      note.id = 'sfxWaveBankNote';
      note.className = 'sfx-wave-bank-note';
      note.innerHTML = '<b>Waveform Bank</b> — 기본 5종 파형 외에 Bell, Glass, Pluck, Metallic, Chime, Air Noise 같은 질감형 파형을 추가했습니다.';
      control.after(note);
    }
  }

  function install() {
    ensureStyle();
    installWaveforms();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
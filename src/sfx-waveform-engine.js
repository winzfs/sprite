(() => {
  let installed = false;

  function $(id) { return document.getElementById(id); }

  function waveformProfile(wave) {
    const profiles = {
      'soft-square': { texture: 'clean', engine: 'clean', depth: 0.62, shine: 0.22, body: 0.28, transient: 0.32, air: 0.1, noise: 0.02, filter: 5400 },
      'warm-saw': { texture: 'hybrid', engine: 'pro', depth: 0.72, shine: 0.28, body: 0.56, transient: 0.28, air: 0.14, noise: 0.04, filter: 4200 },
      bell: { texture: 'bell', engine: 'pro', depth: 0.88, shine: 0.68, body: 0.34, transient: 0.38, air: 0.18, noise: 0.015, filter: 9000 },
      glass: { texture: 'glass', engine: 'pro', depth: 0.94, shine: 0.82, body: 0.26, transient: 0.35, air: 0.28, noise: 0.02, filter: 11200 },
      pluck: { texture: 'clean', engine: 'pro', depth: 0.7, shine: 0.44, body: 0.32, transient: 0.74, air: 0.12, noise: 0.025, filter: 7600 },
      'fm-bell': { texture: 'glass', engine: 'pro', depth: 1, shine: 0.75, body: 0.3, transient: 0.42, air: 0.18, noise: 0.015, filter: 9800 },
      metallic: { texture: 'hybrid', engine: 'pro', depth: 1, shine: 0.62, body: 0.44, transient: 0.58, air: 0.16, noise: 0.08, filter: 8200 },
      organ: { texture: 'hybrid', engine: 'pro', depth: 0.58, shine: 0.18, body: 0.72, transient: 0.12, air: 0.06, noise: 0.005, filter: 5200 },
      'bass-thump': { texture: 'impact', engine: 'impact', depth: 0.66, shine: 0.08, body: 0.92, transient: 0.62, air: 0.04, noise: 0.16, filter: 1500 },
      'air-noise': { texture: 'whoosh', engine: 'air', depth: 0.72, shine: 0.45, body: 0.12, transient: 0.22, air: 0.95, noise: 0.55, filter: 8800 },
      sparkle: { texture: 'glass', engine: 'pro', depth: 0.92, shine: 1, body: 0.16, transient: 0.48, air: 0.36, noise: 0.04, filter: 11800 },
      'digital-blip': { texture: 'clean', engine: 'clean', depth: 0.48, shine: 0.32, body: 0.18, transient: 0.66, air: 0.04, noise: 0.02, filter: 6400 },
      chime: { texture: 'bell', engine: 'pro', depth: 0.9, shine: 0.72, body: 0.22, transient: 0.34, air: 0.24, noise: 0.018, filter: 10600 },
      wood: { texture: 'impact', engine: 'impact', depth: 0.52, shine: 0.08, body: 0.62, transient: 0.84, air: 0.08, noise: 0.22, filter: 2800 },
      zap: { texture: 'hybrid', engine: 'pro', depth: 0.76, shine: 0.42, body: 0.24, transient: 0.8, air: 0.2, noise: 0.12, filter: 7600 },
      sweep: { texture: 'whoosh', engine: 'air', depth: 0.82, shine: 0.48, body: 0.14, transient: 0.22, air: 0.82, noise: 0.42, filter: 9200 },
      'water-drop': { texture: 'glass', engine: 'pro', depth: 0.86, shine: 0.66, body: 0.2, transient: 0.56, air: 0.18, noise: 0.025, filter: 9600 },
      crystal: { texture: 'glass', engine: 'pro', depth: 1, shine: 0.95, body: 0.18, transient: 0.36, air: 0.28, noise: 0.012, filter: 12000 },
      'soft-pad': { texture: 'bell', engine: 'pro', depth: 0.72, shine: 0.32, body: 0.58, transient: 0.08, air: 0.24, noise: 0.02, filter: 5800 },
    };
    return profiles[wave] || null;
  }

  function applyWaveProfile({ preview = false } = {}) {
    const wave = $('sfxWave')?.value;
    const profile = waveformProfile(wave);
    if (!profile) return;
    set('sfxProEngine', profile.engine);
    set('sfxTexture', profile.texture);
    set('sfxMasterDepth', profile.depth);
    set('sfxMasterShine', profile.shine);
    set('sfxMasterBody', profile.body);
    set('sfxTransient', profile.transient);
    set('sfxAir', profile.air);
    set('sfxNoise', profile.noise);
    set('sfxFilter', profile.filter);
    document.dispatchEvent(new CustomEvent('sfx:waveform-profile-applied', { detail: { wave, profile } }));
    if (preview) $('sfxPreviewButton')?.click();
  }

  function set(id, value) {
    const element = $(id);
    if (!element) return;
    element.value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function bindWaveSelect() {
    const select = $('sfxWave');
    if (!select || installed) return;
    installed = true;
    select.addEventListener('change', () => applyWaveProfile({ preview: false }));
  }

  function install() {
    bindWaveSelect();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
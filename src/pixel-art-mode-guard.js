(() => {
  let restoring = false;
  let rerunTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function ultraEnabled() {
    return Boolean($('pixelArtUltraDetail')?.checked);
  }

  function smartInput() {
    return $('pixelArtSmartDetail');
  }

  function runButton() {
    return $('pixelArtRunButton');
  }

  function restoreSmartAfterEvent(wasChecked) {
    if (!wasChecked || restoring) return;
    restoring = true;
    window.setTimeout(() => {
      const smart = smartInput();
      if (smart) smart.checked = true;
      const floating = $('pixelFloatingSmart');
      if (floating) floating.checked = true;
      restoring = false;
    }, 0);
  }

  function installClickGuard() {
    if (document.body.dataset.pixelModeGuardClick === 'true') return;
    document.body.dataset.pixelModeGuardClick = 'true';

    document.addEventListener('click', (event) => {
      if (event.target !== runButton()) return;
      if (!ultraEnabled()) return;
      const smart = smartInput();
      if (!smart?.checked) return;
      smart.checked = false;
      restoreSmartAfterEvent(true);
    }, true);
  }

  function scheduleRerun() {
    if (!$('pixelArtAutoRun')?.checked || !$('pixelArtInput')?.files?.[0]) return;
    window.clearTimeout(rerunTimer);
    rerunTimer = window.setTimeout(() => runButton()?.click(), 160);
  }

  function bindModeControls() {
    ['pixelArtSmartDetail', 'pixelArtUltraDetail', 'pixelFloatingSmart', 'pixelFloatingUltra'].forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.pixelModeGuardBound === 'true') return;
      element.dataset.pixelModeGuardBound = 'true';
      element.addEventListener('change', () => {
        window.setTimeout(() => {
          const smart = $('pixelArtSmartDetail');
          const floatingSmart = $('pixelFloatingSmart');
          const ultra = $('pixelArtUltraDetail');
          const floatingUltra = $('pixelFloatingUltra');
          if (smart && floatingSmart) floatingSmart.checked = smart.checked;
          if (ultra && floatingUltra) floatingUltra.checked = ultra.checked;
          scheduleRerun();
        }, 0);
      });
    });

    ['pixelArtMicroDetail', 'pixelArtTonePattern', 'pixelArtFeatureBoost', 'pixelArtShapePreserve', 'pixelArtDetailPower'].forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.pixelModeGuardValueBound === 'true') return;
      element.dataset.pixelModeGuardValueBound = 'true';
      element.addEventListener('input', scheduleRerun);
      element.addEventListener('change', scheduleRerun);
    });
  }

  function install() {
    installClickGuard();
    bindModeControls();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
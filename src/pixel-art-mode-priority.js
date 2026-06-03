(() => {
  let restoreSmartTimer = null;
  let rerunTimer = null;

  function $(id) { return document.getElementById(id); }

  function shouldUltraRun() {
    return Boolean($('pixelArtUltraDetail')?.checked && $('pixelArtInput')?.files?.[0]);
  }

  function shouldSmartRun() {
    return Boolean($('pixelArtSmartDetail')?.checked && !$('pixelArtUltraDetail')?.checked && $('pixelArtInput')?.files?.[0]);
  }

  function forceRerun(delay = 80) {
    window.clearTimeout(rerunTimer);
    rerunTimer = window.setTimeout(() => $('pixelArtRunButton')?.click(), delay);
  }

  function temporarilyDisableSmartForUltra() {
    const smart = $('pixelArtSmartDetail');
    if (!smart || !smart.checked || !shouldUltraRun()) return;
    smart.dataset.wasCheckedForUltra = 'true';
    smart.checked = false;
    smart.dispatchEvent(new Event('change', { bubbles: true }));
    window.clearTimeout(restoreSmartTimer);
    restoreSmartTimer = window.setTimeout(() => {
      const currentSmart = $('pixelArtSmartDetail');
      const ultra = $('pixelArtUltraDetail');
      if (!currentSmart || currentSmart.dataset.wasCheckedForUltra !== 'true') return;
      currentSmart.checked = true;
      delete currentSmart.dataset.wasCheckedForUltra;
      currentSmart.dispatchEvent(new Event('change', { bubbles: true }));
      if (ultra?.checked) {
        const floatingSmart = $('pixelFloatingSmart');
        if (floatingSmart) floatingSmart.checked = true;
      }
    }, 300);
  }

  function syncFloatingToggles() {
    const pairs = [
      ['pixelArtSmartDetail', 'pixelFloatingSmart'],
      ['pixelArtUltraDetail', 'pixelFloatingUltra'],
      ['pixelArtAutoRun', 'pixelFloatingAuto'],
    ];
    pairs.forEach(([sourceId, floatingId]) => {
      const source = $(sourceId);
      const floating = $(floatingId);
      if (source && floating) floating.checked = source.checked;
    });
  }

  function installRunPriority() {
    const button = $('pixelArtRunButton');
    if (!button || button.dataset.modePriorityBound === 'true') return;
    button.dataset.modePriorityBound = 'true';

    document.addEventListener('click', (event) => {
      if (event.target !== button) return;
      if (shouldUltraRun()) temporarilyDisableSmartForUltra();
    }, true);
  }

  function bindModeToggles() {
    ['pixelArtSmartDetail', 'pixelArtUltraDetail', 'pixelFloatingSmart', 'pixelFloatingUltra'].forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.modePriorityToggleBound === 'true') return;
      element.dataset.modePriorityToggleBound = 'true';
      element.addEventListener('change', () => {
        syncFloatingToggles();
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) forceRerun(120);
      });
      element.addEventListener('input', () => {
        syncFloatingToggles();
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) forceRerun(120);
      });
    });
  }

  function bindPrioritySensitiveControls() {
    const ids = [
      'pixelArtShapePreserve',
      'pixelArtDetailPower',
      'pixelArtMicroDetail',
      'pixelArtTonePattern',
      'pixelArtFeatureBoost',
    ];
    ids.forEach((id) => {
      const element = $(id);
      if (!element || element.dataset.modePriorityControlBound === 'true') return;
      element.dataset.modePriorityControlBound = 'true';
      element.addEventListener('input', () => {
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) forceRerun(160);
      });
      element.addEventListener('change', () => {
        if ($('pixelArtAutoRun')?.checked && $('pixelArtInput')?.files?.[0]) forceRerun(160);
      });
    });
  }

  function updateStatusHint() {
    const status = $('pixelArtStatus');
    if (!status || status.dataset.modePriorityHint === 'true') return;
    status.dataset.modePriorityHint = 'true';
    const hint = document.createElement('div');
    hint.className = 'status';
    hint.textContent = '변환 모드 우선순위: 초저해상도 디테일 압축 ON이면 해당 모드가 먼저 적용되고, OFF일 때 스마트 원형 보존이 적용됩니다.';
    status.after(hint);
  }

  function install() {
    installRunPriority();
    bindModeToggles();
    bindPrioritySensitiveControls();
    syncFloatingToggles();
    updateStatusHint();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
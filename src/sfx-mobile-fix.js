(() => {
  const STYLE_ID = 'sfxMobileFixStyle';
  const DRAGGING_CLASS = 'sfx-slider-dragging';
  let activeRange = null;

  function installStyle() {
    const old = document.getElementById(STYLE_ID);
    if (old) old.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html,
      body {
        max-width: 100%;
        overflow-x: hidden;
      }

      #view-sfxMaker,
      #view-sfxMaker * {
        box-sizing: border-box;
      }

      #view-sfxMaker {
        width: 100%;
        max-width: 100vw;
        min-height: 100vh;
        overflow-x: hidden;
        background: #090d14;
      }

      #view-sfxMaker .sfx-app {
        width: 100%;
        max-width: 1320px;
        min-width: 0;
        margin: 0 auto;
        padding: 14px;
      }

      #view-sfxMaker .sfx-hero,
      #view-sfxMaker .sfx-card {
        min-width: 0;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: #101622;
        box-shadow: none;
      }

      #view-sfxMaker .sfx-hero {
        padding: 16px;
        border-radius: 18px;
      }

      #view-sfxMaker .sfx-hero::after {
        display: none;
      }

      #view-sfxMaker .sfx-card-title,
      #view-sfxMaker .sfx-preset-name,
      #view-sfxMaker .sfx-control output,
      #view-sfxMaker .sfx-meter strong {
        color: #f8fafc;
      }

      #view-sfxMaker .sfx-card-sub,
      #view-sfxMaker .sfx-preset-desc,
      #view-sfxMaker .sfx-status,
      #view-sfxMaker .sfx-meter small,
      #view-sfxMaker .sfx-control label {
        color: #a7b2c5;
      }

      #view-sfxMaker .sfx-card-head {
        padding: 12px 14px;
        background: #0c111b;
        border-color: rgba(255, 255, 255, 0.08);
      }

      #view-sfxMaker .sfx-card-body {
        padding: 12px;
      }

      #view-sfxMaker .sfx-card,
      #view-sfxMaker .sfx-preset,
      #view-sfxMaker .sfx-control,
      #view-sfxMaker .sfx-meter {
        background: #101622;
        border-color: rgba(255, 255, 255, 0.08);
      }

      #view-sfxMaker .sfx-preset.active {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.18);
      }

      #view-sfxMaker .sfx-control select,
      #view-sfxMaker .sfx-control input[type='text'] {
        min-height: 38px;
        background: #070a10;
        color: #f8fafc;
        border-color: rgba(255, 255, 255, 0.12);
      }

      #view-sfxMaker input[type='range'] {
        display: block;
        width: 100%;
        max-width: 100%;
        height: 34px;
        min-height: 34px;
        margin: 0;
        padding: 0;
        accent-color: #38bdf8;
        touch-action: none !important;
        -ms-touch-action: none !important;
        overscroll-behavior: contain;
      }

      #view-sfxMaker input[type='range']::-webkit-slider-runnable-track {
        height: 7px;
        border-radius: 999px;
        background: #263449;
      }

      #view-sfxMaker input[type='range']::-webkit-slider-thumb {
        width: 24px;
        height: 24px;
        margin-top: -8.5px;
        border: 3px solid #0b1020;
        border-radius: 999px;
        background: #38bdf8;
        box-shadow: none;
      }

      #view-sfxMaker input[type='range']::-moz-range-track {
        height: 7px;
        border-radius: 999px;
        background: #263449;
      }

      #view-sfxMaker input[type='range']::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border: 3px solid #0b1020;
        border-radius: 999px;
        background: #38bdf8;
        box-shadow: none;
      }

      body.${DRAGGING_CLASS} {
        overscroll-behavior: none;
        touch-action: none;
      }

      @media (max-width: 960px) {
        .main-content,
        .tool-view.active,
        #view-sfxMaker,
        #view-sfxMaker .sfx-app,
        #view-sfxMaker .sfx-main-grid,
        #view-sfxMaker .sfx-card,
        #view-sfxMaker .sfx-hero,
        #view-sfxMaker section,
        #view-sfxMaker div {
          max-width: 100%;
          min-width: 0;
        }

        #view-sfxMaker .sfx-app {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 6px;
          padding-bottom: 74px;
          overflow-x: hidden;
        }

        #view-sfxMaker .sfx-hero {
          order: 2;
          width: 100%;
          padding: 8px 10px;
          border-radius: 12px;
          background: #0f1724;
        }

        #view-sfxMaker .sfx-hero-top {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
        }

        #view-sfxMaker .sfx-kicker {
          padding: 0;
          background: transparent;
          color: #7dd3fc;
          font-size: 10px;
        }

        #view-sfxMaker .sfx-hero h1 {
          margin: 2px 0 0;
          font-size: 18px;
          line-height: 1.05;
        }

        #view-sfxMaker .sfx-hero p {
          display: none;
        }

        #view-sfxMaker .sfx-transport,
        #view-sfxMaker [class*='transport'] {
          position: fixed;
          left: 8px;
          right: 8px;
          bottom: 8px;
          z-index: 90;
          display: grid !important;
          grid-template-columns: 1.25fr 0.75fr 0.9fr;
          gap: 6px;
          width: auto;
          padding: 7px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          background: rgba(10, 15, 24, 0.96);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(14px);
        }

        #view-sfxMaker .sfx-big-button,
        #view-sfxMaker [class*='transport'] button {
          width: 100%;
          min-height: 38px;
          padding: 7px 8px;
          border-radius: 11px;
          font-size: 12px;
          white-space: nowrap;
        }

        #view-sfxMaker .sfx-main-grid {
          order: 1;
          display: flex !important;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          overflow: visible;
        }

        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(2) { order: 1; }
        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(3) { order: 2; }
        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(1) { order: 3; }

        #view-sfxMaker .sfx-card {
          width: 100%;
          border-radius: 12px;
        }

        #view-sfxMaker .sfx-card[style] {
          grid-column: auto !important;
        }

        #view-sfxMaker .sfx-card-head {
          padding: 8px 10px;
        }

        #view-sfxMaker .sfx-card-title {
          font-size: 13px;
        }

        #view-sfxMaker .sfx-card-sub {
          display: none;
        }

        #view-sfxMaker .sfx-card-body {
          padding: 8px;
        }

        #view-sfxMaker .sfx-wave-wrap {
          gap: 7px;
        }

        #view-sfxMaker .sfx-screen {
          padding: 6px;
          border-radius: 10px;
        }

        #view-sfxMaker #sfxWaveCanvas,
        #view-sfxMaker canvas {
          display: block;
          width: 100% !important;
          max-width: 100%;
          height: 70px !important;
          border-radius: 8px;
        }

        #view-sfxMaker .sfx-readout {
          display: grid;
          grid-template-columns: 1.4fr 0.8fr 0.8fr;
          gap: 6px;
        }

        #view-sfxMaker .sfx-meter {
          min-width: 0;
          padding: 7px;
          border-radius: 9px;
        }

        #view-sfxMaker .sfx-meter small {
          font-size: 9px;
        }

        #view-sfxMaker .sfx-meter strong {
          margin-top: 2px;
          font-size: 11px;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        #view-sfxMaker .sfx-download,
        #view-sfxMaker a[download] {
          width: 100%;
          min-height: 36px;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 12px;
        }

        #view-sfxMaker .sfx-status {
          padding: 7px 8px;
          border-radius: 9px;
          background: #0c121d;
          font-size: 10px;
          line-height: 1.35;
        }

        #view-sfxMaker .sfx-control-grid,
        #view-sfxMaker [class*='control-grid'],
        #view-sfxMaker [class*='rack'],
        #view-sfxMaker [class*='console'],
        #view-sfxMaker [class*='mixer'] {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 6px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow: visible !important;
        }

        #view-sfxMaker .sfx-control.wide,
        #view-sfxMaker [class*='wide'] {
          grid-column: 1 / -1 !important;
        }

        #view-sfxMaker .sfx-control,
        #view-sfxMaker [class*='control'],
        #view-sfxMaker [class*='channel'],
        #view-sfxMaker [class*='fader'] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          min-height: auto !important;
          padding: 7px !important;
          border-radius: 10px !important;
        }

        #view-sfxMaker .sfx-control label,
        #view-sfxMaker [class*='control'] label,
        #view-sfxMaker [class*='channel'] label,
        #view-sfxMaker [class*='fader'] label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 4px;
          margin-bottom: 4px;
          font-size: 10px;
          line-height: 1.2;
        }

        #view-sfxMaker .sfx-control output,
        #view-sfxMaker output,
        #view-sfxMaker [class*='value'] {
          padding: 1px 5px;
          border-radius: 999px;
          background: rgba(56, 189, 248, 0.1);
          color: #bae6fd;
          font-size: 9px;
          white-space: nowrap;
        }

        #view-sfxMaker .sfx-control select,
        #view-sfxMaker .sfx-control input[type='text'] {
          min-height: 32px;
          padding: 6px 8px;
          border-radius: 8px;
          font-size: 12px;
        }

        #view-sfxMaker input[type='range'] {
          height: 30px !important;
          min-height: 30px !important;
        }

        #view-sfxMaker .sfx-preset-grid {
          display: flex !important;
          gap: 6px;
          max-height: none;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 1px 2px 6px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        #view-sfxMaker .sfx-preset {
          flex: 0 0 94px;
          min-height: 58px;
          padding: 7px;
          border-radius: 10px;
          scroll-snap-align: start;
        }

        #view-sfxMaker .sfx-preset-icon {
          font-size: 16px;
        }

        #view-sfxMaker .sfx-preset-name {
          margin-top: 3px;
          font-size: 10px;
          line-height: 1.15;
        }

        #view-sfxMaker .sfx-preset-desc {
          display: none;
        }
      }

      @media (max-width: 380px) {
        #view-sfxMaker .sfx-control-grid,
        #view-sfxMaker [class*='control-grid'],
        #view-sfxMaker [class*='rack'],
        #view-sfxMaker [class*='console'],
        #view-sfxMaker [class*='mixer'] {
          grid-template-columns: 1fr !important;
        }
      }
    `;
    document.head.append(style);
  }

  function normalizeRange(range) {
    range.style.writingMode = 'horizontal-tb';
    range.style.webkitAppearance = 'none';
    range.style.appearance = 'none';
    range.style.transform = 'none';
    range.style.maxWidth = '100%';
    range.style.width = '100%';
    range.style.touchAction = 'none';
  }

  function bindRangeGuards(root = document) {
    root.querySelectorAll('#view-sfxMaker input[type="range"]').forEach((range) => {
      normalizeRange(range);
      if (range.dataset.sfxMobileBound === 'true') return;
      range.dataset.sfxMobileBound = 'true';

      range.addEventListener('pointerdown', (event) => {
        activeRange = range;
        document.body.classList.add(DRAGGING_CLASS);
        try { range.setPointerCapture?.(event.pointerId); } catch (error) {}
      });

      const finish = () => {
        activeRange = null;
        document.body.classList.remove(DRAGGING_CLASS);
      };

      range.addEventListener('pointerup', finish);
      range.addEventListener('pointercancel', finish);
      range.addEventListener('lostpointercapture', finish);
      range.addEventListener('touchstart', () => {
        activeRange = range;
        document.body.classList.add(DRAGGING_CLASS);
      }, { passive: true });
      range.addEventListener('touchend', finish, { passive: true });
      range.addEventListener('touchcancel', finish, { passive: true });
    });
  }

  function install() {
    installStyle();
    bindRangeGuards(document);
  }

  document.addEventListener('touchmove', (event) => {
    if (!activeRange) return;
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('blur', () => {
    activeRange = null;
    document.body.classList.remove(DRAGGING_CLASS);
  });

  const observer = new MutationObserver((mutations) => {
    installStyle();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        bindRangeGuards(node);
      });
    });
    bindRangeGuards(document);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      install();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    install();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();

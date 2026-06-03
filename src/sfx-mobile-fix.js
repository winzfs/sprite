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
        background:
          radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.18), transparent 28rem),
          radial-gradient(circle at 90% 8%, rgba(6, 182, 212, 0.14), transparent 24rem),
          #090d14;
      }

      #view-sfxMaker .sfx-app {
        width: 100%;
        max-width: 1480px;
        min-width: 0;
        margin: 0 auto;
        padding: 18px;
      }

      #view-sfxMaker .sfx-hero,
      #view-sfxMaker .sfx-card {
        min-width: 0;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
          rgba(14, 18, 28, 0.94);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
      }

      #view-sfxMaker .sfx-hero {
        padding: 20px;
        backdrop-filter: blur(16px);
      }

      #view-sfxMaker .sfx-hero h1 {
        letter-spacing: -0.06em;
      }

      #view-sfxMaker .sfx-main-grid {
        width: 100%;
        min-width: 0;
        grid-template-columns: minmax(300px, 0.86fr) minmax(360px, 1.14fr);
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
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
        border-color: rgba(255, 255, 255, 0.09);
      }

      #view-sfxMaker .sfx-preset,
      #view-sfxMaker .sfx-control,
      #view-sfxMaker .sfx-meter {
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.018)),
          #101622;
        border-color: rgba(255, 255, 255, 0.1);
      }

      #view-sfxMaker .sfx-preset.active {
        border-color: rgba(125, 211, 252, 0.85);
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18), 0 16px 36px rgba(0, 0, 0, 0.26);
      }

      #view-sfxMaker .sfx-control select,
      #view-sfxMaker .sfx-control input[type='text'] {
        min-height: 46px;
        background: #070a10;
        color: #f8fafc;
        border-color: rgba(255, 255, 255, 0.13);
      }

      #view-sfxMaker input[type='range'],
      #view-sfxMaker .sfx-control input[type='range'],
      #view-sfxMaker .mixer-console input[type='range'],
      #view-sfxMaker [class*='mixer'] input[type='range'],
      #view-sfxMaker [class*='slider'] input[type='range'],
      #view-sfxMaker [class*='fader'] input[type='range'] {
        display: block;
        width: 100%;
        max-width: 100%;
        height: 42px;
        min-height: 42px;
        margin: 0;
        padding: 0;
        accent-color: #7dd3fc;
        cursor: grab;
        touch-action: none !important;
        -ms-touch-action: none !important;
        overscroll-behavior: contain;
      }

      #view-sfxMaker input[type='range']:active {
        cursor: grabbing;
      }

      #view-sfxMaker input[type='range']::-webkit-slider-runnable-track {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #7dd3fc, #a78bfa, #fb7185);
      }

      #view-sfxMaker input[type='range']::-webkit-slider-thumb {
        width: 30px;
        height: 30px;
        margin-top: -10px;
        border: 3px solid #0b1020;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
      }

      #view-sfxMaker input[type='range']::-moz-range-track {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #7dd3fc, #a78bfa, #fb7185);
      }

      #view-sfxMaker input[type='range']::-moz-range-thumb {
        width: 26px;
        height: 26px;
        border: 3px solid #0b1020;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
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
        #view-sfxMaker article,
        #view-sfxMaker div {
          max-width: 100%;
        }

        #view-sfxMaker .sfx-app {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 10px;
          padding-bottom: 110px;
          overflow-x: hidden;
        }

        #view-sfxMaker .sfx-hero {
          position: static;
          width: 100%;
          border-radius: 20px;
          padding: 14px;
        }

        #view-sfxMaker .sfx-hero-top {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
          width: 100%;
        }

        #view-sfxMaker .sfx-hero h1 {
          margin: 8px 0 6px;
          font-size: 26px;
          line-height: 1;
        }

        #view-sfxMaker .sfx-hero p {
          font-size: 12px;
          line-height: 1.5;
        }

        #view-sfxMaker .sfx-transport,
        #view-sfxMaker [class*='transport'] {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          width: 100%;
          max-width: 100%;
        }

        #view-sfxMaker #sfxPreviewButton,
        #view-sfxMaker .sfx-transport button:first-child,
        #view-sfxMaker [class*='transport'] button:first-child {
          grid-column: 1 / -1;
          min-height: 52px;
          font-size: 16px;
        }

        #view-sfxMaker .sfx-big-button,
        #view-sfxMaker [class*='transport'] button,
        #view-sfxMaker button {
          max-width: 100%;
          min-height: 44px;
          padding: 11px 10px;
          border-radius: 14px;
          font-size: 13px;
          white-space: normal;
        }

        #view-sfxMaker .sfx-main-grid {
          display: flex !important;
          flex-direction: column;
          gap: 12px;
          width: 100%;
          overflow: visible;
        }

        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(2) { order: 1; }
        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(3) { order: 2; }
        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(1) { order: 3; }

        #view-sfxMaker .sfx-card {
          width: 100%;
          border-radius: 18px;
        }

        #view-sfxMaker .sfx-card[style] {
          grid-column: auto !important;
        }

        #view-sfxMaker .sfx-card-head {
          padding: 12px 13px;
        }

        #view-sfxMaker .sfx-card-body {
          padding: 11px;
        }

        #view-sfxMaker .sfx-screen {
          padding: 9px;
          border-radius: 15px;
        }

        #view-sfxMaker #sfxWaveCanvas,
        #view-sfxMaker canvas {
          display: block;
          width: 100% !important;
          max-width: 100%;
          height: 112px !important;
        }

        #view-sfxMaker .sfx-readout {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        #view-sfxMaker .sfx-meter {
          padding: 10px;
          border-radius: 14px;
        }

        #view-sfxMaker .sfx-meter strong {
          font-size: 14px;
          word-break: keep-all;
        }

        #view-sfxMaker .sfx-control-grid,
        #view-sfxMaker [class*='control-grid'],
        #view-sfxMaker [class*='rack'],
        #view-sfxMaker [class*='console'],
        #view-sfxMaker [class*='mixer'] {
          display: grid !important;
          grid-template-columns: 1fr !important;
          gap: 10px !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          overflow: visible !important;
        }

        #view-sfxMaker .sfx-control,
        #view-sfxMaker [class*='control'],
        #view-sfxMaker [class*='channel'],
        #view-sfxMaker [class*='fader'] {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          min-height: auto !important;
          padding: 11px !important;
          border-radius: 15px !important;
        }

        #view-sfxMaker .sfx-control label,
        #view-sfxMaker [class*='control'] label,
        #view-sfxMaker [class*='channel'] label,
        #view-sfxMaker [class*='fader'] label {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 7px;
          font-size: 12px;
          line-height: 1.3;
        }

        #view-sfxMaker .sfx-control output,
        #view-sfxMaker output,
        #view-sfxMaker [class*='value'] {
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.1);
          color: #bae6fd;
          font-size: 11px;
          white-space: nowrap;
        }

        #view-sfxMaker .sfx-preset-grid {
          display: flex !important;
          gap: 10px;
          max-height: none;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 4px 10px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        #view-sfxMaker .sfx-preset {
          flex: 0 0 146px;
          min-height: 112px;
          scroll-snap-align: start;
        }

        #view-sfxMaker .sfx-download,
        #view-sfxMaker a[download] {
          width: 100%;
          min-height: 50px;
        }

        #view-sfxMaker .sfx-status {
          padding: 10px 11px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.68);
        }
      }

      @media (max-width: 520px) {
        #view-sfxMaker .sfx-app {
          padding: 8px;
          padding-bottom: 120px;
        }

        #view-sfxMaker .sfx-hero {
          border-radius: 17px;
          padding: 12px;
        }

        #view-sfxMaker .sfx-kicker {
          font-size: 10px;
        }

        #view-sfxMaker .sfx-hero h1 {
          font-size: 23px;
        }

        #view-sfxMaker .sfx-card-head,
        #view-sfxMaker .sfx-card-body {
          padding-left: 10px;
          padding-right: 10px;
        }

        #view-sfxMaker input[type='range'],
        #view-sfxMaker .sfx-control input[type='range'] {
          height: 46px;
          min-height: 46px;
        }
      }
    `;
    document.head.append(style);
  }

  function normalizeVerticalRange(range) {
    range.style.writingMode = 'horizontal-tb';
    range.style.webkitAppearance = 'none';
    range.style.appearance = 'none';
    range.style.transform = 'none';
    range.style.maxWidth = '100%';
    range.style.width = '100%';
    range.style.height = '42px';
    range.style.touchAction = 'none';
  }

  function bindRangeGuards(root = document) {
    root.querySelectorAll('#view-sfxMaker input[type="range"]').forEach((range) => {
      normalizeVerticalRange(range);
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

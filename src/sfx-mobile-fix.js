(() => {
  const STYLE_ID = 'sfxMobileFixStyle';
  const DRAGGING_CLASS = 'sfx-slider-dragging';
  let activeRange = null;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #view-sfxMaker {
        min-height: 100vh;
        background:
          radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.18), transparent 28rem),
          radial-gradient(circle at 90% 8%, rgba(6, 182, 212, 0.14), transparent 24rem),
          #090d14;
      }

      #view-sfxMaker .sfx-app {
        max-width: 1480px;
        margin: 0 auto;
        padding: 18px;
      }

      #view-sfxMaker .sfx-hero,
      #view-sfxMaker .sfx-card {
        border: 1px solid rgba(255, 255, 255, 0.1);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.025)),
          rgba(14, 18, 28, 0.94);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.34);
      }

      #view-sfxMaker .sfx-hero {
        position: sticky;
        top: 10px;
        z-index: 6;
        padding: 20px;
        backdrop-filter: blur(16px);
      }

      #view-sfxMaker .sfx-hero h1 {
        letter-spacing: -0.06em;
      }

      #view-sfxMaker .sfx-main-grid {
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

      #view-sfxMaker .sfx-control input[type='range'] {
        display: block;
        width: 100%;
        height: 42px;
        margin: 0;
        padding: 0;
        accent-color: #7dd3fc;
        cursor: grab;
        touch-action: none;
        -ms-touch-action: none;
        overscroll-behavior: contain;
      }

      #view-sfxMaker .sfx-control input[type='range']:active {
        cursor: grabbing;
      }

      #view-sfxMaker .sfx-control input[type='range']::-webkit-slider-runnable-track {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #7dd3fc, #a78bfa, #fb7185);
      }

      #view-sfxMaker .sfx-control input[type='range']::-webkit-slider-thumb {
        width: 30px;
        height: 30px;
        margin-top: -10px;
        border: 3px solid #0b1020;
        border-radius: 999px;
        background: #ffffff;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
      }

      #view-sfxMaker .sfx-control input[type='range']::-moz-range-track {
        height: 10px;
        border-radius: 999px;
        background: linear-gradient(90deg, #7dd3fc, #a78bfa, #fb7185);
      }

      #view-sfxMaker .sfx-control input[type='range']::-moz-range-thumb {
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
        #view-sfxMaker .sfx-app {
          padding: 12px;
          gap: 12px;
        }

        #view-sfxMaker .sfx-hero {
          top: 8px;
          border-radius: 22px;
          padding: 16px;
        }

        #view-sfxMaker .sfx-hero-top {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        #view-sfxMaker .sfx-hero h1 {
          margin: 10px 0 6px;
          font-size: 28px;
          line-height: 1;
        }

        #view-sfxMaker .sfx-hero p {
          font-size: 13px;
          line-height: 1.55;
        }

        #view-sfxMaker .sfx-transport {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr 1fr;
          gap: 8px;
          width: 100%;
        }

        #view-sfxMaker .sfx-big-button {
          width: 100%;
          min-height: 48px;
          padding: 12px 10px;
          border-radius: 14px;
          font-size: 14px;
        }

        #view-sfxMaker .sfx-main-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(2) {
          order: 1;
        }

        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(3) {
          order: 2;
        }

        #view-sfxMaker .sfx-main-grid > .sfx-card:nth-child(1) {
          order: 3;
        }

        #view-sfxMaker .sfx-card {
          border-radius: 20px;
        }

        #view-sfxMaker .sfx-card-head {
          padding: 13px 14px;
        }

        #view-sfxMaker .sfx-card-body {
          padding: 12px;
        }

        #view-sfxMaker .sfx-screen {
          padding: 10px;
          border-radius: 16px;
        }

        #view-sfxMaker #sfxWaveCanvas {
          height: 116px;
        }

        #view-sfxMaker .sfx-readout {
          grid-template-columns: repeat(3, minmax(0, 1fr));
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

        #view-sfxMaker .sfx-control-grid {
          grid-template-columns: 1fr;
          gap: 10px;
        }

        #view-sfxMaker .sfx-control {
          padding: 12px;
          border-radius: 16px;
        }

        #view-sfxMaker .sfx-control label {
          margin-bottom: 6px;
          font-size: 13px;
        }

        #view-sfxMaker .sfx-control output {
          padding: 3px 8px;
          border-radius: 999px;
          background: rgba(125, 211, 252, 0.1);
          color: #bae6fd;
          font-size: 12px;
        }

        #view-sfxMaker .sfx-preset-grid {
          display: flex;
          gap: 10px;
          max-height: none;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 4px 10px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        #view-sfxMaker .sfx-preset {
          flex: 0 0 148px;
          min-height: 118px;
          scroll-snap-align: start;
        }
      }

      @media (max-width: 520px) {
        #view-sfxMaker .sfx-app {
          padding: 8px;
        }

        #view-sfxMaker .sfx-hero {
          top: 6px;
          padding: 14px;
          border-radius: 18px;
        }

        #view-sfxMaker .sfx-kicker {
          font-size: 10px;
        }

        #view-sfxMaker .sfx-hero h1 {
          font-size: 25px;
        }

        #view-sfxMaker .sfx-transport {
          grid-template-columns: 1fr 1fr;
        }

        #view-sfxMaker #sfxPreviewButton {
          grid-column: 1 / -1;
          min-height: 52px;
          font-size: 16px;
        }

        #view-sfxMaker .sfx-readout {
          grid-template-columns: 1fr;
        }

        #view-sfxMaker .sfx-download {
          width: 100%;
          min-height: 52px;
        }

        #view-sfxMaker .sfx-status {
          padding: 10px 11px;
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.68);
        }
      }
    `;
    document.head.append(style);
  }

  function bindRangeGuards(root = document) {
    root.querySelectorAll('#view-sfxMaker input[type="range"]').forEach((range) => {
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

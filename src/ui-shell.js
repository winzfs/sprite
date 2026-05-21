(() => {
  const buttons = Array.from(document.querySelectorAll('.nav-btn'));
  const views = {
    sprite: document.getElementById('view-sprite'),
    videoToGif: document.getElementById('view-videoToGif'),
    gifToVideo: document.getElementById('view-gifToVideo'),
  };
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
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.view === key);
    });

    Object.entries(views).forEach(([name, element]) => {
      if (!element) return;
      element.classList.toggle('active', name === key);
    });

    closeMenu();
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });

  menuButton?.addEventListener('click', toggleMenu);
  menuOverlay?.addEventListener('click', closeMenu);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  showView('sprite');
})();

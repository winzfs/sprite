(() => {
  const buttons = Array.from(document.querySelectorAll('.nav-btn'));
  const views = {
    sprite: document.getElementById('view-sprite'),
    videoToGif: document.getElementById('view-videoToGif'),
    gifToVideo: document.getElementById('view-gifToVideo'),
  };

  function showView(key) {
    buttons.forEach((button) => {
      button.classList.toggle('active', button.dataset.view === key);
    });

    Object.entries(views).forEach(([name, element]) => {
      if (!element) return;
      element.classList.toggle('active', name === key);
    });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => showView(button.dataset.view));
  });

  showView('sprite');
})();

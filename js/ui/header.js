// Верхня панель: перемикач "Акції / Криптовалюта" і кнопка налаштувань.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store } = App;
  const { LANGUAGES } = App.i18n;
  let tabsEl, langBtn;

  function sync() {
    const { tab, lang } = store.get();
    langBtn.textContent = LANGUAGES.find(l => l.id === lang).short;
    tabsEl.dataset.active = tab;
    tabsEl.querySelectorAll('[data-tab]').forEach(button => {
      const active = button.dataset.tab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function init() {
    tabsEl = document.querySelector('.tabs');
    langBtn = document.getElementById('lang-btn');

    // Кнопка мови перемикає по колу: UA -> EN -> UA
    langBtn.addEventListener('click', () => {
      const index = LANGUAGES.findIndex(l => l.id === store.get().lang);
      App.actions.setLanguage(LANGUAGES[(index + 1) % LANGUAGES.length].id);
    });
    tabsEl.addEventListener('click', event => {
      const button = event.target.closest('[data-tab]');
      if (button) store.set({ tab: button.dataset.tab });
    });

    document.getElementById('settings-btn').addEventListener('click', () => App.settings.open());
    document.querySelector('.brand').addEventListener('click', event => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    store.subscribe((state, changed) => {
      if (changed.includes('tab') || changed.includes('lang')) sync();
    });
    sync();
  }

  App.header = { init };
})(window.App);

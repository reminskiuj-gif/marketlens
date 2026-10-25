// Налаштування: тема оформлення, мова і період за замовчуванням.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui } = App;
  const { t } = App.i18n;
  let modal, form;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function applyTheme(theme) {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    document.dispatchEvent(new Event('themechange'));
  }

  // Назви періодів перекладаються, тому список будується заново при зміні мови
  function renderOptions() {
    form.elements.lang.innerHTML = App.i18n.LANGUAGES
      .map(l => `<option value="${l.id}">${l.label}</option>`)
      .join('');
    form.elements.defaultPeriod.innerHTML = Object.keys(App.dataService.PERIODS)
      .map(id => `<option value="${id}">${ui.periodName(id)}</option>`)
      .join('');
    syncForm();
  }

  function syncForm() {
    const state = store.get();
    form.elements.theme.value = state.theme;
    form.elements.lang.value = state.lang;
    form.elements.defaultPeriod.value = state.defaultPeriod;
  }

  function init() {
    modal = document.getElementById('settings-modal');
    form = document.getElementById('settings-form');
    renderOptions();

    form.addEventListener('change', event => {
      const { name, value } = event.target;
      if (name === 'theme') store.set({ theme: value });
      if (name === 'lang') App.actions.setLanguage(value);
      if (name === 'defaultPeriod') {
        store.set({ defaultPeriod: value, period: value });
        ui.toast(t('toast.defaultPeriodSaved'));
      }
    });

    store.subscribe((state, changed) => {
      if (changed.includes('theme')) applyTheme(state.theme);
      if (changed.includes('lang')) renderOptions();
    });

    // Якщо обрано "Як у системі", реагуємо на зміну теми Windows/macOS
    systemDark.addEventListener('change', () => {
      if (store.get().theme === 'system') document.dispatchEvent(new Event('themechange'));
    });

    applyTheme(store.get().theme);
  }

  function open() {
    syncForm();
    ui.openModal(modal);
  }

  App.settings = { init, open };
})(window.App);

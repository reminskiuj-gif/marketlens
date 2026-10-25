// Стан застосунку в одному місці. Модулі підписуються на зміни
// і отримують список змінених полів, щоб перемальовувати лише потрібне.
window.App = window.App || {};

(function (App) {
  'use strict';

  const STORAGE_KEY = 'marketlens.state';
  const saved = App.utils.storage.get(STORAGE_KEY, {});
  const periods = App.dataService.PERIODS;

  const defaultPeriod = periods[saved.defaultPeriod] ? saved.defaultPeriod : 'day';

  const state = {
    tab: saved.tab === 'crypto' ? 'crypto' : 'stocks',
    period: defaultPeriod,
    defaultPeriod,
    theme: ['light', 'dark', 'system'].includes(saved.theme) ? saved.theme : 'dark',
    lang: App.i18n.LANGUAGES.some(l => l.id === saved.lang) ? saved.lang : 'uk',
    sort: { key: 'marketCap', dir: 'desc' },
    // id активів, обраних для порівняння (можна змішувати акції та крипту)
    compare: Array.isArray(saved.compare)
      ? saved.compare.filter(id => App.dataService.getAssetMeta(id))
      : []
  };

  const listeners = [];

  function persist() {
    App.utils.storage.set(STORAGE_KEY, {
      tab: state.tab,
      theme: state.theme,
      lang: state.lang,
      defaultPeriod: state.defaultPeriod,
      compare: state.compare
    });
  }

  App.store = {
    get() {
      return state;
    },

    set(patch) {
      const changed = Object.keys(patch).filter(key => state[key] !== patch[key]);
      if (!changed.length) return;
      Object.assign(state, patch);
      persist();
      listeners.forEach(fn => fn(state, changed));
    },

    subscribe(fn) {
      listeners.push(fn);
    }
  };
})(window.App);

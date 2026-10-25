// Нижня панель порівняння (як "кошик порівняння" в інтернет-магазинах).
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui, dataService } = App;
  const { escapeHtml } = App.utils;
  const { t } = App.i18n;
  const els = {};

  function render() {
    const ids = store.get().compare;
    const max = App.actions.MAX_COMPARE;
    const visible = ids.length > 0;

    els.tray.hidden = !visible;
    document.body.classList.toggle('has-tray', visible);
    if (!visible) return;

    const chips = ids.map(id => {
      const asset = dataService.getAssetMeta(id);
      return `<div class="tray-chip">
        ${ui.logo(asset, 'sm')}
        <strong>${escapeHtml(asset.symbol)}</strong>
        ${ui.typeTag(asset.type)}
        <button data-remove-id="${id}" aria-label="${t('common.remove')} ${escapeHtml(asset.name)}" title="${t('common.remove')}">✕</button>
      </div>`;
    });
    const slots = Array.from({ length: max - ids.length }, () => `<div class="tray-slot">${t('tray.slot')}</div>`);

    els.items.innerHTML = chips.concat(slots).join('');
    els.count.textContent = t('tray.count', { count: ids.length, max });
    els.compareBtn.disabled = ids.length < 2;
    els.compareBtn.textContent = ids.length < 2 ? t('tray.needMore') : t('tray.compare', { count: ids.length });
  }

  function init() {
    els.tray = document.getElementById('compare-tray');
    els.items = document.getElementById('tray-items');
    els.count = document.getElementById('tray-count');
    els.compareBtn = document.getElementById('tray-compare');

    els.items.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-id]');
      if (button) App.actions.toggleCompare(button.dataset.removeId);
    });
    document.getElementById('tray-clear').addEventListener('click', () => store.set({ compare: [] }));
    els.compareBtn.addEventListener('click', () => App.compareView.open());

    store.subscribe((state, changed) => {
      if (changed.includes('compare') || changed.includes('lang')) render();
    });
    render();
  }

  App.compareTray = { init };
})(window.App);

// Пошук одночасно серед акцій і криптовалют з випадаючим списком результатів.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui, dataService } = App;
  const { escapeHtml, debounce } = App.utils;
  const { t } = App.i18n;
  let input, results;

  function hide() {
    results.hidden = true;
  }

  function render() {
    const query = input.value;
    if (!query.trim()) return hide();

    const matches = dataService.search(query);
    const { compare } = store.get();

    results.innerHTML = matches.length
      ? matches.map(asset => {
        const selected = compare.includes(asset.id);
        return `<div class="search-item">
          <button class="search-item-main" data-goto-id="${asset.id}">
            ${ui.logo(asset)}${ui.assetName(asset)}
          </button>
          ${ui.typeTag(asset.type)}
          <button class="compare-btn ${selected ? 'is-on' : ''}" data-compare-id="${asset.id}">
            ${t(selected ? 'search.added' : 'search.add')}
          </button>
        </div>`;
      }).join('')
      : `<div class="search-empty">${escapeHtml(t('search.empty', { query: query.trim() }))}</div>`;
    results.hidden = false;
  }

  function init() {
    input = document.getElementById('search-input');
    results = document.getElementById('search-results');

    input.addEventListener('input', debounce(render, 100));
    input.addEventListener('focus', render);
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        input.value = '';
        hide();
        input.blur();
      }
      if (event.key === 'Enter') {
        const first = results.querySelector('[data-goto-id]');
        if (first) first.click();
      }
    });

    results.addEventListener('click', event => {
      const compareBtn = event.target.closest('[data-compare-id]');
      if (compareBtn) return App.actions.toggleCompare(compareBtn.dataset.compareId);
      const gotoBtn = event.target.closest('[data-goto-id]');
      if (gotoBtn) {
        App.actions.goToAsset(gotoBtn.dataset.gotoId);
        input.value = '';
        hide();
      }
    });

    // composedPath, а не closest: після кліку список перемальовується
    // і натиснута кнопка вже не в DOM
    document.addEventListener('click', event => {
      const insideSearch = event.composedPath().some(el => el.classList && el.classList.contains('search'));
      if (!insideSearch) hide();
    });

    // Клавіша "/" швидко ставить курсор у пошук
    document.addEventListener('keydown', event => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        input.focus();
      }
    });

    store.subscribe((state, changed) => {
      if ((changed.includes('compare') || changed.includes('lang')) && !results.hidden) render();
    });
  }

  App.search = { init };
})(window.App);

// Головний екран розділу: заголовок, вибір періоду, лідери зростання/падіння
// і таблиця всіх активів із сортуванням та вибором для порівняння.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui } = App;
  const { t } = App.i18n;
  const { formatPrice, formatCompact, escapeHtml } = App.utils;

  const MOVERS_COUNT = 5;
  const SKELETON_ROWS = 8;
  const SKELETON_DELAY_MS = 250; // швидкі відповіді (з кешу) обходяться без скелетонів
  const els = {};

  // Обраний сектор (категорія) окремо для кожного розділу; 'all' — без фільтра
  const filters = { stocks: 'all', crypto: 'all' };
  let skeletonTimer = null;
  let lastItems = [];
  let lastState = null;

  function init() {
    els.root = document.getElementById('market');
    els.title = document.getElementById('page-title');
    els.subtitle = document.getElementById('page-subtitle');
    els.period = document.getElementById('period-switch');
    els.gainers = document.getElementById('gainers-list');
    els.losers = document.getElementById('losers-list');
    els.gainersPeriod = document.getElementById('gainers-period');
    els.losersPeriod = document.getElementById('losers-period');
    els.tableTitle = document.getElementById('table-title');
    els.tbody = document.getElementById('assets-tbody');
    els.thead = document.querySelector('.assets-table thead');
    els.changeHeader = document.getElementById('change-header');
    els.categoryHeader = document.getElementById('category-header');
    els.source = document.getElementById('source-badge');
    els.alert = document.getElementById('market-alert');
    els.filter = document.getElementById('category-filter');

    // Делегування подій: один обробник на весь список замість обробника на кожен рядок
    [els.gainers, els.losers].forEach(list => list.addEventListener('click', event => {
      const compareBtn = event.target.closest('[data-compare-id]');
      if (compareBtn) return App.actions.toggleCompare(compareBtn.dataset.compareId);
      const detailsBtn = event.target.closest('[data-details-id]');
      if (detailsBtn) App.actions.openDetails(detailsBtn.dataset.detailsId);
    }));

    els.filter.addEventListener('click', event => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      filters[lastState.tab] = chip.dataset.category;
      renderFilter(lastItems, lastState);
      renderTable(lastItems, lastState, ui.periodLong(lastState.period));
    });

    els.alert.addEventListener('click', event => {
      if (event.target.closest('[data-retry]')) App.actions.retry();
    });

    els.tbody.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-compare-id]');
      if (checkbox) App.actions.toggleCompare(checkbox.dataset.compareId);
    });

    els.tbody.addEventListener('click', event => {
      const link = event.target.closest('[data-details-id]');
      if (link) App.actions.openDetails(link.dataset.detailsId);
    });

    els.thead.addEventListener('click', event => {
      const th = event.target.closest('[data-sort]');
      if (!th) return;
      const { sort } = store.get();
      const key = th.dataset.sort;
      // Повторний клік змінює напрямок; для назви за замовчуванням — за алфавітом
      const dir = sort.key === key
        ? (sort.dir === 'desc' ? 'asc' : 'desc')
        : (key === 'name' ? 'asc' : 'desc');
      store.set({ sort: { key, dir } });
    });
  }

  // Поки дані вантажаться, старий вміст приглушений. Якщо чекати довше
  // за SKELETON_DELAY_MS, замість нього показуємо скелетони
  function setLoading(isLoading) {
    clearTimeout(skeletonTimer);
    els.root.classList.toggle('is-loading', isLoading);
    if (!isLoading) {
      els.root.classList.remove('is-skeleton');
      return;
    }
    skeletonTimer = setTimeout(renderSkeleton, SKELETON_DELAY_MS);
  }

  function renderSkeleton() {
    els.root.classList.add('is-skeleton');
    const moverRows = Array.from({ length: MOVERS_COUNT }, () => `<li class="mover" aria-hidden="true">
      <span class="mover-main"><span class="skeleton skeleton-circle"></span>
        <span class="skeleton-text"><span class="skeleton skeleton-line" style="width:70%"></span><span class="skeleton skeleton-line" style="width:35%"></span></span>
      </span>
      <span class="skeleton skeleton-line" style="width:64px"></span>
      <span class="skeleton skeleton-line" style="width:64px;height:22px"></span>
      <span class="skeleton" style="width:30px;height:30px;border-radius:8px"></span>
    </li>`).join('');
    els.gainers.innerHTML = moverRows;
    els.losers.innerHTML = moverRows;

    const line = width => `<span class="skeleton skeleton-line" style="width:${width}px;margin-left:auto"></span>`;
    els.tbody.innerHTML = Array.from({ length: SKELETON_ROWS }, () => `<tr aria-hidden="true">
      <td class="col-check"><span class="skeleton" style="width:18px;height:18px;border-radius:5px"></span></td>
      <td class="col-rank"><span class="skeleton skeleton-line" style="width:14px"></span></td>
      <td><span class="asset-link"><span class="skeleton skeleton-circle"></span>
        <span class="skeleton-text" style="width:120px"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line" style="width:50%"></span></span></span></td>
      <td>${line(80)}</td>
      <td>${line(70)}</td>
      <td class="col-spark"><span class="skeleton" style="width:110px;height:24px"></span></td>
      <td>${line(64)}</td>
      <td><span class="skeleton skeleton-line" style="width:90px"></span></td>
    </tr>`).join('');
  }

  // Повідомлення над списками: kind — 'offline', 'liveFailed' або null (сховати)
  function showAlert(kind) {
    els.alert.hidden = !kind;
    if (!kind) return;
    els.alert.innerHTML = `<span class="alert-icon" aria-hidden="true">!</span>
      <div class="alert-body">
        <strong>${t(`alert.${kind}.title`)}</strong>
        <p>${t(`alert.${kind}.text`)}</p>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-retry>${t('alert.retry')}</button>`;
  }

  function render(items, state) {
    setLoading(false);
    lastItems = items;
    lastState = state;
    const section = `market.${state.tab}`;
    const periodLong = ui.periodLong(state.period);

    els.title.textContent = t(section + '.title');
    els.subtitle.textContent = t(section + '.subtitle');
    els.tableTitle.textContent = t(section + '.table');
    els.categoryHeader.textContent = t(section + '.category');
    els.gainersPeriod.textContent = periodLong;
    els.losersPeriod.textContent = periodLong;

    renderSource(state);
    ui.periodSwitch(els.period, state.period, value => store.set({ period: value }));
    renderMovers(items, state);
    renderFilter(items, state);
    renderTable(items, state, periodLong);
  }

  // Кнопки-фільтри: "Усі" і кожен сектор (категорія), що є в розділі, з кількістю активів
  function renderFilter(items, state) {
    const counts = {};
    items.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
    const categories = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    const active = filters[state.tab];

    const chip = (value, label, count) => `<button type="button" class="chip ${value === active ? 'is-active' : ''}"
      data-category="${value}" aria-pressed="${value === active}">${escapeHtml(label)}<span class="chip-count">${count}</span></button>`;

    els.filter.setAttribute('aria-label', t(`market.${state.tab}.filterLabel`));
    els.filter.innerHTML = chip('all', t('filter.all'), items.length)
      + categories.map(category => chip(category, t('category.' + category), counts[category])).join('');
  }

  // Позначка "Живі дані" / "Тестові дані" під заголовком
  function renderSource(state) {
    const source = App.dataService.getSourceInfo(state.tab, state.period);
    let text = source.live ? t('source.live', { provider: source.provider }) : t('source.demo');
    // Поки історія акцій вантажиться (ліміт API), показуємо прогрес
    if (source.history && source.history.ready < source.history.total) {
      text += ' · ' + t('source.historyLoading', source.history);
    }
    els.source.className = 'source-badge ' + (source.live ? 'is-live' : 'is-demo');
    els.source.textContent = text;
    els.source.title = t(source.hint);
  }

  // Живе оновлення: міняємо лише ціну, зміну, графік і капіталізацію в потрібних рядках.
  // Рядки таблиці не пересортовуються, щоб не "стрибали" під курсором.
  function updateLive(items, changed, state) {
    renderMovers(items, state);
    changed.forEach(({ item, direction }) => {
      const row = els.tbody.querySelector(`[data-row-id="${CSS.escape(item.id)}"]`);
      if (!row) return;
      const priceCell = row.querySelector('.cell-price');
      priceCell.textContent = formatPrice(item.price);
      row.querySelector('.cell-change').innerHTML = ui.change(item.change);
      row.querySelector('.col-spark').innerHTML = ui.sparkline(item.sparkline);
      row.querySelector('.cell-cap').textContent = formatCompact(item.marketCap);
      // Коротко підсвічуємо ціну зеленим або червоним
      priceCell.classList.remove('tick-up', 'tick-down');
      void priceCell.offsetWidth;
      priceCell.classList.add('tick-' + direction);
    });
  }

  function renderMovers(items, state) {
    // Активи, для яких ще немає історії (change === null), у рейтинг не потрапляють
    const sorted = items.filter(item => item.change !== null).sort((a, b) => b.change - a.change);
    if (!sorted.length) {
      // Без ключа Twelve Data історія не завантажиться взагалі — так і пишемо
      const noHistory = App.dataService.getSourceInfo(state.tab, state.period).hint === 'source.liveHint.stocksNoHistory';
      const empty = `<li class="movers-empty">${t(noHistory ? 'movers.noHistory' : 'movers.loading')}</li>`;
      els.gainers.innerHTML = empty;
      els.losers.innerHTML = empty;
      return;
    }
    const count = Math.min(MOVERS_COUNT, Math.floor(sorted.length / 2) || 1);
    els.gainers.innerHTML = sorted.slice(0, count).map(item => moverRow(item, state)).join('');
    els.losers.innerHTML = sorted.slice(-count).reverse().map(item => moverRow(item, state)).join('');
  }

  function moverRow(item, state) {
    const selected = state.compare.includes(item.id);
    return `<li class="mover">
      <button class="mover-main" data-details-id="${item.id}" title="${t('movers.openDetails')}">
        ${ui.logo(item)}${ui.assetName(item)}
      </button>
      <span class="mover-price">${formatPrice(item.price)}</span>
      ${ui.change(item.change)}
      <button class="compare-btn ${selected ? 'is-on' : ''}" data-compare-id="${item.id}"
        title="${t(selected ? 'compare.remove' : 'compare.add')}"
        aria-pressed="${selected}">${selected ? '✓' : '+'}</button>
    </li>`;
  }

  function sortItems(items, sort) {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name) * factor;
      // Порожні значення (історія ще вантажиться) — завжди в кінці
      if (a[sort.key] === null) return b[sort.key] === null ? 0 : 1;
      if (b[sort.key] === null) return -1;
      return (a[sort.key] - b[sort.key]) * factor;
    });
  }

  function renderTable(items, state, periodLong) {
    els.changeHeader.textContent = t('table.change', { period: periodLong });
    els.thead.querySelectorAll('[data-sort]').forEach(th => {
      th.querySelector('.sort-arrow')?.remove();
      if (th.dataset.sort === state.sort.key) {
        th.insertAdjacentHTML('beforeend', `<span class="sort-arrow">${state.sort.dir === 'asc' ? '▲' : '▼'}</span>`);
        th.setAttribute('aria-sort', state.sort.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    });

    const category = filters[state.tab];
    const visible = category === 'all' ? items : items.filter(item => item.category === category);
    els.tbody.innerHTML = sortItems(visible, state.sort).map((item, index) => {
      const selected = state.compare.includes(item.id);
      return `<tr data-row-id="${item.id}" class="${selected ? 'is-selected' : ''}">
        <td class="col-check">
          <label class="check" title="${t(selected ? 'compare.remove' : 'compare.add')}">
            <input type="checkbox" data-compare-id="${item.id}" ${selected ? 'checked' : ''}
              aria-label="${escapeHtml(t('compare.itemLabel', { name: item.name }))}"><span></span>
          </label>
        </td>
        <td class="col-rank">${index + 1}</td>
        <td><button class="asset-link" data-details-id="${item.id}" title="${t('movers.openDetails')}">${ui.logo(item)}${ui.assetName(item)}</button></td>
        <td class="num cell-price">${formatPrice(item.price)}</td>
        <td class="num cell-change">${ui.change(item.change)}</td>
        <td class="col-spark">${ui.sparkline(item.sparkline)}</td>
        <td class="num cell-cap">${formatCompact(item.marketCap)}</td>
        <td class="muted">${ui.category(item)}</td>
      </tr>`;
    }).join('');
  }

  // Прокручує таблицю до активу і коротко підсвічує рядок
  function highlight(id) {
    let row = els.tbody.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
    // Рядок міг бути схований фільтром — тоді знімаємо фільтр
    if (!row && lastState && filters[lastState.tab] !== 'all') {
      filters[lastState.tab] = 'all';
      renderFilter(lastItems, lastState);
      renderTable(lastItems, lastState, ui.periodLong(lastState.period));
      row = els.tbody.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
    }
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.classList.remove('flash');
    void row.offsetWidth; // перезапуск анімації
    row.classList.add('flash');
  }

  App.marketView = { init, render, setLoading, showAlert, highlight, updateLive };
})(window.App);

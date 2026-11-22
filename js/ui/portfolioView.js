// Сторінка "Мій портфель" (#/portfolio): створення профілю, підсумки портфеля,
// таблиця позицій, діаграма розподілу і вікно додавання покупки.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { ui, dataService, portfolio } = App;
  const { formatPrice, formatNumber, formatDate, colorFromString, escapeHtml } = App.utils;
  const { t } = App.i18n;

  const DAY_MS = 24 * 60 * 60 * 1000;

  // Приклад портфеля: [id активу, кількість, ціна покупки як частка від орієнтовної ціни, скільки днів тому]
  const DEMO_PURCHASES = [
    ['stocks:AAPL', 10, 0.82, 300],
    ['stocks:NVDA', 25, 0.7, 210],
    ['stocks:KO', 30, 0.95, 120],
    ['crypto:BTC', 0.05, 0.9, 180],
    ['crypto:ETH', 1.5, 1.15, 90],
    ['crypto:SOL', 12, 0.8, 45]
  ];

  const els = {};
  let isOpen = false;
  let editingName = false;
  let prices = null; // Map: id активу -> поточна ціна; null — ще вантажаться
  let requestId = 0;
  let chart = null;

  function init() {
    els.page = document.getElementById('portfolio-page');
    els.profileBtn = document.getElementById('profile-btn');
    els.modal = document.getElementById('purchase-modal');
    els.form = document.getElementById('purchase-form');
    els.total = document.getElementById('purchase-total');
    els.error = document.getElementById('purchase-error');

    els.profileBtn.addEventListener('click', () => { location.hash = '#/portfolio'; });

    els.page.addEventListener('submit', onProfileSubmit);
    els.page.addEventListener('click', onPageClick);

    els.form.addEventListener('input', event => {
      if (event.target.name === 'assetId') fillPrice();
      renderTotal();
    });
    els.form.addEventListener('submit', onPurchaseSubmit);

    portfolio.subscribe(() => {
      renderProfileButton();
      if (isOpen) {
        render();
        loadPrices();
      }
    });
    App.store.subscribe((state, changed) => {
      if (!changed.includes('lang')) return;
      renderProfileButton();
      if (isOpen) render();
    });
    document.addEventListener('themechange', () => {
      if (isOpen) renderChart();
    });

    renderProfileButton();
  }

  // Кнопка в шапці: ініціали користувача або значок людини, якщо профілю немає
  function renderProfileButton() {
    const profile = portfolio.getProfile();
    els.profileBtn.classList.toggle('has-profile', Boolean(profile));
    els.profileBtn.innerHTML = profile
      ? `<span class="avatar avatar-sm">${escapeHtml(initials(profile.name))}</span>`
      : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0].toUpperCase()).join('');
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    editingName = false;
    els.page.hidden = false;
    document.title = t('portfolio.pageTitle');
    window.scrollTo(0, 0);
    render();
    loadPrices();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    requestId++;
    destroyChart();
    els.page.hidden = true;
    document.title = t('meta.title');
  }

  // Поточні ціни беремо з того самого джерела, що й головний екран
  async function loadPrices() {
    const types = [...new Set(portfolio.getHoldings().map(h => h.asset.type))];
    const currentRequest = ++requestId;
    prices = null;
    await App.actions.whenMarketLoaded();
    const lists = await Promise.all(types.map(type => dataService.getMarketOverview(type, 'day')));
    if (currentRequest !== requestId) return;
    prices = new Map();
    lists.flat().forEach(item => prices.set(item.id, item.price));
    if (isOpen) render();
  }

  // ---------- відображення ----------

  function render() {
    destroyChart();
    const profile = portfolio.getProfile();
    if (!profile || editingName) {
      els.page.innerHTML = profileForm(profile);
      els.page.querySelector('input').focus();
      return;
    }
    const holdings = portfolio.getHoldings();
    els.page.innerHTML = header(profile) + (holdings.length ? portfolioBody(holdings) : emptyState());
    if (holdings.length && prices) renderChart();
  }

  function profileForm(profile) {
    const editing = Boolean(profile);
    return `<section class="card profile-card">
      <div class="avatar avatar-lg" aria-hidden="true">${editing ? escapeHtml(initials(profile.name)) : '👤'}</div>
      <h1>${t(editing ? 'portfolio.editTitle' : 'portfolio.createTitle')}</h1>
      ${editing ? '' : `<p class="muted">${t('portfolio.createText')}</p>`}
      <form class="profile-form" data-profile-form>
        <label class="field">
          <span>${t('portfolio.nameLabel')}</span>
          <input name="name" maxlength="40" required autocomplete="given-name"
            placeholder="${escapeHtml(t('portfolio.namePlaceholder'))}" value="${editing ? escapeHtml(profile.name) : ''}">
        </label>
        <div class="profile-form-actions">
          ${editing ? `<button type="button" class="btn btn-ghost" data-action="cancel-edit">${t('portfolio.cancel')}</button>` : ''}
          <button type="submit" class="btn btn-primary">${t(editing ? 'portfolio.save' : 'portfolio.create')}</button>
        </div>
      </form>
      <p class="muted small">🔒 ${t('portfolio.localNote')}</p>
    </section>`;
  }

  function header(profile) {
    return `<section class="portfolio-head">
      <div class="portfolio-user">
        <div class="avatar avatar-lg" aria-hidden="true">${escapeHtml(initials(profile.name))}</div>
        <div>
          <h1>${escapeHtml(t('portfolio.hello', { name: profile.name }))}</h1>
          <p class="muted small">${t('portfolio.since', { date: formatDate(profile.createdAt) })} · ${t('portfolio.localNote')}</p>
        </div>
      </div>
      <div class="portfolio-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="rename">${t('portfolio.rename')}</button>
        <button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="delete">${t('portfolio.delete')}</button>
        <button type="button" class="btn btn-primary" data-action="add">${t('portfolio.add')}</button>
      </div>
    </section>`;
  }

  function emptyState() {
    return `<section class="card empty-state">
      <div class="empty-icon" aria-hidden="true">📊</div>
      <h2>${t('portfolio.emptyTitle')}</h2>
      <p class="muted">${t('portfolio.emptyText')}</p>
      <div class="profile-form-actions">
        <button type="button" class="btn btn-ghost" data-action="demo">${t('portfolio.demo')}</button>
        <button type="button" class="btn btn-primary" data-action="add">${t('portfolio.add')}</button>
      </div>
    </section>`;
  }

  const skeleton = '<span class="skeleton skeleton-line" style="width:70px;margin-left:auto"></span>';

  function portfolioBody(holdings) {
    // Поки ціни вантажаться, замість сум показуємо скелетони
    const rows = holdings.map(h => {
      const price = prices && prices.get(h.asset.id);
      const value = price * h.quantity;
      const profitPct = (price / h.avgPrice - 1) * 100;
      return { ...h, price, value, profit: value - h.cost, profitPct };
    });
    const totalValue = rows.reduce((sum, r) => sum + r.value, 0);
    const totalCost = rows.reduce((sum, r) => sum + r.cost, 0);
    const totalProfit = totalValue - totalCost;

    const stat = (label, value) => `<div class="card stat"><div class="stat-label">${label}</div><div class="stat-value">${prices ? value : '<span class="skeleton"></span>'}</div></div>`;
    const summary = `<section class="asset-stats portfolio-summary">
      ${stat(t('portfolio.value'), formatPrice(totalValue))}
      ${stat(t('portfolio.invested'), formatPrice(totalCost))}
      ${stat(t('portfolio.profit'), `${signedPrice(totalProfit)} ${ui.change((totalValue / totalCost - 1) * 100)}`)}
      <div class="card stat"><div class="stat-label">${t('portfolio.positions')}</div><div class="stat-value">${rows.length}</div></div>
    </section>`;

    const tableRows = rows
      .sort((a, b) => (b.value || b.cost) - (a.value || a.cost))
      .map(r => `<tr>
        <td><button class="asset-link" data-details-id="${r.asset.id}" title="${t('movers.openDetails')}">${ui.logo(r.asset)}${ui.assetName(r.asset)}</button></td>
        <td class="num">${formatNumber(r.quantity)}</td>
        <td class="num">${formatPrice(r.avgPrice)}</td>
        <td class="num">${prices ? formatPrice(r.price) : skeleton}</td>
        <td class="num">${prices ? formatPrice(r.value) : skeleton}</td>
        <td class="num">${prices ? `<div class="profit-cell">${signedPrice(r.profit)}${ui.change(r.profitPct)}</div>` : skeleton}</td>
        <td class="col-remove"><button class="remove-btn" data-remove-asset="${r.asset.id}"
          title="${escapeHtml(t('portfolio.removeAsset', { name: r.asset.name }))}"
          aria-label="${escapeHtml(t('portfolio.removeAsset', { name: r.asset.name }))}">✕</button></td>
      </tr>`).join('');

    const legend = prices ? rows.map(r => `<li>
        <span class="legend-dot" style="--dot:${colorFromString(r.asset.symbol)}"></span>
        <span>${escapeHtml(r.asset.symbol)}</span>
        <strong>${formatNumber(Math.round(r.value / totalValue * 1000) / 10)}%</strong>
      </li>`).join('') : '';

    return `${summary}
      <section class="portfolio-grid">
        <article class="card">
          <header class="card-header"><h2>${t('portfolio.holdings')}</h2></header>
          <div class="table-wrap">
            <table class="assets-table portfolio-table">
              <thead><tr>
                <th>${t('portfolio.col.asset')}</th>
                <th class="num">${t('portfolio.col.quantity')}</th>
                <th class="num">${t('portfolio.col.avgPrice')}</th>
                <th class="num">${t('portfolio.col.price')}</th>
                <th class="num">${t('portfolio.col.value')}</th>
                <th class="num">${t('portfolio.col.profit')}</th>
                <th class="col-remove"></th>
              </tr></thead>
              <tbody>${tableRows}</tbody>
            </table>
          </div>
        </article>
        <article class="card allocation-card">
          <header class="card-header"><h2>${t('portfolio.allocation')}</h2></header>
          <div class="allocation-chart">${prices ? '<canvas id="allocation-chart"></canvas>' : '<span class="skeleton skeleton-donut"></span>'}</div>
          <ul class="allocation-legend">${legend}</ul>
        </article>
      </section>`;
  }

  // Сума зі знаком: +$120,50 або −$40,00
  function signedPrice(value) {
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `<span class="${value >= 0 ? 'text-up' : 'text-down'}">${sign}${formatPrice(Math.abs(value))}</span>`;
  }

  // Кругова діаграма: частка кожного активу у вартості портфеля
  function renderChart() {
    destroyChart();
    const canvas = document.getElementById('allocation-chart');
    if (!canvas || !prices) return;
    const holdings = portfolio.getHoldings();
    chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: holdings.map(h => h.asset.symbol),
        datasets: [{
          data: holdings.map(h => prices.get(h.asset.id) * h.quantity),
          backgroundColor: holdings.map(h => colorFromString(h.asset.symbol)),
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
          borderWidth: 3,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatPrice(ctx.parsed)}` } }
        }
      }
    });
  }

  function destroyChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  // ---------- дії ----------

  function onProfileSubmit(event) {
    if (!event.target.matches('[data-profile-form]')) return;
    event.preventDefault();
    const name = event.target.elements.name.value.trim();
    if (!name) return;
    const exists = Boolean(portfolio.getProfile());
    editingName = false;
    if (exists) portfolio.rename(name);
    else portfolio.createProfile(name);
  }

  function onPageClick(event) {
    const details = event.target.closest('[data-details-id]');
    if (details) return App.actions.openDetails(details.dataset.detailsId);
    const remove = event.target.closest('[data-remove-asset]');
    if (remove) return portfolio.removeAsset(remove.dataset.removeAsset);

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'add') openPurchaseForm();
    if (action === 'demo') fillDemo();
    if (action === 'rename' || action === 'cancel-edit') {
      editingName = action === 'rename';
      render();
    }
    if (action === 'delete' && confirm(t('portfolio.confirmDelete'))) {
      portfolio.deleteProfile();
      ui.toast(t('toast.profileDeleted'));
    }
  }

  function fillDemo() {
    DEMO_PURCHASES.forEach(([assetId, quantity, priceFactor, daysAgo]) => {
      const asset = dataService.getAssetMeta(assetId);
      portfolio.addPurchase({
        assetId,
        quantity,
        price: Number((asset.price * priceFactor).toPrecision(6)),
        date: Date.now() - daysAgo * DAY_MS
      });
    });
  }

  // ---------- вікно "Нова покупка" ----------

  // Відкриває вікно; assetId і price — якщо покупку додають зі сторінки активу
  function openPurchaseForm(assetId, price) {
    if (!portfolio.getProfile()) {
      ui.toast(t('toast.needProfile'));
      location.hash = '#/portfolio';
      return;
    }
    const groups = ['stocks', 'crypto'].map(type => `<optgroup label="${t('nav.' + type)}">
      ${App.ASSETS[type].map(a => `<option value="${a.id}">${escapeHtml(a.symbol)} — ${escapeHtml(a.name)}</option>`).join('')}
    </optgroup>`).join('');
    const form = els.form.elements;
    form.assetId.innerHTML = groups;
    form.assetId.value = assetId || App.ASSETS.stocks[0].id;
    form.quantity.value = '';
    form.date.value = new Date().toISOString().slice(0, 10);
    form.date.max = form.date.value;
    fillPrice(price);
    els.error.hidden = true;
    renderTotal();
    ui.openModal(els.modal);
    form.quantity.focus();
  }

  // Ціна за замовчуванням — поточна (якщо відома) або орієнтовна з довідника
  function fillPrice(price) {
    const form = els.form.elements;
    const id = form.assetId.value;
    const known = price || (prices && prices.get(id)) || dataService.getAssetMeta(id).price;
    form.price.value = Number(known.toPrecision(6));
  }

  function renderTotal() {
    const form = els.form.elements;
    const total = Number(form.quantity.value) * Number(form.price.value);
    els.total.textContent = total > 0 ? t('portfolio.form.total', { total: formatPrice(total) }) : '';
  }

  function onPurchaseSubmit(event) {
    event.preventDefault();
    const form = els.form.elements;
    const quantity = Number(form.quantity.value);
    const price = Number(form.price.value);
    if (!(quantity > 0) || !(price > 0)) {
      els.error.textContent = t('portfolio.form.invalid');
      els.error.hidden = false;
      return;
    }
    const asset = dataService.getAssetMeta(form.assetId.value);
    portfolio.addPurchase({
      assetId: asset.id,
      quantity,
      price,
      date: form.date.valueAsNumber || Date.now()
    });
    ui.closeModal(els.modal);
    ui.toast(t('toast.portfolioAdded', { name: asset.name }));
  }

  App.portfolioView = { init, open, close, openPurchaseForm };
})(window.App);

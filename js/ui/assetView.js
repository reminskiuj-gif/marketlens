// Детальна сторінка активу: ціна, великий графік за період, основні показники
// і схожі активи. Відкривається за адресою #/asset/<id> (див. route() в app.js).
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui, dataService } = App;
  const { formatPrice, formatPercent, formatCompact, formatAmount, formatAxisDate, formatFullDate,
    escapeHtml, seriesMetrics } = App.utils;
  const { t } = App.i18n;

  const els = {};
  let chart = null;
  let assetId = null; // актив, відкритий зараз; null — сторінка схована
  let period = 'week';
  let series = null; // ряд цін за обраний період
  let requestId = 0;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function init() {
    els.page = document.getElementById('asset-page');
    els.back = document.getElementById('asset-back');
    els.title = document.getElementById('asset-title');
    els.price = document.getElementById('asset-price');
    els.change = document.getElementById('asset-change');
    els.compare = document.getElementById('asset-compare');
    els.period = document.getElementById('asset-period');
    els.chartBox = els.page.querySelector('.asset-chart-box');
    els.canvas = document.getElementById('asset-chart');
    els.stats = document.getElementById('asset-stats');
    els.similarCard = document.getElementById('asset-similar-card');
    els.similarTitle = document.getElementById('asset-similar-title');
    els.similar = document.getElementById('asset-similar');

    // Повертаємось до таблиці й підсвічуємо рядок, з якого прийшли
    els.back.addEventListener('click', () => {
      const id = assetId;
      App.actions.showMarket();
      App.actions.goToAsset(id);
    });
    els.compare.addEventListener('click', () => App.actions.toggleCompare(assetId));
    // Ціна покупки за замовчуванням — поточна ціна з графіка
    document.getElementById('asset-portfolio').addEventListener('click', () => {
      App.portfolioView.openPurchaseForm(assetId, series && series[series.length - 1].price);
    });
    els.similar.addEventListener('click', event => {
      const link = event.target.closest('[data-details-id]');
      if (link) App.actions.openDetails(link.dataset.detailsId);
    });

    store.subscribe((state, changed) => {
      if (!assetId) return;
      if (changed.includes('compare')) renderCompareButton();
      if (changed.includes('lang')) {
        renderStatic();
        if (series) renderData();
      }
    });

    // Кольори графіка беруться з теми, тому при її зміні перемальовуємо
    document.addEventListener('themechange', () => {
      if (assetId && series) renderChart();
    });
  }

  function open(id) {
    const isNewAsset = id !== assetId;
    assetId = id;
    els.page.hidden = false;
    if (!isNewAsset) return;
    period = store.get().period;
    window.scrollTo(0, 0);
    renderStatic();
    load();
  }

  function close() {
    if (!assetId) return;
    assetId = null;
    series = null;
    requestId++; // відповідь, яка ще в дорозі, вже не потрібна
    if (chart) {
      chart.destroy();
      chart = null;
    }
    els.page.hidden = true;
    document.title = t('meta.title');
  }

  // Усе, що не залежить від періоду: назва, кнопки, схожі активи
  function renderStatic() {
    const asset = dataService.getAssetMeta(assetId);
    document.title = t('asset.pageTitle', { name: asset.name, symbol: asset.symbol });
    els.back.textContent = '← ' + t('asset.back.' + asset.type);
    els.title.innerHTML = `${ui.logo(asset, 'lg')}
      <div>
        <h1>${escapeHtml(asset.name)}</h1>
        <div class="asset-subtitle">
          <strong>${escapeHtml(asset.symbol)}</strong>${ui.typeTag(asset.type)}<span>${ui.category(asset)}</span>
        </div>
      </div>`;
    els.canvas.setAttribute('aria-label', t('asset.chartLabel', { name: asset.name }));
    renderPeriodSwitch();
    renderCompareButton();
    renderSimilar(asset);
  }

  // Період сторінки активу не змінює період головного екрана
  function renderPeriodSwitch() {
    ui.periodSwitch(els.period, period, value => {
      period = value;
      renderPeriodSwitch();
      load();
    });
  }

  function renderCompareButton() {
    const selected = store.get().compare.includes(assetId);
    els.compare.textContent = (selected ? '✓ ' : '+ ') + t(selected ? 'compare.remove' : 'compare.add');
    els.compare.classList.toggle('btn-primary', !selected);
    els.compare.classList.toggle('btn-ghost', selected);
  }

  // Активи того ж розділу і сектору (категорії)
  function renderSimilar(asset) {
    const similar = App.ASSETS[asset.type].filter(a => a.category === asset.category && a.id !== asset.id);
    els.similarCard.hidden = !similar.length;
    els.similarTitle.textContent = t('asset.similar.' + asset.type, { category: ui.category(asset) });
    els.similar.innerHTML = similar.map(a => `<button type="button" class="similar-item" data-details-id="${a.id}">
      ${ui.logo(a, 'sm')}${ui.assetName(a)}
    </button>`).join('');
  }

  async function load() {
    const currentRequest = ++requestId;
    renderSkeleton();
    await App.actions.whenMarketLoaded();
    const data = await dataService.getHistory(assetId, period);
    if (currentRequest !== requestId) return; // за цей час відкрили інший актив чи період
    // Копія, щоб живі ціни не змінювали кеш сервісу даних
    series = data.map(point => ({ ...point }));
    renderData();
  }

  function renderSkeleton() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    els.chartBox.classList.add('is-loading');
    els.canvas.hidden = true;
    els.chartBox.querySelector('.skeleton')?.remove();
    els.chartBox.insertAdjacentHTML('afterbegin', '<span class="skeleton" aria-hidden="true"></span>');
    els.price.innerHTML = '<span class="skeleton"></span>';
    els.change.innerHTML = '<span class="skeleton"></span>';
    els.stats.innerHTML = statTiles().map(([label]) => statTile(label, '<span class="skeleton"></span>')).join('');
  }

  function renderData() {
    els.chartBox.classList.remove('is-loading');
    els.chartBox.querySelector('.skeleton')?.remove();
    els.canvas.hidden = false;
    renderQuote();
    renderChart();
    renderStats();
  }

  function renderQuote() {
    const metrics = seriesMetrics(series);
    els.price.textContent = formatPrice(metrics.end);
    els.change.innerHTML = `${ui.change(metrics.change)}<span class="muted">${ui.periodLong(period)}</span>`;
  }

  // Плитки показників: [назва, функція, що повертає значення]
  function statTiles() {
    const asset = dataService.getAssetMeta(assetId);
    return [
      [t('compare.start'), m => formatPrice(m.start)],
      [t('compare.high'), m => formatPrice(m.high)],
      [t('compare.low'), m => formatPrice(m.low)],
      [t('compare.drawdown'), m => formatPercent(m.maxDrawdown)],
      [t('table.marketCap'), m => formatCompact(m.end * asset.supply)],
      [t('asset.supply.' + asset.type), () => formatAmount(asset.supply)]
    ];
  }

  function statTile(label, value) {
    return `<div class="card stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
  }

  function renderStats() {
    const metrics = seriesMetrics(series);
    els.stats.innerHTML = statTiles().map(([label, value]) => statTile(label, value(metrics))).join('');
  }

  function renderChart() {
    const metrics = seriesMetrics(series);
    const isUp = metrics.change >= 0;
    const lineColor = cssVar(isUp ? '--up' : '--down');
    const fillColor = cssVar(isUp ? '--up-soft' : '--down-soft');
    const textColor = cssVar('--muted');
    const gridColor = cssVar('--border');
    const labels = series.map(point => point.time);

    if (chart) chart.destroy();
    chart = new Chart(els.canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: series.map(point => point.price),
          borderColor: lineColor,
          borderWidth: 2.2,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: lineColor,
          tension: 0.25,
          fill: true,
          // Заливка під лінією: від напівпрозорого кольору вгорі до прозорого внизу
          backgroundColor: context => {
            const { ctx, chartArea } = context.chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, fillColor);
            gradient.addColorStop(1, 'transparent');
            return gradient;
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: ctx => formatFullDate(labels[ctx[0].dataIndex], period),
              label: ctx => formatPrice(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              maxTicksLimit: 8,
              maxRotation: 0,
              callback: (value, index) => formatAxisDate(labels[index], period)
            },
            grid: { display: false }
          },
          y: {
            position: 'right',
            ticks: { color: textColor, callback: value => formatPrice(value) },
            grid: { color: gridColor },
            border: { display: false }
          }
        }
      }
    });
  }

  // Нові ціни з біржі: оновлюємо ціну, зміну, останню точку графіка і показники
  function updateLive(updates) {
    if (!assetId || !series) return;
    const update = updates.find(item => item.id === assetId);
    if (!update) return;
    series[series.length - 1].price = update.price;
    renderQuote();
    renderStats();
    if (chart) {
      chart.data.datasets[0].data[series.length - 1] = update.price;
      chart.update('none');
    }
  }

  App.assetView = { init, open, close, updateLive };
})(window.App);

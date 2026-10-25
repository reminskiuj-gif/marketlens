// Вікно порівняння: спільний графік зміни ціни у % і таблиця показників.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, ui, dataService } = App;
  const { formatPrice, formatPercent, formatAxisDate, formatFullDate, escapeHtml } = App.utils;
  const { t } = App.i18n;

  const SERIES_COLORS = ['#5b8cff', '#f5a524', '#a855f7', '#14b8a6', '#ec4899'];

  const els = {};
  let chart = null;
  let period = 'week';
  let requestId = 0;

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function calcMetrics(series) {
    const prices = series.map(point => point.price);
    const start = prices[0];
    const end = prices[prices.length - 1];
    let peak = start;
    let maxDrawdown = 0;
    prices.forEach(price => {
      peak = Math.max(peak, price);
      maxDrawdown = Math.min(maxDrawdown, (price / peak - 1) * 100);
    });
    return {
      start,
      end,
      change: (end / start - 1) * 100,
      high: Math.max(...prices),
      low: Math.min(...prices),
      maxDrawdown
    };
  }

  async function load() {
    const ids = store.get().compare;
    ui.periodSwitch(els.period, period, value => {
      period = value;
      load();
    });

    const currentRequest = ++requestId;
    const histories = await Promise.all(ids.map(id => dataService.getHistory(id, period)));
    if (currentRequest !== requestId) return; // користувач уже змінив період

    const items = ids.map((id, i) => {
      const series = histories[i];
      return { meta: dataService.getAssetMeta(id), series, metrics: calcMetrics(series), color: SERIES_COLORS[i] };
    });

    renderSummary(items);
    renderChart(items);
    renderTable(items);
  }

  function renderSummary(items) {
    const best = items.reduce((a, b) => (b.metrics.change > a.metrics.change ? b : a));
    els.summary.textContent = t('compare.summary', {
      period: ui.periodLong(period),
      name: best.meta.name,
      change: formatPercent(best.metrics.change)
    });
  }

  function renderChart(items) {
    const labels = items[0].series.map(point => point.time);
    const textColor = cssVar('--muted');
    const gridColor = cssVar('--border');

    const datasets = items.map(item => {
      const base = item.series[0].price;
      return {
        label: item.meta.symbol,
        data: item.series.map(point => (point.price / base - 1) * 100),
        borderColor: item.color,
        backgroundColor: item.color,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25
      };
    });

    if (chart) chart.destroy();
    chart = new Chart(els.canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: textColor, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
          },
          tooltip: {
            callbacks: {
              title: ctx => formatFullDate(labels[ctx[0].dataIndex], period),
              label: ctx => ` ${ctx.dataset.label}: ${formatPercent(ctx.parsed.y)}`
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
            ticks: { color: textColor, callback: value => value + '%' },
            // Лінія нуля (початок періоду) виділена сильніше
            grid: { color: ctx => (ctx.tick.value === 0 ? textColor : gridColor) },
            border: { display: false }
          }
        }
      }
    });
  }

  function renderTable(items) {
    const bestChange = Math.max(...items.map(item => item.metrics.change));
    const rows = [
      [t('compare.current'), m => formatPrice(m.end)],
      [t('compare.start'), m => formatPrice(m.start)],
      [t('compare.change'), m => ui.change(m.change), m => m.change === bestChange && items.length > 1],
      [t('compare.high'), m => formatPrice(m.high)],
      [t('compare.low'), m => formatPrice(m.low)],
      [t('compare.drawdown'), m => formatPercent(m.maxDrawdown)]
    ];

    const head = items.map(item => `<th>
      <span class="compare-col-head" style="--series-color:${item.color}">
        <span class="color-bar"></span>
        ${ui.logo(item.meta)}
        <span class="asset-name"><strong>${escapeHtml(item.meta.name)}</strong><span>${escapeHtml(item.meta.symbol)} ${ui.typeTag(item.meta.type)}</span></span>
        <button class="remove" data-remove-id="${item.meta.id}" title="${t('compare.remove')}" aria-label="${t('common.remove')} ${escapeHtml(item.meta.name)}">✕</button>
      </span>
    </th>`).join('');

    const body = rows.map(([label, format, isBest]) => `<tr>
      <td>${label}</td>
      ${items.map(item => `<td class="${isBest && isBest(item.metrics) ? 'best' : ''}">${format(item.metrics)}</td>`).join('')}
    </tr>`).join('');

    els.table.innerHTML = `<thead><tr><th>${t('compare.metric')}</th>${head}</tr></thead><tbody>${body}</tbody>`;
  }

  function open() {
    if (store.get().compare.length < 2) return;
    period = store.get().period;
    ui.openModal(els.modal);
    load();
  }

  function init() {
    els.modal = document.getElementById('compare-modal');
    els.period = document.getElementById('compare-period');
    els.canvas = document.getElementById('compare-chart');
    els.table = document.getElementById('compare-table');
    els.summary = document.getElementById('compare-summary');

    els.table.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-id]');
      if (button) App.actions.toggleCompare(button.dataset.removeId);
    });

    store.subscribe((state, changed) => {
      if (els.modal.hidden) return;
      if (changed.includes('compare') && state.compare.length < 2) ui.closeModal(els.modal);
      else if (changed.includes('compare') || changed.includes('lang')) load();
    });

    // Кольори графіка беруться з теми, тому при її зміні перемальовуємо
    document.addEventListener('themechange', () => {
      if (!els.modal.hidden) load();
    });
  }

  App.compareView = { init, open };
})(window.App);

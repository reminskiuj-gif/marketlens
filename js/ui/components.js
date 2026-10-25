// Дрібні елементи інтерфейсу, які використовуються в кількох місцях.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { escapeHtml, colorFromString, formatPercent } = App.utils;
  const { t } = App.i18n;

  function logo(asset, size = 'md') {
    const letters = asset.symbol.replace(/[^A-Z]/gi, '').slice(0, asset.type === 'crypto' ? 4 : 3);
    return `<span class="logo logo-${size}" style="--logo-bg:${colorFromString(asset.symbol)}" aria-hidden="true">${escapeHtml(letters)}</span>`;
  }

  function assetName(asset) {
    return `<span class="asset-name"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(asset.symbol)}</span></span>`;
  }

  function change(value) {
    const direction = value > 0.005 ? 'up' : value < -0.005 ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
    return `<span class="change change-${direction}"><span class="change-arrow">${arrow}</span>${formatPercent(value)}</span>`;
  }

  function typeTag(type) {
    return `<span class="tag tag-${type}">${t('tag.' + type)}</span>`;
  }

  function category(asset) {
    return t('category.' + asset.category);
  }

  function periodName(period) {
    return t('period.' + period);
  }

  function periodLong(period) {
    return t(`period.${period}.long`);
  }

  // Міні-графік у вигляді SVG-ламаної
  function sparkline(values, width = 110, height = 32) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    const points = values
      .map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`)
      .join(' ');
    const color = values[values.length - 1] >= values[0] ? 'var(--up)' : 'var(--down)';
    return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }

  // Перемикач періоду (День / Тиждень / Місяць / Рік)
  function periodSwitch(container, activePeriod, onChange) {
    container.innerHTML = Object.keys(App.dataService.PERIODS)
      .map(id => `<button type="button" role="radio" data-period="${id}"
        class="${id === activePeriod ? 'is-active' : ''}"
        aria-checked="${id === activePeriod}">${periodName(id)}</button>`)
      .join('');
    container.onclick = event => {
      const button = event.target.closest('[data-period]');
      if (button) onChange(button.dataset.period);
    };
  }

  let toastTimer;
  function toast(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  // Модальні вікна: закриття по кнопці, фону або клавіші Esc
  const openModals = [];

  function openModal(modal) {
    if (!modal.hidden) return;
    modal.hidden = false;
    openModals.push(modal);
    document.body.classList.add('modal-open');
    const focusTarget = modal.querySelector('[data-close].icon-btn');
    if (focusTarget) focusTarget.focus();
  }

  function closeModal(modal) {
    if (modal.hidden) return;
    modal.hidden = true;
    openModals.splice(openModals.indexOf(modal), 1);
    if (!openModals.length) document.body.classList.remove('modal-open');
    modal.dispatchEvent(new Event('modalclose'));
  }

  document.addEventListener('click', event => {
    const closer = event.target.closest('[data-close]');
    if (closer) closeModal(closer.closest('.modal'));
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openModals.length) closeModal(openModals[openModals.length - 1]);
  });

  App.ui = {
    logo, assetName, change, typeTag, category, periodName, periodLong,
    sparkline, periodSwitch, toast, openModal, closeModal
  };
})(window.App);

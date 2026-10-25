// Спільні допоміжні функції: форматування, генератор випадкових чисел, сховище.
window.App = window.App || {};

(function (App) {
  'use strict';

  // Детермінований генератор випадкових чисел (mulberry32).
  // Однаковий seed дає однакову послідовність, тому тестові дані
  // не змінюються після перезавантаження сторінки.
  function createRandom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Перетворює рядок на число (хеш FNV-1a), щоб отримати seed для активу
  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Випадкове число з нормального розподілу (перетворення Бокса–Мюллера)
  function gaussian(rand) {
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Формат чисел і дат залежить від мови (1 234,56 чи 1,234.56),
  // тому форматери створюються для кожної локалі один раз і кешуються
  const formatterCache = new Map();

  function locale() {
    return App.i18n.getLocale();
  }

  function formatters() {
    const loc = locale();
    if (!formatterCache.has(loc)) {
      formatterCache.set(loc, {
        compact: new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 2 }),
        time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }),
        day: new Intl.DateTimeFormat(loc, { day: '2-digit', month: '2-digit' }),
        month: new Intl.DateTimeFormat(loc, { month: 'short', year: '2-digit' }),
        fullDate: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }),
        fullDateTime: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      });
    }
    return formatterCache.get(loc);
  }

  function formatPrice(value) {
    if (value == null || isNaN(value)) return '—';
    const options = value >= 1
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumSignificantDigits: 4 };
    return '$' + value.toLocaleString(locale(), options);
  }

  function formatPercent(value) {
    if (value == null || isNaN(value)) return '—';
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return sign + Math.abs(value).toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }

  function formatCompact(value) {
    return '$' + formatters().compact.format(value);
  }

  // Підпис осі графіка залежить від періоду: години для дня, місяці для року
  function formatAxisDate(time, period) {
    if (period === 'day') return formatters().time.format(time);
    if (period === 'year') return formatters().month.format(time);
    return formatters().day.format(time);
  }

  function formatFullDate(time, period) {
    return period === 'day' ? formatters().fullDateTime.format(time) : formatters().fullDate.format(time);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // Стабільний колір для "логотипа" активу
  function colorFromString(str) {
    return `hsl(${hashString(str) % 360}, 55%, 45%)`;
  }

  // Обгортка над localStorage: у приватному режимі він може бути недоступний
  const storage = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) { /* ігноруємо: налаштування просто не збережуться */ }
    }
  };

  App.utils = {
    createRandom,
    hashString,
    gaussian,
    formatPrice,
    formatPercent,
    formatCompact,
    formatAxisDate,
    formatFullDate,
    escapeHtml,
    debounce,
    colorFromString,
    storage
  };
})(window.App);

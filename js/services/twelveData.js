// Клієнт Twelve Data: історія цін акцій (щоденна і погодинна).
// Безкоштовний тариф: 8 запитів на хвилину і 800 на день, один тікер = один запит.
// Тому запити стоять у черзі, а щоденна історія зберігається в браузері на 12 годин:
// перше завантаження всіх 30 акцій триває кілька хвилин, далі — миттєво.
window.App = window.App || {};

(function (App) {
  'use strict';

  const REST_URL = 'https://api.twelvedata.com';
  // Ліміт тарифу — 8 на хвилину, але беремо 6: залишаємо запас, якщо цим самим ключем
  // користуються в іншій вкладці чи на іншому комп'ютері
  const CREDITS_PER_MINUTE = 6;
  const STORAGE_KEY = 'marketlens.stockHistory';

  const INTERVALS = {
    '1day': { outputsize: 370, ttl: 12 * 60 * 60 * 1000, persist: true },
    '1h': { outputsize: 16, ttl: 30 * 60 * 1000, persist: true }
  };

  const cache = new Map(App.utils.storage.get(STORAGE_KEY, [])); // "AAPL:1day" -> { at, data }
  const pending = new Map(); // запити, що вже стоять у черзі
  const queue = [];
  const spent = []; // час кожного витраченого запиту за останню хвилину
  let blockedUntil = 0; // після відмови через ліміт чекаємо до наступної хвилини
  let pumpTimer = null;

  function apiKey() {
    return (App.CONFIG && App.CONFIG.twelveDataKey) || '';
  }

  function saveCache() {
    const persistent = [...cache].filter(([key]) => INTERVALS[key.split(':')[1]].persist);
    App.utils.storage.set(STORAGE_KEY, persistent);
  }

  // Дати приходять у UTC (параметр timezone=UTC). Для денних свічок беремо
  // час закриття біржі (~21:00 UTC), для погодинних — кінець години.
  function parseTime(datetime, interval) {
    if (interval === '1day') return Date.parse(datetime + 'T21:00:00Z');
    return Date.parse(datetime.replace(' ', 'T') + 'Z') + 60 * 60 * 1000;
  }

  function parseSeries(response, interval) {
    if (response.status !== 'ok') throw new Error(response.message || 'Twelve Data error');
    return response.values
      .map(v => ({ time: parseTime(v.datetime, interval), price: parseFloat(v.close) }))
      .reverse(); // API повертає від нових до старих
  }

  function creditsLeft() {
    if (Date.now() < blockedUntil) return 0;
    const minuteAgo = Date.now() - 60 * 1000;
    while (spent.length && spent[0] < minuteAgo) spent.shift();
    return CREDITS_PER_MINUTE - spent.length;
  }

  function waitTime() {
    if (Date.now() < blockedUntil) return blockedUntil - Date.now();
    return spent[0] + 60 * 1000 - Date.now() + 200;
  }

  // Бере з черги стільки запитів, скільки дозволяє ліміт, і відправляє їх одним пакетом
  async function pump() {
    pumpTimer = null;
    if (!queue.length) return;
    const available = creditsLeft();
    if (available <= 0) {
      pumpTimer = setTimeout(pump, waitTime());
      return;
    }

    const interval = queue[0].interval;
    const batch = [];
    for (let i = 0; i < queue.length && batch.length < available;) {
      if (queue[i].interval === interval) batch.push(...queue.splice(i, 1));
      else i++;
    }
    batch.forEach(() => spent.push(Date.now()));

    try {
      const url = new URL(REST_URL + '/time_series');
      url.searchParams.set('symbol', batch.map(job => job.symbol).join(','));
      url.searchParams.set('interval', interval);
      url.searchParams.set('outputsize', INTERVALS[interval].outputsize);
      url.searchParams.set('timezone', 'UTC');
      url.searchParams.set('apikey', apiKey());
      const json = await (await fetch(url)).json();

      if (json.code === 429) {
        // Ліміт вичерпано раніше, ніж ми рахували (Twelve Data рахує по календарних хвилинах) —
        // повертаємо запити в чергу і чекаємо початку наступної хвилини
        queue.unshift(...batch);
        blockedUntil = Math.ceil((Date.now() + 1) / 60000) * 60000 + 1500;
      } else {
        batch.forEach(job => {
          const response = batch.length === 1 ? json : json[job.symbol];
          try {
            const data = parseSeries(response, interval);
            cache.set(`${job.symbol}:${interval}`, { at: Date.now(), data });
            job.resolve(data);
          } catch (error) {
            job.reject(error);
          }
        });
        saveCache();
      }
    } catch (error) {
      batch.forEach(job => job.reject(error));
    }
    if (queue.length && !pumpTimer) pumpTimer = setTimeout(pump, 0);
  }

  // Історія з кешу або null, без запиту до API
  function peek(symbol, interval) {
    const cached = cache.get(`${symbol}:${interval}`);
    if (cached && Date.now() - cached.at < INTERVALS[interval].ttl) return cached.data;
    return null;
  }

  // Історія цін [{ time, price }] — з кешу або через чергу запитів
  function getHistory(symbol, interval, { priority = false } = {}) {
    const ready = peek(symbol, interval);
    if (ready) return Promise.resolve(ready);
    const key = `${symbol}:${interval}`;
    if (!pending.has(key)) {
      const promise = new Promise((resolve, reject) => {
        const job = { symbol, interval, resolve, reject };
        // Пріоритетні запити (наприклад, для вікна порівняння) стають на початок черги
        if (priority) queue.unshift(job);
        else queue.push(job);
      }).finally(() => pending.delete(key));
      pending.set(key, promise);
      if (!pumpTimer) pumpTimer = setTimeout(pump, 0);
    }
    return pending.get(key);
  }

  App.twelveData = {
    isConfigured: () => Boolean(apiKey()),
    peek,
    getHistory
  };
})(window.App);

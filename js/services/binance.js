// Клієнт публічного API Binance: історія цін (REST) і живі ціни (WebSocket).
// API-ключ не потрібен. Використовуємо адреси data-api / data-stream.binance.vision,
// які Binance виділив саме для публічних ринкових даних.
window.App = window.App || {};

(function (App) {
  'use strict';

  const REST_URL = 'https://data-api.binance.vision/api/v3';
  const WS_URL = 'wss://data-stream.binance.vision/stream';

  // Для кожного періоду: розмір свічки, їх кількість і скільки тримати в кеші
  const KLINES = {
    day: { interval: '1h', limit: 24, ttl: 60 * 1000 },
    week: { interval: '4h', limit: 42, ttl: 5 * 60 * 1000 },
    month: { interval: '1d', limit: 30, ttl: 15 * 60 * 1000 },
    year: { interval: '1d', limit: 365, ttl: 60 * 60 * 1000 }
  };

  const cache = new Map(); // "BTCUSDT:week" -> { at, data }

  async function request(path, params) {
    const url = new URL(REST_URL + path);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Binance: ${response.status}`);
    return response.json();
  }

  // Історія цін за період: [{ time, price }].
  // Перша точка — ціна на початку періоду, остання — поточна ціна.
  async function getHistory(pair, period) {
    const cfg = KLINES[period];
    const key = `${pair}:${period}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < cfg.ttl) return cached.data;

    // Свічка: [час відкриття, open, high, low, close, обсяг, час закриття, ...]
    const candles = await request('/klines', { symbol: pair, interval: cfg.interval, limit: cfg.limit });
    const now = Date.now();
    const data = [{ time: candles[0][0], price: parseFloat(candles[0][1]) }]
      .concat(candles.map(c => ({ time: Math.min(c[6], now), price: parseFloat(c[4]) })));

    cache.set(key, { at: now, data });
    return data;
  }

  // Нова ціна з WebSocket оновлює останню точку в усіх збережених рядах,
  // щоб графіки й таблиці, відкриті пізніше, теж показували актуальну ціну
  function applyLivePrice(pair, price) {
    Object.keys(KLINES).forEach(period => {
      const cached = cache.get(`${pair}:${period}`);
      if (!cached) return;
      const last = cached.data[cached.data.length - 1];
      last.price = price;
      last.time = Date.now();
    });
  }

  // Живі ціни. onPrice(pair, price) викликається приблизно раз на секунду для кожної пари.
  // Повертає функцію, яка закриває з'єднання.
  function streamPrices(pairs, onPrice) {
    let socket = null;
    let retries = 0;
    let retryTimer = null;
    let stopped = false;

    function connect() {
      const streams = pairs.map(pair => pair.toLowerCase() + '@miniTicker').join('/');
      socket = new WebSocket(`${WS_URL}?streams=${streams}`);
      socket.onopen = () => { retries = 0; };
      socket.onmessage = event => {
        const { data } = JSON.parse(event.data);
        if (data && data.s) onPrice(data.s, parseFloat(data.c));
      };
      // Якщо з'єднання обірвалось, підключаємось знову з паузою 1, 2, 4… до 30 секунд
      socket.onclose = () => {
        if (stopped) return;
        retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retries++));
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      if (socket) socket.close();
    };
  }

  App.binance = { getHistory, applyLivePrice, streamPrices };
})(window.App);

// Клієнт Finnhub: поточні ціни акцій (REST) і живі угоди (WebSocket).
// Потрібен безкоштовний ключ у js/config.local.js. Безкоштовний тариф дає
// 60 запитів на хвилину, але не дає історії цін — її бере twelveData.js.
window.App = window.App || {};

(function (App) {
  'use strict';

  const REST_URL = 'https://finnhub.io/api/v1';
  const WS_URL = 'wss://ws.finnhub.io';
  const QUOTE_TTL = 60 * 1000;
  const CLOSED_MARKET_TTL = 10 * 60 * 1000; // коли біржа закрита, ціни не змінюються
  const BATCH_SIZE = 10; // ліміт — 30 запитів на секунду, тому запитуємо пачками
  const STORAGE_KEY = 'marketlens.quotes';

  // Кеш зберігається в браузері, щоб перезавантаження сторінки не витрачало ліміт запитів
  const quoteCache = new Map(App.utils.storage.get(STORAGE_KEY, [])); // "AAPL" -> { at, data }

  function isFresh(cached) {
    const marketClosed = Date.now() - cached.data.time > 60 * 60 * 1000; // остання угода понад годину тому
    return Date.now() - cached.at < (marketClosed ? CLOSED_MARKET_TTL : QUOTE_TTL);
  }

  function apiKey() {
    return (App.CONFIG && App.CONFIG.finnhubKey) || '';
  }

  async function request(path, params) {
    const url = new URL(REST_URL + path);
    Object.entries({ ...params, token: apiKey() }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Finnhub: ${response.status}`);
    return response.json();
  }

  // Поточні ціни: { AAPL: { price, prevClose, open, high, low, changePercent, time } }
  async function getQuotes(symbols) {
    const result = {};
    const missing = symbols.filter(symbol => {
      const cached = quoteCache.get(symbol);
      if (cached && isFresh(cached)) {
        result[symbol] = cached.data;
        return false;
      }
      return true;
    });

    try {
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const chunk = missing.slice(i, i + BATCH_SIZE);
        const quotes = await Promise.all(chunk.map(symbol => request('/quote', { symbol })));
        chunk.forEach((symbol, j) => {
          const q = quotes[j];
          if (!q.c) throw new Error(`Finnhub: немає ціни для ${symbol}`);
          const data = {
            price: q.c,
            prevClose: q.pc,
            open: q.o,
            high: q.h,
            low: q.l,
            changePercent: q.dp,
            time: q.t * 1000
          };
          quoteCache.set(symbol, { at: Date.now(), data });
          result[symbol] = data;
        });
      }
    } catch (error) {
      // Ліміт вичерпано чи мережа впала: якщо є хоч і не свіжі ціни для всіх тікерів — показуємо їх
      const stale = symbols.every(symbol => result[symbol] || quoteCache.has(symbol));
      if (!stale) throw error;
      symbols.forEach(symbol => { result[symbol] = result[symbol] || quoteCache.get(symbol).data; });
      console.warn('Finnhub: показуємо останні збережені ціни', error.message);
    }

    App.utils.storage.set(STORAGE_KEY, [...quoteCache]);
    return result;
  }

  // Нова ціна з WebSocket оновлює кеш, щоб наступне перемальовування її бачило
  function applyLivePrice(symbol, price) {
    const cached = quoteCache.get(symbol);
    if (cached) cached.data.price = price;
  }

  // Живі угоди. Біржа США працює пн–пт 9:30–16:00 за Нью-Йорком (16:30–23:00 за Києвом),
  // поза цим часом повідомлень немає. Повертає функцію, яка закриває з'єднання.
  function streamPrices(symbols, onPrice) {
    let socket = null;
    let retries = 0;
    let retryTimer = null;
    let stopped = false;

    function connect() {
      socket = new WebSocket(`${WS_URL}?token=${apiKey()}`);
      socket.onopen = () => {
        retries = 0;
        symbols.forEach(symbol => socket.send(JSON.stringify({ type: 'subscribe', symbol })));
      };
      socket.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type !== 'trade') return;
        // В одному повідомленні може бути кілька угод — беремо останню ціну для кожного тікера
        const latest = {};
        message.data.forEach(trade => { latest[trade.s] = trade.p; });
        Object.entries(latest).forEach(([symbol, price]) => onPrice(symbol, price));
      };
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

  App.finnhub = {
    isConfigured: () => Boolean(apiKey()),
    getQuotes,
    applyLivePrice,
    streamPrices
  };
})(window.App);

// Сервіс даних — єдина точка, через яку інтерфейс отримує дані.
// Криптовалюта: живі дані Binance (binance.js), ключ не потрібен.
// Акції: живі ціни Finnhub (finnhub.js) + історія Twelve Data (twelveData.js),
// потрібні ключі в js/config.local.js.
// Якщо джерело недоступне чи немає ключа — автоматично показуються тестові дані.
window.App = window.App || {};

(function (App) {
  'use strict';

  // Назви періодів беруться з перекладів: period.<id> і period.<id>.long
  const PERIODS = {
    day: { id: 'day', days: 1 },
    week: { id: 'week', days: 7 },
    month: { id: 'month', days: 30 },
    year: { id: 'year', days: 365 }
  };

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const HISTORY_DAYS = 365;
  const MOCK_DELAY_MS = 120; // імітація затримки мережі для тестових даних
  const LIVE_FLUSH_MS = 1000; // як часто передавати живі ціни в інтерфейс

  const assetsById = new Map();
  Object.values(App.ASSETS).forEach(list => list.forEach(asset => assetsById.set(asset.id, asset)));

  // Звідки зараз беруться дані кожного розділу: 'live' або 'demo'
  const status = { stocks: 'demo', crypto: 'live' };

  // Живі ціни: яке джерело і за яким ключем (пара Binance чи тікер) шукати актив
  const STREAMS = {
    crypto: {
      keyOf: asset => asset.pair,
      start: (keys, onPrice) => App.binance.streamPrices(keys, onPrice),
      apply: (key, price) => App.binance.applyLivePrice(key, price)
    },
    stocks: {
      keyOf: asset => asset.symbol,
      start: (keys, onPrice) => App.finnhub.streamPrices(keys, onPrice),
      apply: (key, price) => App.finnhub.applyLivePrice(key, price)
    }
  };

  // ---------- тестові дані ----------

  const mockCache = new Map();

  function cached(key, create) {
    if (!mockCache.has(key)) mockCache.set(key, create());
    return mockCache.get(key);
  }

  function getMockSeries(asset, period) {
    const daily = cached(asset.id, () => App.mockGenerator.generateDaily(asset, HISTORY_DAYS));
    if (period === 'day') {
      const prevClose = daily[daily.length - 2].price;
      const lastPrice = daily[daily.length - 1].price;
      return cached(asset.id + ':day', () => App.mockGenerator.generateIntraday(asset, prevClose, lastPrice, 24));
    }
    return daily.slice(-(PERIODS[period].days + 1));
  }

  function withDelay(value) {
    return new Promise(resolve => setTimeout(() => resolve(value), MOCK_DELAY_MS));
  }

  function mockOverview(type, period) {
    return withDelay(App.ASSETS[type].map(asset => toOverviewItem(asset, getMockSeries(asset, period))));
  }

  // ---------- спільне ----------

  function percentChange(series) {
    return (series[series.length - 1].price / series[0].price - 1) * 100;
  }

  function toOverviewItem(asset, series) {
    const price = series[series.length - 1].price;
    return {
      ...asset,
      price,
      change: percentChange(series),
      marketCap: price * asset.supply,
      sparkline: series.map(point => point.price)
    };
  }

  // ---------- криптовалюта (Binance) ----------

  async function cryptoOverview(period) {
    const assets = App.ASSETS.crypto;
    const series = await Promise.all(assets.map(a => App.binance.getHistory(a.pair, period)));
    return assets.map((asset, i) => toOverviewItem(asset, series[i]));
  }

  // ---------- акції (Finnhub + Twelve Data) ----------

  const historyInterval = period => (period === 'day' ? '1h' : '1day');

  // Ряд цін акції за період з історії Twelve Data (якщо вона вже в кеші)
  // і поточної ціни Finnhub. Повертає null, якщо історії ще немає.
  function stockSeries(asset, period, quote) {
    const history = App.twelveData.peek(asset.symbol, historyInterval(period));

    if (period === 'day') {
      // Остання торгова сесія: від ціни закриття попереднього дня до поточної
      const sessionBars = history
        ? history.filter(p => new Date(p.time).toDateString() === new Date(history[history.length - 1].time).toDateString())
        : [];
      const start = sessionBars.length ? sessionBars[0].time - HOUR_MS : quote.time - 6.5 * HOUR_MS;
      const series = [{ time: start, price: quote.prevClose }];
      if (sessionBars.length) series.push(...sessionBars.map(p => ({ ...p })));
      else series.push({ time: start + 60 * 1000, price: quote.open });
      return withLivePrice(series, quote);
    }

    if (!history) return null;
    // Беремо останню ціну на початок періоду і всі наступні
    const from = Date.now() - PERIODS[period].days * DAY_MS;
    let startIndex = 0;
    history.forEach((point, i) => { if (point.time <= from) startIndex = i; });
    return withLivePrice(history.slice(startIndex).map(p => ({ ...p })), quote);
  }

  // Остання точка ряду — поточна ціна: або оновлюємо сьогоднішню свічку, або додаємо нову точку
  function withLivePrice(series, quote) {
    const last = series[series.length - 1];
    if (quote.time > last.time + HOUR_MS) series.push({ time: quote.time, price: quote.price });
    else last.price = quote.price;
    return series;
  }

  // Ставимо в чергу завантаження історії для всіх акцій, яких ще немає в кеші.
  // Коли частина історії приходить, повідомляємо інтерфейс подією "stockhistory".
  let historyEventTimer = null;
  function requestStockHistory(period) {
    if (!App.twelveData.isConfigured()) return;
    const interval = historyInterval(period);
    App.ASSETS.stocks.forEach(asset => {
      if (App.twelveData.peek(asset.symbol, interval)) return;
      App.twelveData.getHistory(asset.symbol, interval).then(() => {
        clearTimeout(historyEventTimer);
        historyEventTimer = setTimeout(() => document.dispatchEvent(new Event('stockhistory')), 300);
      }, error => console.warn('Twelve Data:', asset.symbol, error.message));
    });
  }

  async function stocksOverview(period) {
    const assets = App.ASSETS.stocks;
    const quotes = await App.finnhub.getQuotes(assets.map(a => a.symbol));
    requestStockHistory(period);
    return assets.map(asset => {
      const quote = quotes[asset.symbol];
      const series = stockSeries(asset, period, quote);
      return {
        ...asset,
        price: quote.price,
        // Зміна за день — від ціни закриття попереднього дня, як на біржі
        change: period === 'day'
          ? (quote.price / quote.prevClose - 1) * 100
          : (series ? percentChange(series) : null), // null — історія ще завантажується
        marketCap: quote.price * asset.supply,
        sparkline: series ? series.map(point => point.price) : null
      };
    });
  }

  async function stockHistory(asset, period) {
    if (!App.twelveData.isConfigured()) return getMockSeries(asset, period);
    await App.twelveData.getHistory(asset.symbol, historyInterval(period), { priority: true });
    const quote = (await App.finnhub.getQuotes([asset.symbol]))[asset.symbol];
    return stockSeries(asset, period, quote);
  }

  // ---------- публічний інтерфейс ----------

  const LIVE_LOADERS = {
    crypto: { canUse: () => true, overview: cryptoOverview },
    stocks: { canUse: () => App.finnhub.isConfigured(), overview: stocksOverview }
  };

  App.dataService = {
    PERIODS,

    getAssetMeta(id) {
      return assetsById.get(id) || null;
    },

    // Звідки дані розділу: { live, provider, hint, history: { ready, total } }
    getSourceInfo(type, period) {
      if (status[type] !== 'live') return { live: false, hint: `source.demoHint.${type}` };
      if (type === 'crypto') return { live: true, provider: 'Binance', hint: 'source.liveHint' };

      if (!App.twelveData.isConfigured()) {
        return { live: true, provider: 'Finnhub', hint: 'source.liveHint.stocksNoHistory' };
      }
      const interval = historyInterval(period);
      const ready = App.ASSETS.stocks.filter(a => App.twelveData.peek(a.symbol, interval)).length;
      return {
        live: true,
        provider: 'Finnhub · Twelve Data',
        hint: 'source.liveHint.stocks',
        history: { ready, total: App.ASSETS.stocks.length }
      };
    },

    // Список активів розділу з ціною, зміною за період і даними для міні-графіка.
    // Для акцій change і sparkline можуть бути null, поки вантажиться історія.
    async getMarketOverview(type, period) {
      const loader = LIVE_LOADERS[type];
      if (loader.canUse()) {
        try {
          const items = await loader.overview(period);
          status[type] = 'live';
          return items;
        } catch (error) {
          // Немає інтернету, неправильний ключ або вичерпано ліміт — сайт не ламається
          console.warn('Живі дані недоступні, показуємо тестові:', error);
        }
      }
      status[type] = 'demo';
      return mockOverview(type, period);
    },

    // Історія цін одного активу: [{ time, price }]
    async getHistory(id, period) {
      const asset = assetsById.get(id);
      if (!asset) return [];
      if (status[asset.type] === 'live') {
        try {
          if (asset.type === 'crypto') return await App.binance.getHistory(asset.pair, period);
          return await stockHistory(asset, period);
        } catch (error) {
          console.warn('Живі дані недоступні, показуємо тестові:', error);
        }
      }
      return withDelay(getMockSeries(asset, period));
    },

    // Підписка на живі ціни розділу. onUpdate([{ id, price }]) викликається
    // не частіше ніж раз на секунду. Повертає функцію відписки.
    subscribeLive(type, onUpdate) {
      if (status[type] !== 'live') return () => {};

      const stream = STREAMS[type];
      const assetsByKey = new Map(App.ASSETS[type].map(asset => [stream.keyOf(asset), asset]));
      const pending = new Map();
      let flushTimer = null;

      const stopStream = stream.start([...assetsByKey.keys()], (key, price) => {
        const asset = assetsByKey.get(key);
        if (!asset) return;
        stream.apply(key, price);
        pending.set(asset.id, price);
        // Ціни приходять поодинці; збираємо їх і передаємо пачкою, щоб не перемальовувати сторінку щоразу
        if (!flushTimer) {
          flushTimer = setTimeout(() => {
            flushTimer = null;
            const updates = [...pending].map(([id, value]) => ({ id, price: value }));
            pending.clear();
            onUpdate(updates);
          }, LIVE_FLUSH_MS);
        }
      });

      return () => {
        stopStream();
        clearTimeout(flushTimer);
      };
    },

    // Пошук за тікером або назвою одразу серед акцій і криптовалют
    search(query, limit = 8) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const scored = [];
      assetsById.forEach(asset => {
        const symbol = asset.symbol.toLowerCase();
        const name = asset.name.toLowerCase();
        let score = -1;
        if (symbol === q) score = 0;
        else if (symbol.startsWith(q)) score = 1;
        else if (name.startsWith(q)) score = 2;
        else if (name.includes(q) || symbol.includes(q)) score = 3;
        if (score >= 0) scored.push({ asset, score });
      });
      return scored
        .sort((a, b) => a.score - b.score || a.asset.symbol.localeCompare(b.asset.symbol))
        .slice(0, limit)
        .map(item => item.asset);
    }
  };
})(window.App);

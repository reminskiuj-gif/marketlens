// Сервіс даних — єдина точка, через яку інтерфейс отримує дані.
// Зараз він повертає тестові дані, але методи вже асинхронні (Promise),
// як у реального API. Щоб підключити CoinGecko / Finnhub, достатньо
// змінити лише цей файл — решта коду не зміниться.
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

  const HISTORY_DAYS = 365;
  const NETWORK_DELAY_MS = 120; // імітація затримки мережі

  const assetsById = new Map();
  Object.values(App.ASSETS).forEach(list => list.forEach(asset => assetsById.set(asset.id, asset)));

  const historyCache = new Map();

  function cached(key, create) {
    if (!historyCache.has(key)) historyCache.set(key, create());
    return historyCache.get(key);
  }

  function getSeries(asset, period) {
    const daily = cached(asset.id, () => App.mockGenerator.generateDaily(asset, HISTORY_DAYS));
    if (period === 'day') {
      const prevClose = daily[daily.length - 2].price;
      const lastPrice = daily[daily.length - 1].price;
      return cached(asset.id + ':day', () => App.mockGenerator.generateIntraday(asset, prevClose, lastPrice, 24));
    }
    return daily.slice(-(PERIODS[period].days + 1));
  }

  function percentChange(series) {
    return (series[series.length - 1].price / series[0].price - 1) * 100;
  }

  function withDelay(value) {
    return new Promise(resolve => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
  }

  App.dataService = {
    PERIODS,

    getAssetMeta(id) {
      return assetsById.get(id) || null;
    },

    // Список активів розділу з ціною, зміною за період і даними для міні-графіка
    getMarketOverview(type, period) {
      const items = App.ASSETS[type].map(asset => {
        const series = getSeries(asset, period);
        const price = series[series.length - 1].price;
        return {
          ...asset,
          price,
          change: percentChange(series),
          marketCap: price * asset.supply,
          sparkline: series.map(point => point.price)
        };
      });
      return withDelay(items);
    },

    // Історія цін одного активу: [{ time, price }]
    getHistory(id, period) {
      const asset = assetsById.get(id);
      return withDelay(asset ? getSeries(asset, period) : []);
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

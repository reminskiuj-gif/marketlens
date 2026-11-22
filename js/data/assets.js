// Довідник активів.
// price — орієнтовна ціна ($) для тестових даних, supply — кількість акцій/монет (млрд),
// за нею рахується капіталізація. vol — річна волатильність, drift — річний тренд:
// потрібні лише для генерації тестових графіків (акції; крипта — якщо Binance недоступний).
window.App = window.App || {};

(function (App) {
  'use strict';

  const STOCKS = [
    // тікер, назва, ключ сектору (див. i18n.js), ціна, акцій (млрд), волатильність, тренд
    ['AAPL', 'Apple', 'tech', 342.56, 14.594, 0.25, 0.15],
    ['MSFT', 'Microsoft', 'tech', 484.52, 7.426, 0.22, 0.12],
    ['NVDA', 'NVIDIA', 'semis', 125.53, 24.1, 0.5, 0.4],
    ['GOOGL', 'Alphabet (Google)', 'comms', 265.29, 12.294, 0.28, 0.1],
    ['AMZN', 'Amazon', 'consumer', 246.82, 10.813, 0.3, 0.12],
    ['META', 'Meta Platforms', 'comms', 560.84, 2.596, 0.35, 0.2],
    ['TSLA', 'Tesla', 'auto', 345.82, 3.953, 0.6, 0.05],
    ['BRK.B', 'Berkshire Hathaway', 'finance', 570, 2.123, 0.15, 0.08],
    ['JPM', 'JPMorgan Chase', 'finance', 310.53, 2.658, 0.2, 0.1],
    ['V', 'Visa', 'finance', 401.87, 1.859, 0.18, 0.08],
    ['JNJ', 'Johnson & Johnson', 'health', 270.47, 2.407, 0.15, 0.0],
    ['WMT', 'Walmart', 'retail', 127.95, 7.934, 0.16, 0.15],
    ['PG', 'Procter & Gamble', 'staples', 169.37, 2.318, 0.14, 0.03],
    ['XOM', 'ExxonMobil', 'energy', 159.99, 4.079, 0.22, -0.05],
    ['MA', 'Mastercard', 'finance', 625.59, 0.871, 0.18, 0.1],
    ['UNH', 'UnitedHealth', 'health', 339.85, 0.898, 0.25, -0.1],
    ['HD', 'Home Depot', 'retail', 339.04, 0.998, 0.2, 0.05],
    ['KO', 'Coca-Cola', 'staples', 96.99, 4.302, 0.13, 0.02],
    ['PEP', 'PepsiCo', 'staples', 140.54, 1.363, 0.15, -0.05],
    ['DIS', 'Walt Disney', 'comms', 117.98, 1.727, 0.28, -0.02],
    ['NFLX', 'Netflix', 'comms', 56.73, 4.106, 0.35, 0.3],
    ['INTC', 'Intel', 'semis', 51.28, 5.315, 0.45, -0.3],
    ['AMD', 'AMD', 'semis', 424.39, 1.632, 0.5, 0.1],
    ['ORCL', 'Oracle', 'tech', 101.19, 3.031, 0.3, 0.25],
    ['CRM', 'Salesforce', 'tech', 180.62, 0.823, 0.3, 0.06],
    ['NKE', 'Nike', 'consumer', 32.92, 1.485, 0.3, -0.15],
    ['MCD', "McDonald's", 'consumer', 273.24, 0.708, 0.16, 0.04],
    ['BA', 'Boeing', 'industrials', 155.89, 0.792, 0.35, -0.15],
    ['PFE', 'Pfizer', 'health', 27.4, 5.7, 0.22, -0.08],
    ['CSCO', 'Cisco', 'tech', 90.64, 3.937, 0.2, 0.08]
  ];

  const CRYPTO = [
    // символ, назва, ключ категорії, ціна, монет в обігу (млрд), волатильність, тренд
    ['BTC', 'Bitcoin', 'l1', 68000, 0.0197, 0.55, 0.4],
    ['ETH', 'Ethereum', 'smart', 2600, 0.1203, 0.7, 0.1],
    ['USDT', 'Tether', 'stable', 1, 120, 0.003, 0],
    ['BNB', 'BNB', 'exchange', 590, 0.1459, 0.6, 0.15],
    ['SOL', 'Solana', 'smart', 165, 0.469, 0.9, 0.5],
    ['XRP', 'XRP', 'payments', 0.53, 56.7, 0.8, 0.0],
    ['USDC', 'USD Coin', 'stable', 1, 35, 0.003, 0],
    ['ADA', 'Cardano', 'smart', 0.35, 35.0, 0.85, -0.1],
    ['DOGE', 'Dogecoin', 'meme', 0.14, 146, 1.1, 0.2],
    ['TRX', 'TRON', 'smart', 0.16, 86.5, 0.5, 0.3],
    ['TON', 'Toncoin', 'smart', 5.2, 2.54, 0.8, -0.2],
    ['AVAX', 'Avalanche', 'smart', 27, 0.406, 0.95, -0.15],
    ['DOT', 'Polkadot', 'infra', 4.3, 1.5, 0.85, -0.25],
    ['LINK', 'Chainlink', 'oracle', 11.5, 0.626, 0.85, 0.05],
    ['POL', 'Polygon', 'scaling', 0.38, 8.0, 0.95, -0.4],
    ['LTC', 'Litecoin', 'payments', 68, 0.075, 0.7, -0.05],
    ['SHIB', 'Shiba Inu', 'meme', 0.000018, 589000, 1.1, 0.1],
    ['XLM', 'Stellar', 'payments', 0.095, 30, 0.75, 0.0],
    ['UNI', 'Uniswap', 'defi', 7.5, 0.6, 0.95, 0.1],
    ['ATOM', 'Cosmos', 'infra', 4.5, 0.39, 0.85, -0.3]
  ];

  function build(type, rows) {
    return rows.map(([symbol, name, category, price, supplyBillions, vol, drift]) => ({
      id: `${type}:${symbol}`,
      type,
      symbol,
      name,
      category,
      price,
      // Торгова пара на Binance для живих цін. Ціну самого USDT беремо з пари до DAI.
      pair: type === 'crypto' ? (symbol === 'USDT' ? 'USDTDAI' : symbol + 'USDT') : null,
      supply: supplyBillions * 1e9,
      vol,
      drift
    }));
  }

  App.ASSETS = {
    stocks: build('stocks', STOCKS),
    crypto: build('crypto', CRYPTO)
  };
})(window.App);

// Довідник активів для тестових даних.
// price — орієнтовна поточна ціна ($), supply — кількість акцій/монет (млрд),
// vol — річна волатильність, drift — річний тренд. Значення приблизні й
// потрібні лише для генерації правдоподібних графіків.
window.App = window.App || {};

(function (App) {
  'use strict';

  const STOCKS = [
    // тікер, назва, ключ сектору (див. i18n.js), ціна, акцій (млрд), волатильність, тренд
    ['AAPL', 'Apple', 'tech', 230, 15.2, 0.25, 0.15],
    ['MSFT', 'Microsoft', 'tech', 430, 7.43, 0.22, 0.12],
    ['NVDA', 'NVIDIA', 'semis', 135, 24.5, 0.5, 0.4],
    ['GOOGL', 'Alphabet (Google)', 'comms', 175, 12.3, 0.28, 0.1],
    ['AMZN', 'Amazon', 'consumer', 195, 10.5, 0.3, 0.12],
    ['META', 'Meta Platforms', 'comms', 580, 2.53, 0.35, 0.2],
    ['TSLA', 'Tesla', 'auto', 250, 3.2, 0.6, 0.05],
    ['BRK.B', 'Berkshire Hathaway', 'finance', 460, 2.16, 0.15, 0.08],
    ['JPM', 'JPMorgan Chase', 'finance', 220, 2.85, 0.2, 0.1],
    ['V', 'Visa', 'finance', 290, 2.0, 0.18, 0.08],
    ['JNJ', 'Johnson & Johnson', 'health', 160, 2.4, 0.15, 0.0],
    ['WMT', 'Walmart', 'retail', 82, 8.0, 0.16, 0.15],
    ['PG', 'Procter & Gamble', 'staples', 170, 2.36, 0.14, 0.03],
    ['XOM', 'ExxonMobil', 'energy', 118, 4.4, 0.22, -0.05],
    ['MA', 'Mastercard', 'finance', 510, 0.92, 0.18, 0.1],
    ['UNH', 'UnitedHealth', 'health', 560, 0.92, 0.25, -0.1],
    ['HD', 'Home Depot', 'retail', 400, 0.99, 0.2, 0.05],
    ['KO', 'Coca-Cola', 'staples', 70, 4.31, 0.13, 0.02],
    ['PEP', 'PepsiCo', 'staples', 165, 1.37, 0.15, -0.05],
    ['DIS', 'Walt Disney', 'comms', 95, 1.81, 0.28, -0.02],
    ['NFLX', 'Netflix', 'comms', 750, 0.43, 0.35, 0.3],
    ['INTC', 'Intel', 'semis', 23, 4.3, 0.45, -0.3],
    ['AMD', 'AMD', 'semis', 155, 1.62, 0.5, 0.1],
    ['ORCL', 'Oracle', 'tech', 170, 2.77, 0.3, 0.25],
    ['CRM', 'Salesforce', 'tech', 290, 0.96, 0.3, 0.06],
    ['NKE', 'Nike', 'consumer', 80, 1.5, 0.3, -0.15],
    ['MCD', "McDonald's", 'consumer', 295, 0.72, 0.16, 0.04],
    ['BA', 'Boeing', 'industrials', 155, 0.62, 0.35, -0.15],
    ['PFE', 'Pfizer', 'health', 29, 5.67, 0.22, -0.08],
    ['CSCO', 'Cisco', 'tech', 55, 4.0, 0.2, 0.08]
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

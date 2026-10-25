// Генератор тестової історії цін.
// Використовує модель геометричного броунівського руху — стандартну
// спрощену модель руху ціни. Пізніше цей файл замінить реальне API.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { createRandom, hashString, gaussian } = App.utils;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // Денні ціни закриття за останні `days` днів, остання = asset.price
  function generateDaily(asset, days) {
    const rand = createRandom(hashString(asset.id));
    const isStablecoin = asset.vol < 0.01;
    const dt = 1 / 365;
    const sigma = asset.vol * Math.sqrt(dt);
    const mu = (asset.drift - asset.vol * asset.vol / 2) * dt;

    const logs = [0];
    for (let i = 1; i <= days; i++) {
      let next = logs[i - 1] + mu + sigma * gaussian(rand);
      // Стейблкоїни тримаються біля $1
      if (isStablecoin) next *= 0.6;
      logs.push(next);
    }

    // Зсуваємо ряд так, щоб остання точка дорівнювала поточній ціні
    const shift = Math.log(asset.price) - logs[days];
    const end = startOfToday();
    return logs.map((value, i) => ({
      time: end - (days - i) * DAY_MS,
      price: Math.exp(value + shift)
    }));
  }

  // Погодинні ціни за останню добу: починаються з учорашньої ціни закриття
  // і закінчуються сьогоднішньою ("броунівський міст")
  function generateIntraday(asset, fromPrice, toPrice, hours) {
    const rand = createRandom(hashString(asset.id + ':intraday'));
    const sigma = asset.vol * Math.sqrt(1 / 365 / hours);

    const walk = [0];
    for (let i = 1; i <= hours; i++) walk.push(walk[i - 1] + sigma * gaussian(rand));

    const target = Math.log(toPrice / fromPrice);
    const now = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    return walk.map((value, i) => ({
      time: now - (hours - i) * HOUR_MS,
      price: fromPrice * Math.exp(value - (i / hours) * (walk[hours] - target))
    }));
  }

  App.mockGenerator = { generateDaily, generateIntraday };
})(window.App);

// Профіль користувача і його портфель. Поки все зберігається лише в цьому
// браузері (localStorage), без реєстрації й сервера.
// Портфель — це список покупок; позиції рахуються з покупок кожного активу.
window.App = window.App || {};

(function (App) {
  'use strict';

  const STORAGE_KEY = 'marketlens.portfolio';
  const { storage } = App.utils;

  // { profile: { name, createdAt }, purchases: [{ id, assetId, quantity, price, date }] } або null
  let data = storage.get(STORAGE_KEY, null);
  if (data) {
    // Покупки активів, яких уже немає в довіднику, пропускаємо
    data.purchases = (data.purchases || []).filter(p => App.dataService.getAssetMeta(p.assetId));
  }

  const listeners = [];

  function save() {
    storage.set(STORAGE_KEY, data);
    listeners.forEach(fn => fn());
  }

  App.portfolio = {
    getProfile() {
      return data ? data.profile : null;
    },

    createProfile(name) {
      data = { profile: { name, createdAt: Date.now() }, purchases: [] };
      save();
    },

    rename(name) {
      data.profile.name = name;
      save();
    },

    deleteProfile() {
      data = null;
      save();
    },

    addPurchase({ assetId, quantity, price, date }) {
      const id = Date.now().toString(36) + '-' + data.purchases.length;
      data.purchases.push({ id, assetId, quantity, price, date });
      save();
    },

    removeAsset(assetId) {
      data.purchases = data.purchases.filter(p => p.assetId !== assetId);
      save();
    },

    // Позиції: усі покупки одного активу зведені разом.
    // [{ asset, quantity, cost, avgPrice }], cost — скільки всього заплачено
    getHoldings() {
      if (!data) return [];
      const byAsset = new Map();
      data.purchases.forEach(p => {
        const holding = byAsset.get(p.assetId) || {
          asset: App.dataService.getAssetMeta(p.assetId), quantity: 0, cost: 0
        };
        holding.quantity += p.quantity;
        holding.cost += p.quantity * p.price;
        byAsset.set(p.assetId, holding);
      });
      return [...byAsset.values()].map(h => ({ ...h, avgPrice: h.cost / h.quantity }));
    },

    subscribe(fn) {
      listeners.push(fn);
    }
  };
})(window.App);

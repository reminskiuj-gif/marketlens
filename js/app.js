// Точка входу: ініціалізує модулі і зв'язує стан із відображенням.
window.App = window.App || {};

(function (App) {
  'use strict';

  const { store, dataService, ui } = App;
  const MAX_COMPARE = 5;

  let overview = [];
  let requestId = 0;
  let pendingHighlight = null;
  let stopLive = () => {};

  // Дії, які викликають різні частини інтерфейсу
  App.actions = {
    MAX_COMPARE,

    toggleCompare(id) {
      const list = store.get().compare;
      if (list.includes(id)) {
        store.set({ compare: list.filter(item => item !== id) });
        return;
      }
      if (list.length >= MAX_COMPARE) {
        ui.toast(App.i18n.t('toast.maxCompare', { max: MAX_COMPARE }));
        return;
      }
      store.set({ compare: [...list, id] });
    },

    // Перехід до активу в таблиці (з пошуку чи списку лідерів)
    goToAsset(id) {
      const asset = dataService.getAssetMeta(id);
      if (!asset) return;
      if (store.get().tab === asset.type) {
        App.marketView.highlight(id);
      } else {
        pendingHighlight = id;
        store.set({ tab: asset.type });
      }
    },

    openDetails() {
      ui.toast(App.i18n.t('toast.detailsSoon'));
    },

    // Спочатку перемикаємо словник, потім оновлюємо стан,
    // щоб модулі перемальовувались уже з новими перекладами
    setLanguage(lang) {
      App.i18n.setLanguage(lang);
      store.set({ lang });
    }
  };

  async function loadMarket() {
    const { tab, period } = store.get();
    const currentRequest = ++requestId;
    stopLive(); // живі ціни старого розділу/періоду більше не потрібні
    App.marketView.setLoading(true);
    const data = await dataService.getMarketOverview(tab, period);
    if (currentRequest !== requestId) return; // відповідь застаріла
    overview = data;
    renderMarket();

    const source = dataService.getSourceInfo(tab, period);
    const expectedLive = tab === 'crypto' || (App.CONFIG && App.CONFIG.finnhubKey);
    if (expectedLive && !source.live) ui.toast(App.i18n.t('toast.liveFailed'));
    stopLive = dataService.subscribeLive(tab, applyLiveUpdates);
  }

  // Догрузилась частина історії цін акцій — перебудовуємо список без перепідключення живих цін
  async function refreshMarket() {
    const { tab, period } = store.get();
    if (tab !== 'stocks') return;
    const currentRequest = requestId;
    const data = await dataService.getMarketOverview(tab, period);
    if (currentRequest !== requestId) return; // за цей час користувач щось перемкнув
    overview = data;
    renderMarket();
  }

  // Нові ціни з біржі: перераховуємо зміну за період і капіталізацію
  // та оновлюємо лише змінені клітинки, без повного перемальовування
  function applyLiveUpdates(updates) {
    const changed = [];
    updates.forEach(({ id, price }) => {
      const item = overview.find(entry => entry.id === id);
      if (!item || item.price === price) return;
      const direction = price > item.price ? 'up' : 'down';
      item.price = price;
      item.marketCap = price * item.supply;
      // Якщо історія ще вантажиться, графіка немає і зміну поки не рахуємо
      if (item.sparkline) {
        item.sparkline[item.sparkline.length - 1] = price;
        item.change = (price / item.sparkline[0] - 1) * 100;
      }
      changed.push({ item, direction });
    });
    if (changed.length) App.marketView.updateLive(overview, changed, store.get());
  }

  function renderMarket() {
    App.marketView.render(overview, store.get());
    if (pendingHighlight) {
      App.marketView.highlight(pendingHighlight);
      pendingHighlight = null;
    }
  }

  function init() {
    App.i18n.setLanguage(store.get().lang);
    App.settings.init();
    App.header.init();
    App.marketView.init();
    App.search.init();
    App.compareTray.init();
    App.compareView.init();

    store.subscribe((state, changed) => {
      if (changed.includes('tab') || changed.includes('period')) loadMarket();
      else if (['sort', 'compare', 'lang'].some(key => changed.includes(key))) renderMarket();
    });
    document.addEventListener('stockhistory', refreshMarket);

    loadMarket();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.App);

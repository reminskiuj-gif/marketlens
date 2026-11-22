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
  let marketLoaded = Promise.resolve(); // завершується, коли дані розділу завантажені

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

    // Сторінка активу має власну адресу (#/asset/stocks:AAPL), тому працюють
    // кнопка "Назад" у браузері й посилання, яким можна поділитися
    openDetails(id) {
      location.hash = '#/asset/' + encodeURIComponent(id);
    },

    // Повернення до головного екрана без перезавантаження сторінки
    showMarket() {
      if (!location.hash) return;
      history.pushState(null, '', location.pathname + location.search);
      route();
    },

    retry() {
      loadMarket();
    },

    // Сервіс даних дізнається, чи доступне живе джерело, лише під час завантаження
    // розділу. Сторінка активу чекає на це, щоб не показати тестові дані замість живих
    whenMarketLoaded() {
      return marketLoaded;
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
    const request = dataService.getMarketOverview(tab, period);
    marketLoaded = request.then(() => {});
    const data = await request;
    if (currentRequest !== requestId) return; // відповідь застаріла
    overview = data;
    renderMarket();
    updateAlert();
    stopLive = dataService.subscribeLive(tab, applyLiveUpdates);
  }

  // Якщо живі дані очікувались, але не прийшли, показуємо повідомлення з кнопкою повтору
  function updateAlert() {
    const { tab, period } = store.get();
    const source = dataService.getSourceInfo(tab, period);
    const expectedLive = tab === 'crypto' || (App.CONFIG && App.CONFIG.finnhubKey);
    let kind = null;
    if (!navigator.onLine) kind = 'offline';
    else if (expectedLive && !source.live) kind = 'liveFailed';
    App.marketView.showAlert(kind);
  }

  // Що показати за поточною адресою: сторінку активу чи головний екран
  function assetFromHash() {
    const match = location.hash.match(/^#\/asset\/(.+)$/);
    return match && dataService.getAssetMeta(decodeURIComponent(match[1]));
  }

  // Що показати за поточною адресою: сторінку активу, портфель чи головний екран
  function route() {
    const asset = assetFromHash();
    const isPortfolio = location.hash === '#/portfolio';
    document.getElementById('market').hidden = Boolean(asset || isPortfolio);

    if (!isPortfolio) App.portfolioView.close();
    if (!asset) App.assetView.close();

    if (isPortfolio) App.portfolioView.open();
    if (asset) {
      // Відкриваємо розділ активу, щоб живі ціни йшли саме для нього
      if (store.get().tab !== asset.type) store.set({ tab: asset.type });
      App.assetView.open(asset.id);
    }
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
    App.assetView.updateLive(updates);
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
    // Сторінку відкрили за посиланням на актив — одразу вантажимо його розділ
    const linkedAsset = assetFromHash();
    if (linkedAsset) store.set({ tab: linkedAsset.type });
    App.settings.init();
    App.header.init();
    App.marketView.init();
    App.search.init();
    App.compareTray.init();
    App.compareView.init();
    App.assetView.init();
    App.portfolioView.init();

    store.subscribe((state, changed) => {
      if (changed.includes('tab') || changed.includes('period')) loadMarket();
      else if (['sort', 'compare', 'lang'].some(key => changed.includes(key))) {
        renderMarket();
        if (changed.includes('lang')) updateAlert();
      }
    });
    document.addEventListener('stockhistory', refreshMarket);

    // Зник інтернет — одразу кажемо про це; з'явився — пробуємо завантажити живі дані знову
    window.addEventListener('offline', updateAlert);
    window.addEventListener('online', loadMarket);
    window.addEventListener('hashchange', route);

    loadMarket();
    route();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.App);

// Переклади інтерфейсу. Щоб додати нову мову, достатньо додати
// ще один словник із тими самими ключами і запис у LANGUAGES.
window.App = window.App || {};

(function (App) {
  'use strict';

  const LANGUAGES = [
    { id: 'uk', short: 'UA', label: 'Українська', locale: 'uk-UA' },
    { id: 'en', short: 'EN', label: 'English', locale: 'en-US' }
  ];

  const DICT = {
    uk: {
      'meta.title': 'MarketLens — акції та криптовалюта',
      'nav.label': 'Розділ ринку',
      'nav.stocks': 'Акції',
      'nav.crypto': 'Криптовалюта',
      'search.placeholder': 'Пошук акцій і криптовалют',
      'search.label': 'Пошук',
      'search.add': '+ Порівняти',
      'search.added': '✓ Додано',
      'search.empty': 'Нічого не знайдено за запитом «{query}»',
      'header.settings': 'Налаштування',
      'header.language': 'Змінити мову',

      'period.label': 'Період:',
      'period.day': 'День',
      'period.week': 'Тиждень',
      'period.month': 'Місяць',
      'period.year': 'Рік',
      'period.day.long': 'за день',
      'period.week.long': 'за тиждень',
      'period.month.long': 'за місяць',
      'period.year.long': 'за рік',

      'market.stocks.title': 'Ринок акцій',
      'market.stocks.subtitle': 'Найбільші компанії США: ціни, динаміка та порівняння',
      'market.stocks.table': 'Усі акції',
      'market.stocks.category': 'Сектор',
      'market.crypto.title': 'Ринок криптовалют',
      'market.crypto.subtitle': 'Топ-20 криптовалют за капіталізацією',
      'market.crypto.table': 'Усі криптовалюти',
      'market.crypto.category': 'Категорія',

      'movers.gainers': 'Найбільше зростання',
      'movers.losers': 'Найбільше падіння',
      'movers.showInTable': 'Показати в таблиці',

      'table.hint': 'Позначте до 5 позицій, щоб порівняти їх, зокрема акції разом із криптовалютою',
      'table.compare': 'Порівняти',
      'table.name': 'Назва',
      'table.price': 'Ціна',
      'table.change': 'Зміна {period}',
      'table.chart': 'Графік',
      'table.marketCap': 'Капіталізація',

      'compare.add': 'Додати до порівняння',
      'compare.remove': 'Прибрати з порівняння',
      'compare.itemLabel': 'Порівняти {name}',
      'compare.title': 'Порівняння',
      'compare.summary': 'Найкращий результат {period}: {name} ({change})',
      'compare.note': 'Графік показує зміну ціни у % від початку періоду, тому активи з різною ціною можна порівнювати напряму.',
      'compare.chartLabel': 'Графік зміни ціни у відсотках',
      'compare.periodLabel': 'Період порівняння',
      'compare.metric': 'Показник',
      'compare.current': 'Поточна ціна',
      'compare.start': 'Ціна на початку періоду',
      'compare.change': 'Зміна',
      'compare.high': 'Максимум за період',
      'compare.low': 'Мінімум за період',
      'compare.drawdown': 'Найбільше просідання',

      'tray.title': 'Порівняння',
      'tray.count': '{count} з {max}',
      'tray.slot': '+ додайте',
      'tray.clear': 'Очистити',
      'tray.needMore': 'Оберіть ще 1',
      'tray.compare': 'Порівняти ({count})',

      'settings.title': 'Налаштування',
      'settings.theme': 'Тема оформлення',
      'settings.theme.light': 'Світла',
      'settings.theme.dark': 'Темна',
      'settings.theme.system': 'Як у системі',
      'settings.language': 'Мова',
      'settings.defaultPeriod': 'Період за замовчуванням',
      'settings.currency': 'Валюта',
      'settings.currencySoon': "EUR і UAH з'являться пізніше",

      'common.close': 'Закрити',
      'common.remove': 'Прибрати',
      'tag.stocks': 'Акція',
      'tag.crypto': 'Крипто',

      'toast.maxCompare': 'Можна порівнювати до {max} позицій одночасно',
      'toast.detailsSoon': 'Детальна сторінка активу в розробці',
      'toast.defaultPeriodSaved': 'Період за замовчуванням збережено',

      'footer.project': 'MarketLens · навчальний проєкт',
      'footer.disclaimer': 'Зараз показуються тестові дані. Сайт не дає інвестиційних порад.',

      'category.tech': 'Технології',
      'category.semis': 'Напівпровідники',
      'category.comms': 'Комунікації',
      'category.consumer': 'Споживчий сектор',
      'category.auto': 'Автомобілі',
      'category.finance': 'Фінанси',
      'category.health': "Охорона здоров'я",
      'category.retail': 'Роздрібна торгівля',
      'category.staples': 'Споживчі товари',
      'category.energy': 'Енергетика',
      'category.industrials': 'Промисловість',
      'category.l1': 'Монета L1',
      'category.smart': 'Смарт-контракти',
      'category.stable': 'Стейблкоїн',
      'category.exchange': 'Біржовий токен',
      'category.payments': 'Платежі',
      'category.meme': 'Мем-коїн',
      'category.infra': 'Інфраструктура',
      'category.oracle': 'Оракули',
      'category.scaling': 'Масштабування',
      'category.defi': 'DeFi'
    },

    en: {
      'meta.title': 'MarketLens — stocks and crypto',
      'nav.label': 'Market section',
      'nav.stocks': 'Stocks',
      'nav.crypto': 'Crypto',
      'search.placeholder': 'Search stocks and crypto',
      'search.label': 'Search',
      'search.add': '+ Compare',
      'search.added': '✓ Added',
      'search.empty': 'No results for “{query}”',
      'header.settings': 'Settings',
      'header.language': 'Change language',

      'period.label': 'Period:',
      'period.day': 'Day',
      'period.week': 'Week',
      'period.month': 'Month',
      'period.year': 'Year',
      'period.day.long': 'past day',
      'period.week.long': 'past week',
      'period.month.long': 'past month',
      'period.year.long': 'past year',

      'market.stocks.title': 'Stock market',
      'market.stocks.subtitle': 'Largest US companies: prices, trends and comparison',
      'market.stocks.table': 'All stocks',
      'market.stocks.category': 'Sector',
      'market.crypto.title': 'Crypto market',
      'market.crypto.subtitle': 'Top 20 cryptocurrencies by market cap',
      'market.crypto.table': 'All cryptocurrencies',
      'market.crypto.category': 'Category',

      'movers.gainers': 'Top gainers',
      'movers.losers': 'Top losers',
      'movers.showInTable': 'Show in table',

      'table.hint': 'Select up to 5 items to compare them, including stocks together with crypto',
      'table.compare': 'Compare',
      'table.name': 'Name',
      'table.price': 'Price',
      'table.change': 'Change, {period}',
      'table.chart': 'Chart',
      'table.marketCap': 'Market cap',

      'compare.add': 'Add to comparison',
      'compare.remove': 'Remove from comparison',
      'compare.itemLabel': 'Compare {name}',
      'compare.title': 'Comparison',
      'compare.summary': 'Best performer over the {period}: {name} ({change})',
      'compare.note': 'The chart shows the price change in % from the start of the period, so assets with different prices can be compared directly.',
      'compare.chartLabel': 'Price change chart in percent',
      'compare.periodLabel': 'Comparison period',
      'compare.metric': 'Metric',
      'compare.current': 'Current price',
      'compare.start': 'Price at period start',
      'compare.change': 'Change',
      'compare.high': 'Period high',
      'compare.low': 'Period low',
      'compare.drawdown': 'Max drawdown',

      'tray.title': 'Comparison',
      'tray.count': '{count} of {max}',
      'tray.slot': '+ add',
      'tray.clear': 'Clear',
      'tray.needMore': 'Pick 1 more',
      'tray.compare': 'Compare ({count})',

      'settings.title': 'Settings',
      'settings.theme': 'Theme',
      'settings.theme.light': 'Light',
      'settings.theme.dark': 'Dark',
      'settings.theme.system': 'System',
      'settings.language': 'Language',
      'settings.defaultPeriod': 'Default period',
      'settings.currency': 'Currency',
      'settings.currencySoon': 'EUR and UAH are coming later',

      'common.close': 'Close',
      'common.remove': 'Remove',
      'tag.stocks': 'Stock',
      'tag.crypto': 'Crypto',

      'toast.maxCompare': 'You can compare up to {max} items at once',
      'toast.detailsSoon': 'The asset details page is in development',
      'toast.defaultPeriodSaved': 'Default period saved',

      'footer.project': 'MarketLens · student project',
      'footer.disclaimer': 'Demo data is shown. This site is not investment advice.',

      'category.tech': 'Technology',
      'category.semis': 'Semiconductors',
      'category.comms': 'Communication',
      'category.consumer': 'Consumer discretionary',
      'category.auto': 'Automotive',
      'category.finance': 'Financials',
      'category.health': 'Healthcare',
      'category.retail': 'Retail',
      'category.staples': 'Consumer staples',
      'category.energy': 'Energy',
      'category.industrials': 'Industrials',
      'category.l1': 'Layer 1',
      'category.smart': 'Smart contracts',
      'category.stable': 'Stablecoin',
      'category.exchange': 'Exchange token',
      'category.payments': 'Payments',
      'category.meme': 'Meme coin',
      'category.infra': 'Infrastructure',
      'category.oracle': 'Oracles',
      'category.scaling': 'Scaling',
      'category.defi': 'DeFi'
    }
  };

  let current = 'uk';

  // t('tray.count', { count: 2, max: 5 }) -> "2 з 5"
  function t(key, params) {
    let text = DICT[current][key] ?? DICT.uk[key] ?? key;
    if (params) {
      Object.keys(params).forEach(name => {
        text = text.split(`{${name}}`).join(params[name]);
      });
    }
    return text;
  }

  // Перекладає статичну розмітку за атрибутами data-i18n*
  function applyStatic() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    document.title = t('meta.title');
  }

  function setLanguage(lang) {
    current = DICT[lang] ? lang : 'uk';
    document.documentElement.lang = current;
    applyStatic();
  }

  App.i18n = {
    LANGUAGES,
    t,
    setLanguage,
    getLanguage: () => current,
    getLocale: () => LANGUAGES.find(l => l.id === current).locale
  };
})(window.App);

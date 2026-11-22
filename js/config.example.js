// Приклад налаштувань із ключами API.
// Скопіюйте цей файл як js/config.local.js і вставте туди свої ключі.
// config.local.js вказаний у .gitignore, тому ключі не потраплять на GitHub.
window.App = window.App || {};

window.App.CONFIG = {
  // https://finnhub.io/dashboard — живі ціни акцій (безкоштовно, 60 запитів/хв)
  finnhubKey: '',
  // https://twelvedata.com/account/api-keys — історія цін акцій для графіків
  // і зміни за тиждень/місяць/рік (безкоштовно, 8 запитів/хв, 800 на день)
  twelveDataKey: ''
  // Без ключів акції показуються на тестових даних.
};

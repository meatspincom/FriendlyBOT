module.exports = {
  // Тут пишешь сколько давать монет в минуту
  moneyPerMinute: 50,
  // Тут сколько за одно сообщение (Даётся только один раз в минуту)
  moneyPerMessage: 20,
  // Цена за секунду песни
  pricePerSecond: 20,
  // Максимальная длина трека (в минутах)
  maxTrackLength: 15,
  // Минимальная сумма ставки
  minBet: 1000,
  // Максимальная сумма ставки
  maxBet: 100000,
  // Канал, на который писать сообщения
  channel: 'friendlyfang',
  // Пользователи, которые будут управлять ставками (обязательно писать весь ник низкими символами, через запятую в квадратных скобках)
  moders: ['cardinalasassin', 'friendlyfang'],
};

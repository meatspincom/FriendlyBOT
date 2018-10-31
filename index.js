const mongoose = require('mongoose');
const db = require('./config/dbcfg');
const Rank = require('./dist/rankSystem');
const botConfig = require('./config/botcfg');
const CONFIG = require('./CONFIG');
const axios = require('axios');
const client = require('tmi.js').client(botConfig.settings);
const iso = require('iso8601-duration');
const socket = require('socket.io-client')('http://localhost:3001');

const User = require('./config/userSchema');
const Music = require('./config/musicSchema');
const Bet = require('./config/betSchema');

let betAllow = false;
let parseActive = true;
let parse;
let betStage = 'preparing';

socket.on('betInfo', betInfo => {
  betStage = betInfo.stage;
  switch (betInfo.stage) {
    case 'start':
      client.say(CONFIG.channel, 'Ставки открыты');
      betAllow = true;
      break;
    case 'process':
      client.say(CONFIG.channel, 'Ставки закрыты, игра началась');
      betAllow = false;
      break;
    case 'preparing':
      let winners = { list: [] };
      Bet.findBets((err, data) => {
        data.filter(bet => bet.side === betInfo.side).map(winner => {
          if (winners[winner.username] !== undefined) {
            winners[winner.username].sum =
              winners[winner.username].sum + winner.sum;
            if (!winners.list.includes(winner.username)) {
              winners.list.push(winner.username);
            }
          } else {
            winners[winner.username] = { sum: winner.sum };
            winners.list.push(winner.username);
          }
        });
        User.getUser({ username: { $in: winners.list } }, (err, res) => {
          res.map(user => {
            if (betInfo.side === 'win') {
              User.updateUser(
                { username: user.username },
                {
                  coins:
                    user.coins + parseFloat(winners[user.username].sum) * 1.1,
                },
                (err, res) => {},
              );
            } else if (betInfo.side === 'lose') {
              User.updateUser(
                { username: user.username },
                {
                  coins:
                    user.coins + parseFloat(winners[user.username].sum) * 10,
                },
                (err, res) => {},
              );
            }
          });
        });
        setTimeout(() => {
          mongoose.connection.collections['bets'].drop();
        }, 2500);
        client.say(
          CONFIG.channel,
          'Игра окончена, победителям были начислены призы',
        );
      });

      break;
    default:
      break;
  }
});

const getWallet = senderData => {
  User.getUser({ username: senderData.username }, (err, data) => {
    if (data.length === 0) {
      return;
    }
    client.say(
      CONFIG.channel,
      `В кошельке ${senderData.username} ${(data[0].coins / 100).toFixed(
        2,
      )} монет`,
    );
  });
};

const parseFunc = () => {
  axios
    .get(
      `https://api.twitch.tv/kraken/streams/?channel=${
        CONFIG.channel
      }&client_id=${botConfig.clientId}`,
    )
    .then(res => {
      if (res.data.streams.length === 0) {
        //
      } else {
        Rank.parseChatters();
      }
    })
    .catch(err => {
      console.log('err', err);
    });
};

const checkTrack = items => {
  if (items.length === 0) {
    client.say(CONFIG.channel, 'Неверный ID видео');
    return false;
  } else if (items[0].snippet.categoryId !== '10') {
    client.say(CONFIG.channel, 'Видео не в категории музыка');
    return false;
  } else if (parseInt(items[0].statistics.viewCount) < 50000) {
    client.say(CONFIG.channel, 'На видео меньше 50.000 просмотров');
    return false;
  } else if (
    parseInt(items[0].statistics.likeCount) /
      ((parseInt(items[0].statistics.likeCount) +
        parseInt(items[0].statistics.dislikeCount)) /
        100) <
    70
  ) {
    client.say(CONFIG.channel, 'На видео меньше 70% лайков');
    return false;
  } else if (
    iso.toSeconds(iso.parse(items[0].contentDetails.duration)) >
    CONFIG.maxTrackLength * 60
  ) {
    client.say(
      CONFIG.channel,
      `Видео длится больше ${CONFIG.maxTrackLength} минут`,
    );
    return false;
  } else if (items[0].snippet.liveBroadcastContent === 'live') {
    client.say(CONFIG.channel, 'Это прямая трансляция');
    return false;
  } else {
    return true;
  }
};

const addTrack = (message, senderData) => {
  axios
    .get(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&videoCategoryId=10&type=video&q=${encodeURIComponent(
        message.slice(3),
      )}&maxResults=1&key=${botConfig.youtubeKey}`,
    )
    .then(res => {
      const username = senderData.username;
      const id = res.data.items[0].id.videoId;
      const title = res.data.items[0].snippet.title;
      const author = res.data.items[0].snippet.channelTitle;
      axios
        .get(
          `https://www.googleapis.com/youtube/v3/videos?id=${
            res.data.items[0].id.videoId
          }&key=${
            botConfig.youtubeKey
          }&part=contentDetails%2Cstatistics%2Csnippet`,
        )
        .then(res => {
          const duration = iso.toSeconds(
            iso.parse(res.data.items[0].contentDetails.duration),
          );
          if (checkTrack(res.data.items)) {
            User.getUser({ username: username }, (err, data) => {
              if (data.length === 0) {
                // Empty
              } else if (data[0].coins < duration * CONFIG.pricePerSecond) {
                client.say(CONFIG.channel, 'Нужно больше золота...');
              } else {
                onAddTrack(
                  data,
                  username,
                  duration * CONFIG.pricePerSecond,
                  id,
                  title,
                  author,
                );
              }
            });
          }
        });
    });
};

const onAddTrack = (data, username, price, id, title, author) => {
  User.updateUser(
    { username: username },
    {
      coins: data[0].coins - price,
      totalxp: data[0].totalxp,
      lastOnline: Date.now(),
    },
    (err, data) => {},
  );
  Music.insertMusic(
    {
      sender: username,
      id: id,
      title: title,
      author: author,
      date: Date.now(),
    },
    (err, data) => {
      socket.emit('addTrack', {
        _id: data._id,
        sender: username,
        id: id,
        title: title,
        author: author,
        date: Date.now(),
      });
    },
  );
  client.say(CONFIG.channel, 'Трек добавлен в очередь');
};

const currentTrack = () => {
  Music.findTrack((err, res) => {
    if (res.length === 0) {
      client.say(CONFIG.channel, 'Сейчас ничего не играет');
    } else {
      client.say(CONFIG.channel, `Сейчас играет ${res[0].title}`);
    }
  });
};

const bet = (side, message, senderData) => {
  const username = senderData.username;
  if (betAllow === true) {
    if (parseFloat(message.slice(5) * 100).toFixed(2) < CONFIG.minBet) {
      client.whisper(username, `Сумма ставки меньше ${CONFIG.minBet / 100}`);
      return;
    }
    if (parseFloat(message.slice(5) * 100).toFixed(2) > CONFIG.maxBet) {
      client.whisper(username, `Сумма ставки больше ${CONFIG.maxBet / 100}`);
      return;
    }
    User.getUser({ username: username }, (err, data) => {
      if (data.length === 0) {
        return false;
      } else {
        if (parseFloat(message.slice(5) * 100).toFixed(2) === 'NaN') {
          client.whisper(username, 'Неверная сумма ставки');
        } else if (
          data[0].coins < parseFloat(message.slice(5) * 100).toFixed(2)
        ) {
          client.whisper(username, 'Недостаточно денег');
        } else {
          Bet.findBet({ username: username }, (err, data) => {
            if (data.length > 0) {
              User.updateUser(
                { username },
                {
                  coins: data[0].coins - parseFloat(message.slice(5) * 100),
                  totalxp: data[0].totalxp,
                  lastOnline: Date.now(),
                },
                (err, res) => {
                  console.log('Новая ставка!');
                },
              );
              Bet.insertBet({
                username,
                side,
                sum: parseFloat(message.slice(5) * 100),
              });
              socket.emit('bet', {
                username,
                side,
                sum: parseFloat(message.slice(5) * 100),
              });
              client.whisper(username, 'Ваша ставка принята');
            } else {
              client.whisper(username, 'Вы уже сделали ставку на эту игру');
            }
          });
        }
      }
    });
  } else {
    client.whisper(username, 'Прием ставок закрыт');
  }
};

const moderAction = action => {
  switch (action) {
    case 'openBet':
      if (betStage === 'preparing') {
        socket.emit('moderAction', action);
      } else {
        client.say(CONFIG.channel, 'Ещё рано давать такую команду');
      }
      break;
    case 'closeBet':
      if (betStage === 'start') {
        socket.emit('moderAction', action);
      } else {
        client.say(CONFIG.channel, 'Ещё рано давать такую команду');
      }
      break;
    case 'winBet':
      if (betStage === 'process') {
        socket.emit('moderAction', action);
      } else {
        client.say(CONFIG.channel, 'Ещё рано давать такую команду');
      }
      break;
    case 'loseBet':
      if (betStage === 'process') {
        socket.emit('moderAction', action);
      } else {
        client.say(CONFIG.channel, 'Ещё рано давать такую команду');
      }
      break;
    default:
      break;
  }
};

const roll = senderData => {
  const { username } = senderData;
  client.say(
    CONFIG.channel,
    `${username} выпало число ${(Math.random() * 100).toFixed(0)}`,
  );
};

client.on('chat', (useless, senderData, message) => {
  Rank.addXpForMsg(senderData.username);
  const lowMessage = message.toLowerCase();
  if (lowMessage.includes('!wallet')) {
    getWallet(senderData);
  }
  if (lowMessage.startsWith('!s ')) {
    addTrack(message, senderData);
  }
  if (lowMessage.includes('!track')) {
    currentTrack();
  }
  if (lowMessage.startsWith('!луз ') || lowMessage.startsWith('!lose ')) {
    bet('lose', message, senderData);
  }
  if (lowMessage.startsWith('!вин ') || lowMessage.startsWith('!win ')) {
    bet('win', message, senderData);
  }
  if (lowMessage === '!open') {
    if (CONFIG.moders.includes(senderData.username.toLowerCase())) {
      moderAction('openBet');
    }
  }
  if (lowMessage === '!close') {
    if (CONFIG.moders.includes(senderData.username.toLowerCase())) {
      moderAction('closeBet');
    }
  }
  if (lowMessage === '!w' || lowMessage === '!ц') {
    if (CONFIG.moders.includes(senderData.username.toLowerCase())) {
      moderAction('winBet');
    }
  }
  if (lowMessage === '!l' || lowMessage === '!д') {
    if (CONFIG.moders.includes(senderData.username.toLowerCase())) {
      moderAction('loseBet');
    }
  }
  if (lowMessage.startsWith('!roll') || lowMessage.startsWith('!кщдд')) {
    roll(senderData);
  }
});

mongoose
  .connect(
    db.link,
    { useNewUrlParser: true },
  )
  .then(() => {
    Rank.parseChatters();
    client.connect();
    setInterval(() => parseFunc(), 60000);
  });

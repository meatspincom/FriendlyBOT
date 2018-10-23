const axios = require('axios');
const User = require('../config/userSchema');
const config = require('../CONFIG');
let msgRewards = {};

const addUser = (username, coins = 0, totalxp = 0) => {
  User.insertUser({ username, coins, totalxp, lastOnline: Date.now() });
};

const addXp = (username, coins, totalxp) => {
  User.updateUser(
    { username },
    {
      coins: coins,
      totalxp: totalxp,
      lastOnline: Date.now()
    },
    (err, data) => {}
  );
};

const addXpForMsg = username => {
  if (msgRewards[username] === true) {
    //
  } else {
    User.getUser({ username }, (err, data) => {
      if (data.length === 0) {
        addUser(username, config.moneyPerMessage, 1);
      } else {
        addXp(
          username,
          parseFloat(data[0].coins) + config.moneyPerMessage,
          parseFloat(data[0].totalxp)
        );
      }
    });
    msgRewards[username] = true;
    console.log(msgRewards);
  }
};

const parseChatters = () => {
  axios
    .get(`http://tmi.twitch.tv/group/user/${config.channel}/chatters`)
    .then(res => {
      let viewersNotInDb = res.data.chatters.viewers.concat(
        res.data.chatters.moderators
      );
      let viewersInDb = [...viewersNotInDb];

      User.getUser({ username: { $in: viewersNotInDb } }, (err, data) => {
        data.map(viewer => {
          viewersNotInDb = viewersNotInDb.filter(
            one => one !== viewer.username
          );
        });
        viewersNotInDb.map(viewer => {
          addUser(viewer);
          viewersInDb = viewersInDb.filter(one => one !== viewer);
        });
        viewersInDb.map(viewer => {
          let viewerData = data.find(item => item.username === viewer);
          addXp(
            viewer,
            viewerData.coins + config.moneyPerMinute,
            viewerData.totalxp + 1
          );
        });
      });
    });
  msgRewards = {};
  console.log(
    `Всем в чате было выдано ${(config.moneyPerMinute / 100).toFixed(2)} монет`
  );
};

module.exports.parseChatters = parseChatters;
module.exports.addXpForMsg = addXpForMsg;

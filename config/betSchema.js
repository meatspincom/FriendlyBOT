const mongoose = require('mongoose');

let betSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  side: {
    type: String,
    required: true,
  },
  sum: {
    type: Number,
    required: true,
  },
});

const Bet = mongoose.model('Bet', betSchema);

module.exports.insertBet = (data, callback) => {
  Bet.create(data, callback);
};
module.exports.findBet = (data, callback) => {
  Bet.find(data, callback);
};
modul;
module.exports.findBets = callback => {
  Bet.find(callback);
};
module.exports.dropBets = () => {
  Bet.remove();
};

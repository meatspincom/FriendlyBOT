const mongoose = require('mongoose');

let userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  coins: {
    type: Number,
    required: true,
    default: 0
  },
  totalxp: {
    type: Number,
    required: true,
    default: 0
  },
  lastOnline: {
    type: Date,
    required: true
  }
});

const User = mongoose.model('User', userSchema);

module.exports.getUser = (user, callback) => {
  User.find(user, callback);
};

module.exports.updateMany = (user, newData, callback) => {
  User.updateMany(user, newData, callback);
};

module.exports.updateUser = (user, newData, callback) => {
  User.updateOne(user, newData, callback);
};

module.exports.insertUser = data => {
  User.create(data);
};

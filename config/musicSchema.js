const mongoose = require('mongoose');

let musicSchema = new mongoose.Schema({
  sender: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  }
});

const Music = mongoose.model('Music', musicSchema);

module.exports.insertMusic = (data, callback) => {
  Music.create(data, callback);
};
module.exports.findTrack = callback => {
  Music.find(callback);
};

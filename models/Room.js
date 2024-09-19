const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  password: { type: String, require: true },

  hostName: { type: String, require: true },
  offer: {
    sdp: { type: String, require: true },
    type: { type: String, require: true },
  },
  hostCandidate: { type: String, require: true },

  userName: { type: String, require: true },
  answer: {
    sdp: { type: String, require: true },
    type: { type: String, require: true },
  },
  userCandidate: { type: String, require: true },

  socketId: { type: String, require: true },
  state: { type: String, require: true },
});

module.exports = mongoose.model("Room", roomSchema);

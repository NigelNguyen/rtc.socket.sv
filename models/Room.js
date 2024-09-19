const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const roomSchema = new Schema({
  password: { type: String, required: true },

  hostName: { type: String },
  offer: {
    sdp: { type: String },
    type: { type: String },
  },
  hostCandidates: [{ type: String }],

  userName: { type: String },
  answer: {
    sdp: { type: String },
    type: { type: String },
  },
  userCandidates: [{ type: String }],

  socketId: { type: String },
  state: { type: String },
  iceState: { type: String },
});

module.exports = mongoose.model("Room", roomSchema);

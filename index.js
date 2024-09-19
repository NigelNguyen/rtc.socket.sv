require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Room = require("./models/Room");
const bodyParser = require("body-parser");
const FE_URLS = process.env.FE_URLS;
const MONGODB_URI = process.env.MONGODB_URI;
const SALT = process.env.SALT;
const PORT = process.env.PORT || 3000;
const bcrypt = require("bcryptjs");
const socketIO = require("./socket");

const app = express();
app.use(bodyParser.json());
app.use(express.json());
app.use(
  cors({
    origin: FE_URLS.split(","),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: false,
  })
);

function error(err, req, res, next) {
  // log it
  if (!test) console.error(err.stack);

  // respond with 500 "Internal Server Error".
  res.status(500);
  res.send("Internal Server Error");
}
app.use(error);

app.get("/awake", (req, res) => {
  res.send("waked up");
});

app.post("/create-room", async (req, res) => {
  const { password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, Number(SALT));
  const room = await new Room({
    password: bcrypt.hashSync(password, hashedPassword),
  });

  if (room) {
    return await room
      .save()
      .then(() => res.status(201).json({ roomId: room._id }));
  }

  return res.status(500).send("Failed to create room");
});

app.post("/join-room", async (req, res) => {
  const { roomId, password } = req.body;
  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).send("Room not found");
  }

  const passwordMatched = await bcrypt.compare(password, room.password);
  if (!passwordMatched) {
    return res.status(401).send("Password incorrect");
  }
  return res.status(201).json({ roomId: room._id });
});

app.get("/room-info/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const room = await Room.findById(roomId);
  if (!room) {
    return res.status(404).send("Room not found");
  }

  return res.send({ offer: room.offer, candidate: room.hostCandidate });
});

mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    console.log("connected database");
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
    const io = require("./socket").init(server);
    io.on("connection", (socket) => {
      console.log("Client Connected!");

      socket.on("disconnect", () => {
        console.log("Client Disconnected!");
      });

      // MAKE CALL
      socket.on("offer", async ({ roomId, offer, host }) => {
        const room = await Room.findOneAndUpdate(
          { _id: roomId },
          { hostName: host, socketId: socket.id, offer, state: "offer" }
        );
        if (!room) {
          console.log("Error: Failed to update offer");
        }
        console.log("set offer");
      });

      socket.on("host-candidate", async ({ candidate, roomId }) => {
        const room = await Room.findOneAndUpdate(
          { _id: roomId },
          {
            hostCandidate: JSON.stringify(candidate),
            state: "set-host-candidate",
          }
        );

        if (!room) {
          console.log("Error: Failed to update host candidate");
        }
        console.log("set host candidate");
      });

      // JOIN CALL
      socket.on("answer", async ({ roomId, answer, userName }) => {
        const room = await Room.findOneAndUpdate(
          { _id: roomId },
          { userName, answer, state: "answered" }
        );
        if (!room) {
          console.log("Error: Failed to update answer");
        }
        console.log("set answer");
        socket.to(room.socketId).emit("user-answer", answer);
      });

      socket.on("user-candidate", async ({ candidate, roomId }) => {
        const room = await Room.findOneAndUpdate(
          { _id: roomId },
          {
            userCandidate: JSON.stringify(candidate),
            state: "set-user-candidate",
          }
        );
        if (!room) {
          console.log("Error: Failed to update user candidate");
        }
        socket.to(room.socketId).emit("user-candidate", candidate);
        console.log("set user candidate");
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });

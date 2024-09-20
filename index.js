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
    hostCandidates: [],
    userCandidates: [],
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

  return res.send({ offer: room.offer, candidates: room.hostCandidates });
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

      socket.on("disconnect", async () => {
        const room = await Room.findOneAndDelete({ socketId: socket.id });
        console.log("Client Disconnected! Deleted Room");
      });

      // MAKE CALL
      socket.on(
        "offer-call",
        async ({ roomId, offer, candidates, userName }) => {
          const room = await Room.findOneAndUpdate(
            { _id: roomId },
            {
              hostName: userName,
              socketId: socket.id,
              offer,
              hostCandidates: candidates,
              state: "stored-offer",
            }
          );
          if (!room) {
            console.log("Error: Failed to update offer");
          }
          console.log("set offer");
        }
      );

      // JOIN CALL
      socket.on(
        "answer-call",
        async ({ roomId, answer, candidates, userName }) => {
          const room = await Room.findOneAndUpdate(
            { _id: roomId },
            {
              userName,
              answer,
              userCandidates: candidates,
              state: "stored-answer",
            }
          );
          if (!room) {
            console.log("Error: Failed to update offer");
          }
          console.log("WHICH SERVER SEND: ", {
            answer,
            candidates,
            length: candidates.length,
          });
          socket.to(room.socketId).emit("user-answer", {
            answer,
            candidates,
          });
          console.log("answered");
        }
      );

      // Resend answer and candidates to user
      socket.on("resend-user-candidates", async ({ roomId }) => {
        const room = await Room.findById(roomId);
        if (!room) {
          console.log("Error: Room not found");
        }
        console.log("WHICH SERVER SEND AGAIN: ", {
          answer: room.answer,
          candidates: room.userCandidates,
          length: room.userCandidates.length,
        });
        socket.to(room.socketId).emit("user-answer", {
          answer: room.answer,
          candidates: room.userCandidates,
        });
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });

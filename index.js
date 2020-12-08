const express = require("express");
const chalk = require("chalk");
const http = require("http");
const cors = require("cors");
const socketio = require("socket.io");
const app = express();

const {
  addRoom,
  removeRoom,
  getAllRooms,
  getRoomById,
  addPlayer,
  getPlayerInRoom,
  removePlayer,
  startGame,
  getPlayer,
  hasVoted,
  getMaxVotes,
  killPlayer,
  hangPlayer,
  clearVotes,
  savePlayer,
  protectPlayer,
  poisonPlayer,
  getHunter,
  switchTurn,
} = require("./utils/rooms");

const server = http.createServer(app);
app.use(cors());
const io = socketio(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

require("./startup/logging")();
require("./startup/routes")(app);
require("./startup/db")();
require("./startup/config");
require("./startup/validation");

io.on("connection", (socket) => {
  console.log(chalk.cyan("New connection"));

  socket.emit("room", getAllRooms());

  socket.on("create", ({ roomId }) => {
    addRoom(roomId);
  });

  socket.on("join", ({ userName, roomId }) => {
    addPlayer(userName, roomId);

    socket.join(roomId);

    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    socket.broadcast.to(roomId).emit("message", {
      userName: "Admin",
      text: `${userName} has joined.`,
      isFromWolf: false,
    });

    socket.emit("message", {
      userName: "Admin",
      text: "Welcome",
      isFromWolf: false,
    });

    io.emit("room", getAllRooms());

    socket.on("disconnect", () => {
      const room = getRoomById(roomId);
      if (room.playerList.length > 1) {
        removePlayer(userName, roomId);
      } else if (room.playerList.length === 1) {
        removePlayer(userName, roomId);
        removeRoom(roomId);
      }
      socket.leave(roomId);
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      socket.broadcast.to(roomId).emit("message", {
        userName: "Admin",
        text: `${userName} has left.`,
        isFromWolf: false,
      });
      io.emit("room", getAllRooms());
    });
  });

  socket.on("leave", ({ userName, roomId }) => {
    removePlayer(userName, roomId);
    socket.leave(roomId);
    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    socket.broadcast.to(roomId).emit("message", {
      userName: "Admin",
      text: `${userName} has left.`,
      isFromWolf: false,
    });
    io.emit("room", getAllRooms());
  });

  socket.on("deleteRoom", ({ userName, roomId }) => {
    removePlayer(userName, roomId);
    socket.leave(roomId);
    removeRoom(roomId);
    io.emit("room", getAllRooms());
  });

  socket.on("start", ({ roomId }) => {
    startGame(roomId);
    io.emit("room", getAllRooms());
    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    io.to(roomId).emit("changeTurn", "gameStart");
  });

  socket.on("sendMessage", ({ userName, text, isFromWolf, roomId }) => {
    io.to(roomId).emit("message", { userName, text, isFromWolf });
  });

  socket.on("turnChange", ({ roomId }) => {
    const room = getRoomById(roomId);
    const { newTurn, time } = switchTurn(room.turn);
    let count = time / 1000 - 1;
    if (time > 100) {
      let timer = setInterval(() => {
        if (count > -1) {
          io.to(roomId).emit("countDown", count);
          count -= 1;
        } else clearInterval(timer);
      }, 1000);
    }

    let timeout = setTimeout(() => {
      room.turn = newTurn;
      io.to(roomId).emit("changeTurn", room.turn);
    }, time + 200);

    if (room.turn === "dayEnd") {
      const mostVoted = getMaxVotes(getPlayerInRoom(roomId));
      io.to(roomId).emit("hang", mostVoted);
      if (mostVoted) {
        hangPlayer(roomId, mostVoted);
      }
      clearVotes(roomId);
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    } else if (room.turn === "dayStart") {
      let killedPlayer = getMaxVotes(getPlayerInRoom(roomId));
      let poisonedPlayer = room.poisonedPlayer;
      const hunter = getHunter(roomId);
      if (killedPlayer !== "") {
        killedPlayer = killPlayer(roomId, killedPlayer);
      }
      if (poisonedPlayer !== "") {
        poisonedPlayer = killPlayer(roomId, poisonedPlayer);
      }
      io.to(roomId).emit("kill", { killedPlayer, poisonedPlayer });
      if (!hunter.isAlive) {
        setTimeout(() => {
          clearTimeout(timeout);
          room.turn = "hunter";
          io.to(roomId).emit("changeTurn", "hunter");
        }, 3000);
      }
      clearVotes(roomId);
      room.savedPlayer = "";
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    } else if (room.turn === "guard") {
      const protectedPlayer = room.protectedPlayer;
      io.to(roomId).emit("lastProtected", protectedPlayer);
      room.protectedPlayer = "";
    } else if (room.turn === "witch") {
      const killedPlayer = getMaxVotes(getPlayerInRoom(roomId));
      io.to(roomId).emit("killedByWolf", killedPlayer);
    }
  });

  socket.on("playerAction", ({ from, target, type, roomId }) => {
    console.log(from, type, target);
    const targettedPlayer = getPlayer(roomId, target);
    if (type === "vote") {
      hasVoted(getPlayerInRoom(roomId), from);
      targettedPlayer.votes.push(from);
    } else if (type === "kill") {
      hasVoted(getPlayerInRoom(roomId), from);
      targettedPlayer.votes.push(from);
    } else if (type === "protect") {
      protectPlayer(roomId, target);
    } else if (type === "check") {
      socket.emit("reveal", {
        checkTarget: targettedPlayer.name,
        isWolf: targettedPlayer.role === "wolf",
      });
    } else if (type === "shoot") {
      targettedPlayer.isAlive = false;
      io.to(roomId).emit("hunterShoot", targettedPlayer.name);
    } else if (type === "save") {
      savePlayer(roomId, target);
    } else if (type === "poison") {
      poisonPlayer(roomId, target);
    }
    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
  });
});

let port = 3001;
server.listen(port, () =>
  console.log(chalk.yellow(`Listening on port ${port}...`))
);

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
  clearVotes,
  clearProtection,
  protectPlayer,
  switchTurn,
} = require("./utils/rooms");

const server = http.createServer(app);
app.use(cors());
const io = socketio(server, {
  cors: {
    origin: "http://localhost:3001",
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
    console.log(room.turn);
    const { newTurn, time } = switchTurn(room.turn);
    // console.log(room.playerList, room.turn);
    console.log(newTurn);
    let count = time / 1000;
    if (time > 100) {
      let timer = setInterval(() => {
        if (count > 0) {
          io.to(roomId).emit("countDown", count);
          count -= 1;
        } else clearInterval(timer);
      }, 1000);
    }

    let timeout = setTimeout(() => {
      room.turn = newTurn;
      io.to(roomId).emit("changeTurn", room.turn);
    }, time);

    if (room.turn === "dayEnd") {
      const hangedPlayer = getMaxVotes(getPlayerInRoom(roomId));
      if (hangedPlayer) {
        killPlayer(roomId, hangedPlayer.name);
        io.to(roomId).emit("hang", {
          name: hangedPlayer.name,
          role: hangedPlayer.role,
        });
      }
      clearVotes(roomId);
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    } else if (room.turn === "dayStart") {
      const killedPlayer = getMaxVotes(getPlayerInRoom(roomId));
      if (killedPlayer) {
        killPlayer(roomId, killedPlayer.name);
        io.to(roomId).emit("kill", {
          name: killedPlayer.name,
          role: killedPlayer.role,
        });
        if (killedPlayer.role === "hunter") {
          setTimeout(() => {
            clearTimeout(timeout);
            room.turn = "hunter";
            console.log(3);
            io.to(roomId).emit("changeTurn", "hunter");
          }, 3000);
        }
      }
      clearVotes(roomId);
      clearProtection(roomId);
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    } else if (room.turn === "guard") {
      const protectedPlayer = room.protectedPlayer;
      io.to(roomId).emit("lastProtected", protectedPlayer);
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
      io.to(roomId).emit("hunterShoot", targettedPlayer);
    }
    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
  });
});

let port = 3001;
server.listen(port, () =>
  console.log(chalk.yellow(`Listening on port ${port}...`))
);

const express = require("express");
const chalk = require("chalk");
const http = require("http");
const cors = require("cors");
const socketio = require("socket.io");
const app = express();

const {
  addRoom,
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
  switchTurn,
} = require("./utils/rooms");

const server = http.createServer(app);
app.use(cors());
const io = socketio(server, {
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
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

    socket.on("leave", () => {
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

    socket.on("sendMessage", ({ text, isFromWolf }) => {
      io.to(roomId).emit("message", { userName, text, isFromWolf });
    });

    socket.on("start", () => {
      startGame(roomId);
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      const room = getRoomById(roomId);
      io.to(roomId).emit("changeTurn", "gameStart");
      socket.on("turnChange", () => {
        const { newTurn, time } = switchTurn(room.turn);
        console.log(room.playerList, room.turn);
        // let count = time / 1000;
        // if (count > 0) {
        //   let timer = setInterval(() => {
        //     console.log(count);
        //     count -= 1;
        //   }, 1000);
        // }
        setTimeout(() => {
          room.turn = newTurn;
          io.to(roomId).emit("changeTurn", room.turn);
          // clearInterval(timer);
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
          }
          clearVotes(roomId);
          clearProtection(roomId);
          io.to(roomId).emit("roomPlayer", getRoomById(roomId));
        }
      });
    });

    socket.on("playerAction", ({ from, target, type }) => {
      console.log(from, type, target);
      const targettedPlayer = getPlayer(roomId, target);
      if (type === "Vote") {
        hasVoted(getPlayerInRoom(roomId), from);
        targettedPlayer.votes.push(from);
      } else if (type === "Kill") {
        hasVoted(getPlayerInRoom(roomId), from);
        targettedPlayer.votes.push(from);
      } else if (type === "Protect") {
        clearProtection(roomId);
        targettedPlayer.isProtected = true;
      } else if (type === "Check") {
        socket.emit("reveal", { isWolf: targettedPlayer.role === "wolf" });
      }
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
    });

    socket.on("disconnect", () => {
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
  });
});

let port = 3001;
server.listen(port, () =>
  console.log(chalk.yellow(`Listening on port ${port}...`))
);

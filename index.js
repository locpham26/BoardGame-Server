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
  getAllWolves,
  switchTurn,
  checkWin,
  endGame,
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

  socket.on("searchRoom", ({ roomId }) => {
    const room = getRoomById(roomId);
    if (room) {
      socket.emit("searchedRoom", [room]);
    } else {
      socket.emit("searchedRoom", []);
    }
  });

  socket.on("showRooms", () => {
    socket.emit("room", getAllRooms());
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
      if (room && room.playerList.length > 1) {
        removePlayer(userName, roomId);
      } else if (room && room.playerList.length === 1) {
        removePlayer(userName, roomId);
        removeRoom(roomId);
      }
      hasVoted(getPlayerInRoom(roomId), userName);

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
    hasVoted(getPlayerInRoom(roomId), userName);
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
    io.to(roomId).emit("changeTurn", { roomTurn: "gameStart", skipped: false });
  });

  socket.on("sendMessage", ({ userName, text, isFromWolf, roomId }) => {
    io.to(roomId).emit("message", { userName, text, isFromWolf });
  });

  let timeout;
  let timer;

  socket.on("turnChange", ({ roomId, skipped }) => {
    const room = getRoomById(roomId);
    const { newTurn, time } = switchTurn(room.turn);
    let count = time / 1000 - 1;

    clearTimeout(timeout);
    clearInterval(timer);

    if (skipped) {
      room.turn = newTurn;
      io.to(roomId).emit("changeTurn", { roomTurn: room.turn, skipped: false });
    } else {
      if (time > 100) {
        timer = setInterval(() => {
          if (count > -1) {
            io.to(roomId).emit("countDown", count);
            count -= 1;
          } else clearInterval(timer);
        }, 1000);
      }

      timeout = setTimeout(() => {
        room.turn = newTurn;
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: false,
        });
      }, time + 300);

      if (room.turn === "dayEnd") {
        room.skippedVotes = 0;
        const mostVoted = getMaxVotes(getPlayerInRoom(roomId));
        const hunter = getHunter(roomId);
        io.to(roomId).emit("hang", mostVoted);

        if (mostVoted) {
          hangPlayer(roomId, mostVoted);
        }

        if (checkWin(roomId)) {
          setTimeout(() => {
            clearTimeout(timeout);
            room.turn = "gameEnd";
            io.to(roomId).emit("changeTurn", {
              roomTurn: "gameEnd",
              skipped: false,
            });
            io.to(roomId).emit("win", checkWin(roomId));
          }, 3000);
        } else if (hunter && hunter.name === mostVoted) {
          setTimeout(() => {
            clearTimeout(timeout);
            room.turn = "hunterDay";
            io.to(roomId).emit("changeTurn", {
              roomTurn: "hunterDay",
              skipped: false,
            });
          }, 3000);
        }

        clearVotes(roomId);
        io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      } else if (room.turn === "dayStart") {
        room.skippedVotes = 0;
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

        if (checkWin(roomId)) {
          setTimeout(() => {
            clearTimeout(timeout);
            room.turn = "gameEnd";
            io.to(roomId).emit("changeTurn", {
              roomTurn: "gameEnd",
              skipped: false,
            });
            io.to(roomId).emit("win", checkWin(roomId));
          }, 3000);
        } else if (
          hunter &&
          (hunter.name === killedPlayer || hunter.name === poisonedPlayer)
        ) {
          setTimeout(() => {
            clearTimeout(timeout);
            room.turn = "hunterDay";
            io.to(roomId).emit("changeTurn", {
              roomTurn: "hunterDay",
              skipped: false,
            });
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
      } else if (room.turn === "end") {
        clearTimeout(timeout);
        endGame(roomId);
        io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      }
    }
  });

  socket.on("skipTurn", ({ roomId }) => {
    const room = getRoomById(roomId);
    if (room.turn !== "villager" && room.turn !== "wolf") {
      io.to(roomId).emit("changeTurn", { roomTurn: room.turn, skipped: true });
    } else if (room.turn === "villager") {
      room.skippedVotes += 1;
      if (room.skippedVotes === getPlayerInRoom(roomId).length) {
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: true,
        });
      }
    } else if (room.turn === "wolf") {
      room.skippedVotes += 1;
      if (room.skippedVotes === getAllWolves(roomId)) {
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: true,
        });
      }
    }
  });

  socket.on("playerAction", ({ from, target, type, roomId }) => {
    console.log(from, type, target);
    const room = getRoomById(roomId);
    const targettedPlayer = getPlayer(roomId, target);

    if (type === "vote") {
      hasVoted(getPlayerInRoom(roomId), from);
      targettedPlayer.votes.push(from);
    } else if (type === "kill") {
      socket.emit("disable", ["kill", "skip"]);
      targettedPlayer.votes.push(from);
      room.skippedVotes += 1;
      if (room.skippedVotes === getAllWolves(roomId)) {
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: true,
        });
      }
    } else if (type === "protect") {
      socket.emit("disable", ["protect"]);
      protectPlayer(roomId, target);
    } else if (type === "check") {
      socket.emit("disable", ["check"]);
      socket.emit("reveal", {
        checkTarget: targettedPlayer.name,
        isWolf: targettedPlayer.role === "wolf",
      });
    } else if (type === "shoot") {
      socket.emit("disable", ["shoot"]);
      targettedPlayer.isAlive = false;
      socket.emit("hunterShoot", targettedPlayer.name);
    } else if (type === "save") {
      savePlayer(roomId, target);
      socket.emit("disable", ["save"]);
    } else if (type === "poison") {
      poisonPlayer(roomId, target);
      socket.emit("disable", ["poison"]);
    } else if (type === "skip") {
      socket.emit("disable", ["vote", "kill", "skip"]);
    }
    io.to(roomId).emit("roomPlayer", getRoomById(roomId));
  });
});

let port = 3001;
server.listen(port, () =>
  console.log(chalk.yellow(`Listening on port ${port}...`))
);

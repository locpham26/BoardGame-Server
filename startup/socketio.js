const socketio = require("socket.io");
const chalk = require("chalk");

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
} = require("../utils/rooms");

const {
  activatePlayer,
  getOnlinePlayerByName,
  getOnlinePlayerById,
  removeFromOnlineList,
} = require("../utils/status");

module.exports = function (server) {
  const io = socketio(server, {
    cors: {
      origin: "http://localhost:3001",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.on("connection", (socket) => {
    //log connection
    console.log(
      chalk.cyan(`New connection from ${socket.handshake.query.userName}`)
    );

    //add player to online list
    activatePlayer({ id: socket.id, name: socket.handshake.query.userName });

    //show available rooms to newly connected player
    socket.emit("room", getAllRooms());

    //create a new room
    socket.on("create", ({ roomId }) => {
      addRoom(roomId);
    });

    //search room by id
    socket.on("searchRoom", ({ roomId }) => {
      const rooms = getAllRooms();
      let found = [];
      rooms.forEach((room) => {
        if (room.id.includes(roomId)) {
          found.push(room);
        }
      });
      socket.emit("searchedRoom", found);
    });

    //show all rooms
    socket.on("showRooms", () => {
      socket.emit("room", getAllRooms());
    });

    //join a room
    socket.on("join", ({ userName, roomId }) => {
      addPlayer(socket.id, userName, roomId); //add player to the room

      socket.join(roomId); //make the socket actually join the room

      io.to(roomId).emit("roomPlayer", getRoomById(roomId)); //inform the joining to others in the room

      //show player joining message to all players already in the room
      socket.broadcast.to(roomId).emit("message", {
        userName: "Admin",
        text: `${userName} has joined.`,
        isFromWolf: false,
      });

      //show welcome message to the player who joins
      socket.emit("message", {
        userName: "Admin",
        text: "Welcome",
        isFromWolf: false,
      });

      //inform players outside the room that a slot in the room has just been taken by the player who joins
      io.emit("room", getAllRooms());

      //handle player disconnect when in the room
      socket.on("disconnect", () => {
        const room = getRoomById(roomId);
        if (room && room.playerList.length > 1) {
          removePlayer(userName, roomId); //remove player from the room
        } else if (room && room.playerList.length === 1) {
          removePlayer(userName, roomId); //remove player from the room
          removeRoom(roomId); //splice the room
        }
        hasVoted(getPlayerInRoom(roomId), userName); //remove all the votes conducted by the player who left

        socket.leave(roomId); //make the socket actually leave the room

        io.to(roomId).emit("roomPlayer", getRoomById(roomId)); //inform the leaving to others in the room

        //show leaving message to others in the room
        socket.broadcast.to(roomId).emit("message", {
          userName: "Admin",
          text: `${userName} has left.`,
          isFromWolf: false,
        });

        //inform others outside the room that a slot in the room was just freed
        io.emit("room", getAllRooms());
      });
    });

    //handle player disconnect when outside the room
    socket.on("disconnect", () => {
      const player = getOnlinePlayerById(socket.id);
      if (player) {
        removeFromOnlineList(player.id); //remove from online list
      }
    });

    //handle player leaving the room by clicking leaving button, similar to when he/she disconnects when in room
    socket.on("leave", ({ userName, roomId }) => {
      removePlayer(userName, roomId); //remove player from the room
      hasVoted(getPlayerInRoom(roomId), userName); //remove all votes conducted by the player who left
      removeFromOnlineList(socket.id);
      socket.leave(roomId); //socket actually leaves
      io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      socket.broadcast.to(roomId).emit("message", {
        userName: "Admin",
        text: `${userName} has left.`,
        isFromWolf: false,
      });
      io.emit("room", getAllRooms());
    });

    //splice the room when the last player leaves
    socket.on("deleteRoom", ({ userName, roomId }) => {
      removePlayer(userName, roomId); //remove the player
      socket.leave(roomId);
      removeRoom(roomId); //remove the room
      io.emit("room", getAllRooms()); //inform others that the room no longer exists
    });

    //start the game
    socket.on("start", ({ roomId }) => {
      startGame(roomId);
      io.emit("room", getAllRooms()); //inform players outside the room that the room is no longer available
      io.to(roomId).emit("roomPlayer", getRoomById(roomId)); //inform players in the room about the start
      io.to(roomId).emit("changeTurn", {
        roomTurn: "gameStart",
        skipped: false,
      }); //change the room's turn to startGame
    });

    //sending message in the room
    socket.on("sendMessage", ({ userName, text, isFromWolf, roomId }) => {
      io.to(roomId).emit("message", { userName, text, isFromWolf });
    });

    //host kicks another player out of the room
    socket.on("kick", ({ roomId, playerName }) => {
      const kicked = getPlayer(roomId, playerName);
      io.to(kicked.id).emit("kicked"); //emit the kick event to the kicked player
    });

    //invite a friend to the playroom
    socket.on("invite", ({ inviter, friendName, roomId }) => {
      const invited = getOnlinePlayerByName(friendName);
      console.log("invite", friendName);
      if (invited) {
        io.to(invited.id).emit("invited", { inviter, roomId }); //emit invited event to the invited player
      }
    });

    //countdown clock for changing turns
    let timeout;
    let timer;

    //listen to turn change event from the host
    socket.on("turnChange", ({ roomId, skipped }) => {
      const room = getRoomById(roomId);
      const { newTurn, time } = switchTurn(room.turn); //render a new turn
      let count = time / 1000 - 1; //duration of that turn

      clearTimeout(timeout); //clear duration from previous turn
      clearInterval(timer); //clear countdown clock from previous turn

      if (skipped) {
        //player wants to skip turn
        room.turn = newTurn;
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: false,
        }); //change to the next turn
      } else {
        //emit countdown event to make all clocks synchronous
        if (time > 100) {
          timer = setInterval(() => {
            if (count > -1) {
              io.to(roomId).emit("countDown", count);
              count -= 1;
            } else clearInterval(timer);
          }, 1000);
        }

        //change to the next turn
        timeout = setTimeout(() => {
          room.turn = newTurn;
          io.to(roomId).emit("changeTurn", {
            roomTurn: room.turn,
            skipped: false,
          });
        }, time + 300);

        //check game progress at certains turn
        if (room.turn === "dayEnd") {
          //dayEnd
          room.skippedVotes = 0; //reset skipped decisions made by players
          const mostVoted = getMaxVotes(getPlayerInRoom(roomId)); //get most voted player by everyone
          const hunter = getHunter(roomId); //get the hunter
          io.to(roomId).emit("hang", mostVoted); //inform everyone about the most voted player

          if (mostVoted) {
            //if no equal votes
            hangPlayer(roomId, mostVoted); //hand that player
          }

          if (checkWin(roomId)) {
            //check to see if one side wins
            setTimeout(() => {
              clearTimeout(timeout); //clear the current turn
              room.turn = "gameEnd"; //switch to game end
              io.to(roomId).emit("changeTurn", {
                roomTurn: "gameEnd",
                skipped: false,
              });
              io.to(roomId).emit("win", checkWin(roomId)); //declare the winner
            }, 3000);
          } else if (hunter && hunter.name === mostVoted) {
            //if the hunter was hanged
            setTimeout(() => {
              clearTimeout(timeout); //clear current turn
              room.turn = "hunterNight"; //switch to hunter turn
              io.to(roomId).emit("changeTurn", {
                roomTurn: "hunterNight",
                skipped: false,
              });
            }, 3000);
          } else {
            clearVotes(roomId); //if nothing happens, proceed to the next turn
            io.to(roomId).emit("roomPlayer", getRoomById(roomId)); //update all players status
          }
        } else if (room.turn === "dayStart") {
          //dayStart
          clearVotes(roomId);
          io.to(roomId).emit("roomPlayer", getRoomById(roomId));
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
          io.to(roomId).emit("roomPlayer", getRoomById(roomId));

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
          } else {
            room.savedPlayer = "";
            room.poisonedPlayer = "";
            io.to(roomId).emit("roomPlayer", getRoomById(roomId));
          }
        } else if (room.turn === "villager" || room.turn === "nightStart") {
          // io.to(roomId).emit("roomPlayer", getRoomById(roomId));
        } else if (room.turn === "guard") {
          const protectedPlayer = room.protectedPlayer;
          io.to(roomId).emit("lastProtected", protectedPlayer);
          room.protectedPlayer = "";
        } else if (room.turn === "witch") {
          const killedPlayer = getMaxVotes(getPlayerInRoom(roomId));
          io.to(roomId).emit("killedByWolf", killedPlayer);
        } else if (room.turn === "shootDay" || room.turn === "shootNight") {
          io.to(roomId).emit("roomPlayer", getRoomById(roomId));
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
        io.to(roomId).emit("changeTurn", {
          roomTurn: room.turn,
          skipped: true,
        });
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
        io.to(roomId).emit("roomPlayer", getRoomById(roomId));
      } else if (type === "kill") {
        socket.emit("disable", ["kill"]);
        targettedPlayer.votes.push(from);
        room.skippedVotes += 1;
        if (room.skippedVotes === getAllWolves(roomId)) {
          io.to(roomId).emit("changeTurn", {
            roomTurn: room.turn,
            skipped: true,
          });
        }
        io.to(roomId).emit("roomPlayer", getRoomById(roomId));
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
    });
  });
};

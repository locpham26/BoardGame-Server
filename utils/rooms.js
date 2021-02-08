const _ = require("lodash");

const rooms = [];

const addRoom = (id) => {
  //create a room
  const room = {
    id,
    isStarted: false,
    turn: "",
    playerList: [],
    posList: generatePosList(),
  };
  rooms.push(room);
  return room;
};

const generatePosList = () => {
  //generate position list for players
  let posList = [];
  for (let i = 0; i < 12; i++) {
    posList.push({ pos: i, taken: false });
  }
  return posList;
};

const assignPos = (roomId) => {
  //assign position to players in room
  const room = getRoomById(roomId);
  if (room) {
    let assigned = room.posList.find((position) => !position.taken);
    assigned.taken = true;
    return assigned.pos;
  }
};

const removeRoom = (roomId) => {
  //remove rooms
  if (rooms.length > 0) {
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    if (roomIndex) rooms.splice(roomIndex, 1);
  }
};

const getAllRooms = () => {
  //get all rooms
  return rooms.filter((room) => !room.isStarted && room.playerList.length > 0);
};

const getRoomById = (roomId) => {
  //get room by id
  return rooms.find((room) => room.id === roomId);
};

const addPlayer = (socketId, userName, roomId) => {
  //add player to room
  const room = getRoomById(roomId);
  if (room) {
    const player = {
      id: socketId,
      name: userName,
      role: "",
      pos: assignPos(roomId),
      votes: [],
      isAlive: true,
    };
    room.playerList.push(player);
  }
};

const removePlayer = (userName, roomId) => {
  //remove player from room
  const room = getRoomById(roomId);
  if (room) {
    const index = room.playerList.findIndex(
      (player) => player.name === userName
    );
    if (index !== -1) {
      const playerPos = room.posList.find(
        (position) => position.pos === room.playerList[index].pos
      );
      if (playerPos) {
        playerPos.taken = false;
      }
      room.playerList.splice(index, 1);
    }
  }
};

const getPlayerInRoom = (roomId) => {
  //get all players in room
  const room = getRoomById(roomId);
  if (room) return room.playerList;
};

const getAllWolves = (roomId) => {
  //get all wolves players
  const room = getRoomById(roomId);
  if (room) {
    return room.playerList.filter(
      (player) => player.isAlive && player.role === "wolf"
    ).length;
  }
};

const getAllHuman = (roomId) => {
  //get all non-wolf players
  const room = getRoomById(roomId);
  if (room) {
    return room.playerList.filter(
      (player) => player.isAlive && player.role !== "wolf"
    ).length;
  }
};

const checkWin = (roomId) => {
  //check win
  if (getAllWolves(roomId) >= getAllHuman(roomId)) {
    return "wolf";
  } else if (getAllWolves(roomId) === 0) {
    return "human";
  } else {
    return null;
  }
};

const startGame = (roomId) => {
  //start game
  const room = getRoomById(roomId);
  if (room) {
    room.isStarted = true;
    room.protectedPlayer = "";
    room.savedPlayer = "";
    room.poisonedPlayer = "";
    room.skippedVotes = 0;
    assignRole(room.playerList);
  }
};

const endGame = (roomId) => {
  //end game
  const room = getRoomById(roomId);
  if (room) {
    room.isStarted = false;
    room.turn = "";
    room.protectedPlayer = "";
    room.savedPlayer = "";
    room.poisonedPlayer = "";
    room.playerList.forEach((player) => {
      player.isAlive = true;
      player.role = "";
    });
  }
};

const getPlayer = (roomId, playerName) => {
  //get player by name
  const room = getRoomById(roomId);
  if (room) {
    const player = room.playerList.find((player) => player.name === playerName);
    return player;
  }
};

const hasVoted = (playerList, playerName) => {
  //check if this player has voted
  if (playerList) {
    const player = playerList.find((player) =>
      player.votes.includes(playerName)
    );
    if (player) {
      const voteIndex = player.votes.findIndex((vote) => vote === playerName);
      player.votes.splice(voteIndex, 1);
    }
  }
};

const getMaxVotes = (playerList) => {
  //get player with the most votes
  let hasEqualVote = false;
  let mostVoted = playerList[0].name;
  let maxVote = playerList[0].votes.length;
  for (let i = 0; i < playerList.length - 1; i++) {
    if (playerList[i + 1].votes.length > maxVote) {
      mostVoted = playerList[i + 1].name;
      maxVote = playerList[i + 1].votes.length;
      hasEqualVote = false;
    } else if (playerList[i + 1].votes.length === maxVote) {
      mostVoted = playerList[i + 1].name;
      maxVote = playerList[i + 1].votes.length;
      hasEqualVote = true;
    }
  }
  if (hasEqualVote) {
    return "";
  } else {
    return mostVoted;
  }
};

const killPlayer = (roomId, playerName) => {
  //kill player
  const room = getRoomById(roomId);
  if (room) {
    const killed = getPlayer(roomId, playerName);
    if (
      killed.name !== room.protectedPlayer &&
      killed.name !== room.savedPlayer
    ) {
      killed.isAlive = false;
      return killed.name;
    } else {
      return "";
    }
  }
};

const hangPlayer = (roomId, playerName) => {
  //hand player
  const hanged = getPlayer(roomId, playerName);
  hanged.isAlive = false;
};

const clearVotes = (roomId) => {
  //clear votes
  const room = getRoomById(roomId);
  if (room) {
    room.playerList.forEach((player) => {
      player.votes = [];
    });
  }
};

const protectPlayer = (roomId, playerName) => {
  //protect player
  const room = getRoomById(roomId);
  if (room) {
    if (playerName !== room.protectedPlayer) {
      room.protectedPlayer = playerName;
    }
  }
};

const savePlayer = (roomId, playerName) => {
  //save player
  const room = getRoomById(roomId);
  if (room) {
    if (playerName !== room.savedPlayer) {
      room.savedPlayer = playerName;
    }
  }
};

const poisonPlayer = (roomId, playerName) => {
  //poison player
  const room = getRoomById(roomId);
  if (room) {
    room.poisonedPlayer = playerName;
  }
};

const getHunter = (roomId) => {
  //get the hunter
  const room = getRoomById(roomId);
  if (room) {
    const hunter = room.playerList.find((player) => player.role === "hunter");
    return hunter;
  }
};

//assign roles to players based on playerNum
const assignRole = (playerList) => {
  let roles = [];
  if (playerList.length === 6) {
    roles = ["wolf", "hunter", "witch", "villager", "seer", "guard"];
  } else if (playerList.length === 4) {
    roles = ["wolf", "witch", "hunter", "guard"];
  } else if (playerList.length === 7) {
    roles = [
      "wolf",
      "wolf",
      "villager",
      "villager",
      "villager",
      "seer",
      "guard",
    ];
  } else if (playerList.length === 8) {
    roles = [
      "wolf",
      "wolf",
      "villager",
      "villager",
      "villager",
      "seer",
      "guard",
      "witch",
    ];
  } else if (playerList.length === 3) {
    roles = ["wolf", "hunter", "witch"];
  }
  roles = _.shuffle(roles);
  let i = 0;
  while (i < playerList.length) {
    playerList[i].role = roles[i];
    i++;
  }
};

//handle turn switched
const switchTurn = (turn) => {
  let newTurn;
  let time;
  switch (turn) {
    case "gameStart":
      newTurn = "nightStart";
      time = 5000;
      break;
    case "nightStart":
      newTurn = "guard";
      time = 3000;
      break;
    case "villager":
      newTurn = "dayEnd";
      time = 10000;
      break;
    case "dayEnd":
      newTurn = "nightStart";
      time = 6000;
      break;
    case "guard":
      newTurn = "wolf";
      time = 6000;
      break;
    case "wolf":
      newTurn = "witch";
      time = 6000;
      break;
    case "witch":
      newTurn = "seer";
      time = 6000;
      break;
    case "seer":
      newTurn = "dayStart";
      time = 6000;
      break;
    case "dayStart":
      newTurn = "villager";
      time = 6000;
      break;
    case "hunterDay":
      newTurn = "shootDay";
      time = 6000;
      break;
    case "shootDay":
      newTurn = "villager";
      time = 3000;
      break;
    case "hunterNight":
      newTurn = "shootNight";
      time = 6000;
      break;
    case "shootNight":
      newTurn = "nightStart";
      time = 3000;
      break;
    case "gameEnd":
      newTurn = "end";
      time = 3000;
      break;
    default:
      newTurn = "gameStart";
      time = 0;
      break;
  }
  return { newTurn: newTurn, time: time };
};

module.exports = {
  addRoom,
  removeRoom,
  getRoomById,
  getAllRooms,
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
  protectPlayer,
  savePlayer,
  poisonPlayer,
  getHunter,
  getAllWolves,
  switchTurn,
  checkWin,
  endGame,
};

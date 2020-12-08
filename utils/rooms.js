const _ = require("lodash");

const rooms = [];

const addRoom = (id) => {
  const room = { id, isStarted: false, turn: "", playerList: [] };
  rooms.push(room);
  return room;
};

const removeRoom = (roomId) => {
  if (rooms.length > 0) {
    const roomIndex = rooms.findIndex((room) => room.id === roomId);
    rooms.splice(roomIndex, 1);
  }
};

const getAllRooms = () => {
  return rooms.filter((room) => !room.isStarted);
};

const getRoomById = (roomId) => {
  return rooms.find((room) => room.id === roomId);
};

const addPlayer = (userName, roomId) => {
  const room = getRoomById(roomId);
  const player = {
    name: userName,
    role: "",
    votes: [],
    isAlive: true,
  };
  room.playerList.push(player);
};

const removePlayer = (userName, roomId) => {
  const room = getRoomById(roomId);
  const index = room.playerList.findIndex((player) => player.name === userName);
  if (index !== -1) {
    room.playerList.splice(index, 1);
  }
};

const getPlayerInRoom = (roomId) => {
  const room = getRoomById(roomId);
  return room.playerList;
};

const startGame = (roomId) => {
  const room = getRoomById(roomId);
  room.isStarted = true;
  room.protectedPlayer = "";
  room.savedPlayer = "";
  room.poisonedPlayer = "";
  assignRole(room.playerList);
};

const getPlayer = (roomId, playerName) => {
  const room = getRoomById(roomId);
  const player = room.playerList.find((player) => player.name === playerName);
  return player;
};

const hasVoted = (playerList, playerName) => {
  const player = playerList.find((player) => player.votes.includes(playerName));
  if (player) {
    const voteIndex = player.votes.findIndex((vote) => vote === playerName);
    player.votes.splice(voteIndex, 1);
  }
};

const getMaxVotes = (playerList) => {
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
  const room = getRoomById(roomId);
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
};

const hangPlayer = (roomId, playerName) => {
  const hanged = getPlayer(roomId, playerName);
  hanged.isAlive = false;
};

const clearVotes = (roomId) => {
  const room = getRoomById(roomId);
  room.playerList.forEach((player) => {
    player.votes = [];
  });
};

const protectPlayer = (roomId, playerName) => {
  const room = getRoomById(roomId);
  if (playerName !== room.protectedPlayer) {
    room.protectedPlayer = playerName;
  }
};

const savePlayer = (roomId, playerName) => {
  const room = getRoomById(roomId);
  if (playerName !== room.savedPlayer) {
    room.savedPlayer = playerName;
  }
};

const poisonPlayer = (roomId, playerName) => {
  const room = getRoomById(roomId);
  room.poisonedPlayer = playerName;
};

const getHunter = (roomId) => {
  const room = getRoomById(roomId);
  const hunter = room.playerList.find((player) => player.role === "hunter");
  return hunter;
};

const assignRole = (playerList) => {
  let roles = [];
  if (playerList.length === 6) {
    roles = ["wolf", "wolf", "witch", "villager", "seer", "guard"];
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
      newTurn = "dayEnd";
      time = 6000;
      break;
    case "hunter":
      newTurn = "hunterShoot";
      time = 6000;
      break;
    case "hunterShoot":
      newTurn = "villager";
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
  assignRole,
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
  switchTurn,
};

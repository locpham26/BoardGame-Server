const _ = require("lodash");

const rooms = [];

const addRoom = (id) => {
  const room = { id, isStarted: false, turn: "", playerList: [] };
  rooms.push(room);
  return room;
};

const getAllRooms = () => {
  return rooms.filter((room) => room.playerList.length > 0);
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
    isProtected: false,
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
  let mostVoted = playerList[0];
  let maxVote = playerList[0].votes.length;
  for (let i = 0; i < playerList.length - 1; i++) {
    if (playerList[i + 1].votes.length > maxVote) {
      mostVoted = playerList[i + 1];
      maxVote = playerList[i + 1].votes.length;
      hasEqualVote = false;
    } else if (playerList[i + 1].votes.length === maxVote) {
      mostVoted = playerList[i + 1];
      maxVote = playerList[i + 1].votes.length;
      hasEqualVote = true;
    }
  }
  if (hasEqualVote) {
    return null;
  } else if (mostVoted.isProtected) {
    return null;
  } else {
    return mostVoted;
  }
};

const killPlayer = (roomId, playerName) => {
  const killed = getPlayer(roomId, playerName);
  killed.isAlive = false;
};

const clearVotes = (roomId) => {
  const room = getRoomById(roomId);
  room.playerList.forEach((player) => {
    player.votes = [];
  });
};

const hasProtected = (playerList) => {
  const player = playerList.find((player) => player.isProtected === true);
  if (player) {
    player.isProtected = false;
  }
};

const clearProtection = (roomId) => {
  const room = getRoomById(roomId);
  room.playerList.forEach((player) => {
    player.isProtected = false;
  });
};

const assignRole = (playerList) => {
  let roles = [];
  if (playerList.length === 6) {
    roles = ["wolf", "wolf", "villager", "villager", "seer", "guard"];
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
  }
  roles = _.shuffle(roles);
  let i = 0;
  while (i < playerList.length) {
    playerList[i].role = roles[i];
    i++;
  }
};

module.exports = {
  addRoom,
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
  clearVotes,
  clearProtection,
};

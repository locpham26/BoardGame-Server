let onlinePlayers = [];

const activatePlayer = ({ id, name }) => {
  onlinePlayers.push({ id, name });
};

const getOnlinePlayerByName = (playerName) => {
  const player = onlinePlayers.find((player) => player.name === playerName);
  if (player) {
    return player;
  }
};

const getOnlinePlayerById = (playerId) => {
  const player = onlinePlayers.find((player) => player.id === playerId);
  if (player) {
    return player;
  }
};

const removeFromOnlineList = (playerId) => {
  const playerIndex = onlinePlayers.findIndex(
    (player) => player.id === playerId
  );
  if (playerIndex > -1) {
    onlinePlayers.splice(playerIndex, 1);
  }
};

module.exports = {
  activatePlayer,
  getOnlinePlayerByName,
  getOnlinePlayerById,
  removeFromOnlineList,
};

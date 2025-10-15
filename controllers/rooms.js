const { v4: uuidv4 } = require('uuid');
const gameLogic = require("./logic");
const logger = require("../utils/logger");
const rooms = {};

function createRoom(roomName, isPublic, settings){
  const roomId = uuidv4().substring(0, 6);
  console.log(settings);
  rooms[roomId] = {
    players: [],
    gameState: {
      gameStarted: false,
      numReady: 0,
      apples: [],
      gridMap: new gameLogic.CellGrid(20, 20)
    },
    settings,
    public: isPublic,
    name: roomName,
    loopId: null
  };

  rooms[roomId].gameState.apples = gameLogic.initApples(rooms[roomId].gameState);

  return roomId;
}


function roomExists(id){
  return !!rooms[id]; 
}

function handleJoin(io, socket, roomId){
  if (!roomExists(roomId)) {
    socket.emit('error', `room ${roomId} not found`);
    return;
  }

  if(rooms[roomId].players.length >= 2){
    socket.emit('error', 'Room is full');
    return;
  }

  if(rooms[roomId].gameState.gameStarted){
    socket.emit('error', 'Game is in progress');
    return;
  }
  
  const gameState = rooms[roomId].gameState;
  socket.join(roomId);
  const playerId = socket.id;
  logger.info("User joined room", {playerId, roomId});
  systemMessage(io, roomId, `${playerId} has joined the room`);
  const pos = gameState.gridMap.getRandomCell();
  const player = {
    id: playerId,
    direction: 0,
    alive: true,
    ready: false,
    segments: [{
      x: pos.x,
      y: pos.y,
    }],
    inputs: []
  };
  
  rooms[roomId].players.push(player);
  gameState.gridMap.removeCell(pos);

  
  io.to(roomId).emit('playerJoined', {
    players: rooms[roomId].players,
    gameState: rooms[roomId].gameState
  });

  if(!gameState.gameStarted) io.to(roomId).emit('lobby', gameState);
  const handleInput = (direction) => {
    gameLogic.changeDirection(player, direction);
  }

  const handleReady = (isReady) => {
    if(isReady == player.ready) return; 


    player.ready = isReady;
    if(isReady){
      rooms[roomId].gameState.numReady +=1;
    }else{
      rooms[roomId].gameState.numReady -=1;
    }

    io.to(roomId).emit("ui", rooms[roomId].gameState )
    if(rooms[roomId].gameState.numReady >= 2){
      startGame(io, roomId);
    }
  }

  const handleMessage = (message) => {
    if (message.length > 100){
      return;
    }
    io.to(roomId).emit("recieved", {
      player,
      content: message
    })
  }


  const handleDisconnect = () => {
    socket.removeListener('input', handleInput);
    socket.removeListener('ready', handleReady);
    socket.removeListener('message', handleMessage);
    socket.removeListener('disconnect', handleDisconnect);
    handlePlayerDisconnect(io, roomId, playerId);
  }
  
  socket.on('input', handleInput);
  socket.on('ready', handleReady);
  socket.on("message", handleMessage);
  socket.on('disconnect', handleDisconnect);  
}

function handlePlayerDisconnect(io, roomId, playerId){
  const room = rooms[roomId];
  if(!roomExists(roomId)){
    return false;
  }
  
  const player = room.players.find((player) => player.id === playerId);
  
  if(player && player.ready){
    room.gameState.numReady -= 1;
  }

  room.players = room.players.filter((player) => player.id !== playerId);
  
  if(room.players.length === 0){
    const roomName = rooms[roomId].name;
    
    if(rooms[roomId].loopId) {
      clearInterval(rooms[roomId].loopId);
    }
    
    io.in(roomId).socketsLeave(roomId);
    
    delete rooms[roomId];
    logger.info("Room destroyed", {roomId, roomName: roomName});
    return;
  }

  logger.info("User left room", {playerId, roomId})
  sysMsg(io, roomId, `${playerId} has left`);
}

function startGame(io, roomId) {
  const room = rooms[roomId];
  const { players, gameState } = room;

  gameState.gameStarted = true;
  gameLogic.resetMap(gameState);

  players.forEach((player)=>{
    gameLogic.resetPlayer(player, gameState);
  })

  io.to(roomId).emit("start", {
    players: rooms[roomId].players,
    gameState: rooms[roomId].gameState
  });

  const intervalId = setInterval(()=>{
    updateGame(io, roomId);
  }, 1000/7);

  rooms[roomId].loopId = intervalId;
}

function updateGame(io, roomId){
  const room = rooms[roomId];
  if(!room){
    return;
  }

  const { players, gameState, settings } = room;

  let gameOver = true;
  players.forEach((player)=>{ 
    if(player.alive){
      gameOver = false;
      gameLogic.move(player, gameState);
      gameLogic.checkCollision(player, players, settings );
      gameLogic.eat(player, gameState);
    }
  });

  if(gameOver){
    endGame(io, roomId);
    return;
  }

  io.to(roomId).emit("updateGame", {
    players: rooms[roomId].players,
    gameState: rooms[roomId].gameState
  });
}

function endGame(io, roomId) {
  rooms[roomId].gameState.gameStarted = false;
  rooms[roomId].gameState.numReady = 0;
  if(rooms[roomId].loopId) {
    clearInterval(rooms[roomId].loopId);
    rooms[roomId].loopId = null
  }

  io.to(roomId).emit("gameOver", rooms[roomId].gameState);
}

function getPublicRooms(){
  let roomIDs = Object.keys(rooms);
  const publicRooms = []
  let maxRooms = 15;
  for(let i = 0; i < roomIDs.length && i < maxRooms; i++){
    const roomId = roomIDs[i];
    if(rooms[roomId].public && rooms[roomId].players.length < 2){
      publicRooms.push({name: rooms[roomId].name, id: roomId});
    }
  }
  roomIDs = null;
  return publicRooms;
}

function systemMessage(io, roomId, message){
  if(!rooms[roomId]) return;
  io.to(roomId).emit("sysMessage", message);
}

module.exports = {
  rooms,
  createRoom,
  roomExists,
  handleJoin,
  getPublicRooms,
}
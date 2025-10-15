const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const roomManager = require('./controllers/rooms.js');
const logger = require('./utils/logger.js');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.set('trust proxy', 3);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const createRoomLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 5,
  message: {
    error: 'Too many rooms created from this device, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const viewRoomsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 30,
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', (req, res) => {
  logger.info("User visited site", {requestIp: req.ip})
  return res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

app.post('/rooms', 
  [
    body('name')
      .isString()
      .withMessage('Name must be a string')
      .isLength({ min: 1, max: 20 })
      .withMessage('Name must be between 1 and 20 characters')
      .trim(),
    body('public')
      .isBoolean()
      .withMessage('Public must be a boolean value')
      .toBoolean()
  ],
  createRoomLimiter,
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    try {
      const { name, public, settings } = req.body;

      if (!name || name.length > 20 || !/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid room name' });
      }
      const roomId = roomManager.createRoom(name, public, settings);
      logger.info("Room created", {requestIp: req.ip, roomId, roomName: name, public })
      if (req.headers['content-type'] === 'application/json') {
        return res.status(201).json({
          success: true,
          roomId: roomId,
          redirectUrl: `/rooms/${roomId}`
        });
      }
    }catch(err){
      return res.status(500).json({
        error: "Internal server error"
      })
    }
  }
);

app.get('/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  
  if (!roomManager.roomExists(roomId)) {
    return res.status(404).sendFile(path.join(__dirname, 'static', '404.html'));
  }
  return res.sendFile(path.join(__dirname, 'static', 'game.html'));
});

app.get('/rooms', viewRoomsLimiter, (req, res) => {
  const rooms = roomManager.getPublicRooms();
  res.json(rooms);
});

app.get('/api/ping', (req, res) => {
  logger.info("Server pinged");
  return res.status(200).json("Up");
});


// app.get('/favicon.png', (req, res) => {
//   res.sendFile(path.join(__dirname, 'static', 'favicon.png'));
// });

app.use((req, res) => {
  return res.status(404).sendFile(path.join(__dirname, 'static', '404.html'));
});

io.on('connection', (socket) => {
  
  socket.on('joinRoom', (roomId) => {
    roomManager.handleJoin(io, socket, roomId);
  });
});


server.listen(PORT, ()=>{
  console.log(`Server started at http://localhost:${PORT}`)
})


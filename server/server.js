const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const executionService = require('./services/executionService');
const User = require('./models/User');
const problems = require('./problems.json');
require('dotenv').config();

// Connect to MongoDB
connectDB();

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ["GET", "POST"]
}));
app.use(express.json());

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"]
  }
});

const rooms = {};
const ROUND_DURATION_MS = 5 * 60 * 1000;

function getRandomProblem(usedIds) {
  const available = problems.filter(p => !usedIds.includes(p.id));
  if (available.length === 0) return problems[Math.floor(Math.random() * problems.length)];
  return available[Math.floor(Math.random() * available.length)];
}

const sendLeaderboard = async () => {
  try {
    const topUsers = await User.find().sort({ xp: -1 }).limit(10).select('username xp');
    io.emit('leaderboardData', topUsers);
  } catch(err) {
    console.error("Error fetching leaderboard", err);
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  sendLeaderboard();

  // Basic JWT Auth for socket? Or just rely on HTTP for login, but for now we accept usernames
  // Sockets are used for Create/Join room. We trust the HTTP auth generated username.
  
  // Replace old socket-based auth with backward compatibility OR just remove it since we migrate frontend
  // The frontend needs an update to send HTTP requests.
  
  socket.on('createRoom', ({ username }) => {
    // Sanitize input
    if(!username || typeof username !== 'string') return;
    username = username.substring(0, 30).trim();

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const problem = getRandomProblem([]);
    
    rooms[roomId] = {
      id: roomId,
      player1: { id: socket.id, username },
      player2: null,
      problem,
      round: 1,
      scores: { [username]: 0 },
      testProgress: { [username]: '0/0' },
      usedProblems: [problem.id],
      status: 'waiting',
      roundHistory: []
    };

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerNum: 1 });
    io.to(roomId).emit('roomState', rooms[roomId]);
  });

  socket.on('joinRoom', ({ username, roomId }) => {
    if(!username || typeof username !== 'string' || !roomId || typeof roomId !== 'string') return;
    username = username.substring(0, 30).trim();
    roomId = roomId.substring(0, 10).toUpperCase();

    const room = rooms[roomId];
    if (room && !room.player2) {
      room.player2 = { id: socket.id, username };
      room.scores[username] = 0;
      room.testProgress[username] = '0/0';
      room.status = 'playing';
      room.endTime = Date.now() + ROUND_DURATION_MS;

      socket.join(roomId);
      socket.emit('roomJoined', { roomId, playerNum: 2 });
      socket.to(roomId).emit('opponentJoined', { username });
      io.to(roomId).emit('roomState', room);
    } else {
      socket.emit('error', 'Room not found or full');
    }
  });

  socket.on('codeChange', ({ roomId, code, playerNum }) => {
    // Hidden from opponent, do nothing but keep stream alive if needed
  });

  socket.on('requestHint', ({ roomId, username }) => {
    const room = rooms[roomId];
    if (room) {
      socket.emit('hintDelivered', { hint: room.problem.hint });
      io.to(roomId).emit('playerFrozen', { target: username, duration: 15000 });
    }
  });

  socket.on('submitCode', async ({ roomId, code, playerNum, language }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;

    const username = playerNum === 1 ? room.player1.username : room.player2.username;
    let result = { passed: 0, total: 0, logs: [] };

    try {
      if (language === 'javascript') {
        result = await executionService.executeJavaScript(code, room.problem.testCases);
      } else if (language === 'python') {
        result = await executionService.executePython(code, room.problem.testCases);
      } else if (language === 'cpp') {
        result = await executionService.executeCpp(code, room.problem.testCases);
      } else if (language === 'java') {
        result = await executionService.executeJava(code, room.problem.testCases);
      }

      room.testProgress[username] = `${result.passed}/${result.total}`;
      io.to(roomId).emit('testProgressUpdate', room.testProgress);

      const outputStr = result.logs.join('\n');
      socket.emit('battleResult', { output: outputStr, passed: `${result.passed}/${result.total}` });

      if (result.passed === result.total && result.total > 0) {
        room.status = 'ended';
        const winnerName = username;
        const lineCount = code.split('\\n').filter(l => l.trim().length > 0).length;
        const isCleanCoder = lineCount <= room.problem.optimalLines;

        // DB Updates
        const winnerUser = await User.findOne({ username: winnerName });
        if (winnerUser) {
          winnerUser.xp += 10 + (isCleanCoder ? 5 : 0);
          winnerUser.wins += 1;
          winnerUser.matchesPlayed += 1;
          winnerUser.matchHistory.push({
            problem: room.problem.title,
            result: 'Win',
            cleanCoder: isCleanCoder,
            opponent: playerNum === 1 ? room.player2?.username : room.player1?.username
          });
          await winnerUser.save();
        }

        const loserName = playerNum === 1 ? room.player2?.username : room.player1?.username;
        const loserUser = await User.findOne({ username: loserName });
        if (loserUser) {
          loserUser.losses += 1;
          loserUser.matchesPlayed += 1;
          loserUser.matchHistory.push({
            problem: room.problem.title,
            result: 'Loss',
            cleanCoder: false,
            opponent: winnerName
          });
          await loserUser.save();
        }

        sendLeaderboard();

        room.scores[winnerName] = (room.scores[winnerName] || 0) + 1;
        room.roundHistory.push({ round: room.round, winner: winnerName, problem: room.problem.title, cleanCoder: isCleanCoder });
        
        io.to(roomId).emit('roundWon', { 
          winner: winnerName, 
          round: room.round, 
          scores: room.scores,
          cleanCoder: isCleanCoder
        });

        setTimeout(() => {
          room.round++;
          room.problem = getRandomProblem(room.usedProblems);
          room.usedProblems.push(room.problem.id);
          room.status = 'playing';
          room.testProgress = { [room.player1.username]: '0/0', [room.player2.username]: '0/0' };
          room.endTime = Date.now() + ROUND_DURATION_MS;
          io.to(roomId).emit('newRound', room);
        }, 5000);
      }
    } catch (e) {
      socket.emit('battleResult', { output: `Error: ${e.message}`, passed: '0/0' });
    }
  });

  socket.on('timeUp', async ({ roomId }) => {
    // Simplified timeUp, mark draw logic
  });

  socket.on('chatMessage', ({ roomId, message, username }) => {
    if(!message || message.length > 200) return; // Sanitize logic
    io.to(roomId).emit('chatMessage', { username, message });
  });

  socket.on('leaveBattle', ({ roomId }) => {
    // Notify end
    io.to(roomId).emit('opponentLeft');
    delete rooms[roomId];
  });

  socket.on('disconnect', () => {
    // Clean up rooms where client was player1 or 2
    for (const rid in rooms) {
      if (rooms[rid].player1?.id === socket.id || rooms[rid].player2?.id === socket.id) {
        io.to(rid).emit('opponentLeft');
        delete rooms[rid];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const vm = require('vm');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const problems = require('./problems.json');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};
const ROUND_DURATION_MS = 5 * 60 * 1000; // 5 minutes per round

function getRandomProblem(usedIds) {
  const available = problems.filter(p => !usedIds.includes(p.id));
  if (available.length === 0) return problems[Math.floor(Math.random() * problems.length)];
  return available[Math.floor(Math.random() * available.length)];
}

function executeJavaScript(code, testCases) {
  const logs = [];
  let passed = 0;

  const sandbox = {
    console: { log: (...args) => logs.push(args.join(' ')) }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { timeout: 5000 });

  for (const test of testCases) {
    const result = vm.runInContext(`solve(${test.input})`, sandbox, { timeout: 3000 });
    const expected = JSON.parse(test.expected);
    if (JSON.stringify(result) === JSON.stringify(expected)) {
      passed++;
    } else {
      logs.push(`Test failed: solve(${test.input}) returned ${JSON.stringify(result)}, expected ${test.expected}`);
    }
  }

  return { logs, passed, total: testCases.length };
}

function executePython(code, testCases) {
  let wrapper = code + '\n\nimport json\npassed = 0\nlogs = []\n';
  for (const test of testCases) {
    let expected = test.expected;
    if (expected === 'true') expected = 'True';
    else if (expected === 'false') expected = 'False';
    wrapper += `
try:
    result = solve(${test.input})
    if str(result) == "${test.expected}" or result == ${expected}:
        passed += 1
    else:
        logs.append(f"Test failed: solve(${test.input}) returned {result}, expected ${test.expected}")
except Exception as e:
    logs.append(f"Error: {e}")
`;
  }
  wrapper += `
for l in logs:
    print(l)
print(f"PASSED:{passed}/${testCases.length}")
`;

  try {
    const output = execSync(`python -c "${wrapper.replace(/"/g, '\\"')}"`, {
      timeout: 10000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const match = output.match(/PASSED:(\d+)\/(\d+)/);
    const passed = match ? parseInt(match[1]) : 0;
    const cleanOutput = output.split('PASSED:')[0].trim();
    return { logs: cleanOutput ? [cleanOutput] : [], passed, total: testCases.length };
  } catch (err) {
    return { logs: [err.stderr || err.message], passed: 0, total: testCases.length };
  }
}

function executeCpp(code, testCases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-'));
  const srcFile = path.join(tmpDir, 'solution.cpp');
  const exeFile = path.join(tmpDir, 'solution.exe');

  // Build a C++ wrapper with test cases
  let wrapper = `#include <iostream>
#include <vector>
#include <string>
#include <sstream>
using namespace std;

${code}

int main() {
    int passed = 0;
`;
  for (const test of testCases) {
    // Handle different input types
    if (test.expected === 'true' || test.expected === 'false') {
      wrapper += `    if (solve(${test.input}) == ${test.expected}) passed++;
`;
    } else if (test.expected.startsWith('"')) {
      // String comparison
      wrapper += `    if (solve(${test.input}) == ${test.expected}) passed++;
`;
    } else {
      wrapper += `    if (solve(${test.input}) == ${test.expected}) passed++;
`;
    }
  }
  wrapper += `    cout << "PASSED:" << passed << "/${testCases.length}" << endl;
    return 0;
}
`;

  try {
    fs.writeFileSync(srcFile, wrapper);
    execSync(`g++ -o "${exeFile}" "${srcFile}" -std=c++17`, {
      timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });
    const output = execSync(`"${exeFile}"`, {
      timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });

    const match = output.match(/PASSED:(\d+)\/(\d+)/);
    const passed = match ? parseInt(match[1]) : 0;
    const cleanOutput = output.split('PASSED:')[0].trim();
    return { logs: cleanOutput ? [cleanOutput] : [], passed, total: testCases.length };
  } catch (err) {
    return { logs: [err.stderr || err.message], passed: 0, total: testCases.length };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
}

function executeJava(code, testCases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-'));
  const srcFile = path.join(tmpDir, 'Solution.java');

  // Build a Java wrapper
  let testBlock = '';
  for (const test of testCases) {
    if (test.expected === 'true' || test.expected === 'false') {
      testBlock += `        if (solve(${test.input}) == ${test.expected}) passed++;
`;
    } else if (test.expected.startsWith('"')) {
      testBlock += `        if (solve(${test.input}).equals(${test.expected})) passed++;
`;
    } else {
      testBlock += `        if (solve(${test.input}) == ${test.expected}) passed++;
`;
    }
  }

  const wrapper = `import java.util.*;

public class Solution {
${code}

    public static void main(String[] args) {
        int passed = 0;
${testBlock}
        System.out.println("PASSED:" + passed + "/${testCases.length}");
    }
}
`;

  try {
    fs.writeFileSync(srcFile, wrapper);
    execSync(`javac "${srcFile}"`, {
      timeout: 15000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });
    const output = execSync(`java -cp "${tmpDir}" Solution`, {
      timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    });

    const match = output.match(/PASSED:(\d+)\/(\d+)/);
    const passed = match ? parseInt(match[1]) : 0;
    const cleanOutput = output.split('PASSED:')[0].trim();
    return { logs: cleanOutput ? [cleanOutput] : [], passed, total: testCases.length };
  } catch (err) {
    return { logs: [err.stderr || err.message], passed: 0, total: testCases.length };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  }
}

function getSanitizedState(room) {
  return {
    id: room.id,
    problem: room.problem,
    round: room.round,
    scores: room.scores,
    roundHistory: room.roundHistory,
    endTime: room.endTime,
    player1: { username: room.player1.username },
    player2: room.player2 ? { username: room.player2.username } : null
  };
}

function advanceRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.round += 1;
  room.usedProblemIds.push(room.problem.id);
  room.problem = getRandomProblem(room.usedProblemIds);
  room.player1.code = '';
  if (room.player2) room.player2.code = '';
  room.endTime = Date.now() + ROUND_DURATION_MS;

  io.to(roomId).emit('newRound', getSanitizedState(room));
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ username }) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const problem = getRandomProblem([]);
    rooms[roomId] = {
      id: roomId,
      problem,
      round: 1,
      scores: {},
      roundHistory: [],
      usedProblemIds: [problem.id],
      player1: { id: socket.id, username, code: '' },
      player2: null,
      endTime: null
    };
    rooms[roomId].scores[username] = 0;
    
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerNum: 1 });
    io.to(roomId).emit('roomState', getSanitizedState(rooms[roomId]));
    console.log(`Room ${roomId} created by ${username}`);
  });

  socket.on('joinRoom', ({ username, roomId }) => {
    const room = rooms[roomId];
    if (room && !room.player2) {
      room.player2 = { id: socket.id, username, code: '' };
      room.scores[username] = 0;
      room.endTime = Date.now() + ROUND_DURATION_MS;

      socket.join(roomId);
      socket.emit('roomJoined', { roomId, playerNum: 2 });
      
      socket.to(roomId).emit('opponentJoined', { username });
      io.to(roomId).emit('roomState', getSanitizedState(room));
      console.log(`${username} joined room ${roomId}`);
    } else {
      socket.emit('error', 'Room full or not found');
    }
  });

  socket.on('requestRoomState', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      socket.emit('roomState', getSanitizedState(room));
    }
  });

  socket.on('codeChange', ({ roomId, code, playerNum }) => {
    const room = rooms[roomId];
    if (room) {
      if (playerNum === 1) room.player1.code = code;
      else if (playerNum === 2) room.player2.code = code;
    }
  });

  socket.on('chatMessage', ({ roomId, message, username }) => {
    io.to(roomId).emit('chatMessage', { username, message, time: Date.now() });
  });

  socket.on('submitCode', ({ roomId, code, playerNum, language }) => {
    const room = rooms[roomId];
    if (!room) return;

    if (room.endTime && Date.now() > room.endTime) {
      socket.emit('battleResult', { output: 'Time is up! Submissions are closed.', passed: '0/0' });
      return;
    }

    try {
      let result;
      if (language === 'python') {
        result = executePython(code, room.problem.testCases);
      } else if (language === 'cpp') {
        result = executeCpp(code, room.problem.testCases);
      } else if (language === 'java') {
        result = executeJava(code, room.problem.testCases);
      } else {
        result = executeJavaScript(code, room.problem.testCases);
      }

      const outputMsg = result.logs.join('\n');
      const passStr = `${result.passed}/${result.total}`;

      if (result.passed === result.total) {
        const winnerName = playerNum === 1 ? room.player1.username : room.player2.username;
        
        // Update scores
        room.scores[winnerName] = (room.scores[winnerName] || 0) + 1;
        room.roundHistory.push({ round: room.round, winner: winnerName, problem: room.problem.title });
        
        io.to(roomId).emit('roundWon', { 
          winner: winnerName, 
          round: room.round, 
          scores: room.scores,
          roundHistory: room.roundHistory
        });

        // Auto-advance to next round after 5 seconds
        setTimeout(() => advanceRound(roomId), 5000);
      } else {
        socket.emit('battleResult', { 
          output: outputMsg || 'Some test cases failed.',
          passed: passStr
        });
      }

    } catch (err) {
      socket.emit('battleResult', { 
        output: `Error: ${err.message}`,
        passed: `0/${room.problem.testCases.length}`
      });
    }
  });

  socket.on('timeUp', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.roundHistory.push({ round: room.round, winner: 'Draw', problem: room.problem.title });
    io.to(roomId).emit('roundWon', { 
      winner: null, 
      round: room.round, 
      scores: room.scores,
      roundHistory: room.roundHistory,
      isDraw: true
    });
    setTimeout(() => advanceRound(roomId), 5000);
  });

  socket.on('leaveBattle', ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      io.to(roomId).emit('battleOver', {
        scores: room.scores,
        roundHistory: room.roundHistory,
        totalRounds: room.round
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

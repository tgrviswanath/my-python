/**
 * Project 03 — Real-Time Chat App
 * Socket.io + Express + JWT auth
 */

'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const cors    = require('cors');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4001;
const SECRET = process.env.JWT_SECRET || 'chat-secret';

app.use(cors({ origin: 'http://localhost:3001', credentials: true }));
app.use(express.json());

// ── In-memory store ───────────────────────────────────────────────────────────
const users    = new Map();  // id → user
const rooms    = new Map();  // roomId → { id, name, members, messages }
const sessions = new Map();  // socketId → userId
let nextUserId = 1;
let nextRoomId = 1;

// Seed rooms
['General', 'Tech', 'Random'].forEach(name => {
  const id = nextRoomId++;
  rooms.set(id, { id, name, members: new Set(), messages: [], createdAt: new Date() });
});

// ── Auth REST ─────────────────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if ([...users.values()].find(u => u.username === username))
    return res.status(409).json({ error: 'Username taken' });

  const hash = await bcrypt.hash(password, 10);
  const user = { id: nextUserId++, username, password: hash, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`, online: false };
  users.set(user.id, user);
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '24h' });
  const { password: _, ...safe } = user;
  res.status(201).json({ user: safe, token });
});

app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = [...users.values()].find(u => u.username === username);
  const valid = user ? await bcrypt.compare(password, user.password)
                     : await bcrypt.compare(password, '$2a$10$placeholder');
  if (!user || !valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: '24h' });
  const { password: _, ...safe } = user;
  res.json({ user: safe, token });
});

app.get('/rooms', (req, res) => {
  res.json([...rooms.values()].map(r => ({
    id: r.id, name: r.name,
    memberCount: r.members.size,
    messageCount: r.messages.length,
  })));
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: 'http://localhost:3001', credentials: true },
  pingTimeout: 60000,
});

// Auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, SECRET);
    const user = users.get(decoded.sub);
    if (!user) return next(new Error('User not found'));
    socket.userId = user.id;
    socket.username = user.username;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = users.get(socket.userId);
  user.online = true;
  sessions.set(socket.id, socket.userId);

  console.log(`${socket.username} connected`);

  // Notify others
  socket.broadcast.emit('user:online', { userId: socket.userId, username: socket.username });

  // Send online users list
  socket.emit('users:online', [...users.values()]
    .filter(u => u.online)
    .map(({ password: _, ...u }) => u)
  );

  // Join room
  socket.on('room:join', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'Room not found');

    socket.join(`room:${roomId}`);
    room.members.add(socket.userId);

    // Send last 50 messages
    socket.emit('room:history', {
      roomId,
      messages: room.messages.slice(-50),
    });

    // Notify room members
    socket.to(`room:${roomId}`).emit('room:user_joined', {
      roomId,
      user: { id: socket.userId, username: socket.username },
    });

    socket.emit('room:joined', { roomId, name: room.name });
  });

  // Leave room
  socket.on('room:leave', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    socket.leave(`room:${roomId}`);
    room.members.delete(socket.userId);
    socket.to(`room:${roomId}`).emit('room:user_left', {
      roomId,
      userId: socket.userId,
    });
  });

  // Send message
  socket.on('message:send', ({ roomId, content }) => {
    if (!content?.trim()) return;
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', 'Room not found');

    const message = {
      id:        Date.now(),
      roomId,
      userId:    socket.userId,
      username:  socket.username,
      content:   content.trim().slice(0, 2000),
      timestamp: new Date().toISOString(),
    };

    room.messages.push(message);
    // Keep last 1000 messages
    if (room.messages.length > 1000) room.messages.shift();

    io.to(`room:${roomId}`).emit('message:new', message);
  });

  // Typing indicator
  socket.on('typing:start', (roomId) => {
    socket.to(`room:${roomId}`).emit('typing:start', {
      roomId, userId: socket.userId, username: socket.username,
    });
  });

  socket.on('typing:stop', (roomId) => {
    socket.to(`room:${roomId}`).emit('typing:stop', {
      roomId, userId: socket.userId,
    });
  });

  // Direct message
  socket.on('dm:send', ({ toUserId, content }) => {
    const toUser = users.get(toUserId);
    if (!toUser) return socket.emit('error', 'User not found');

    const message = {
      id:        Date.now(),
      from:      { id: socket.userId, username: socket.username },
      to:        { id: toUserId, username: toUser.username },
      content:   content.trim().slice(0, 2000),
      timestamp: new Date().toISOString(),
    };

    // Find recipient's socket
    const recipientSocket = [...io.sockets.sockets.values()]
      .find(s => s.userId === toUserId);

    if (recipientSocket) {
      recipientSocket.emit('dm:received', message);
    }
    socket.emit('dm:sent', message);
  });

  // Disconnect
  socket.on('disconnect', () => {
    user.online = false;
    sessions.delete(socket.id);

    // Leave all rooms
    rooms.forEach((room, roomId) => {
      if (room.members.has(socket.userId)) {
        room.members.delete(socket.userId);
        socket.to(`room:${roomId}`).emit('room:user_left', {
          roomId, userId: socket.userId,
        });
      }
    });

    io.emit('user:offline', { userId: socket.userId, username: socket.username });
    console.log(`${socket.username} disconnected`);
  });
});

server.listen(PORT, () => console.log(`Chat server on :${PORT}`));
module.exports = { app, io };

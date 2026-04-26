# Project 03 — Real-Time Chat App

## Architecture
```
realtime-chat/
├── backend/   Node.js + Express + Socket.io
│   └── src/server.js
└── frontend/  React + socket.io-client
    └── src/App.jsx
```

## Features
- JWT authentication (register/login)
- Multiple chat rooms (General, Tech, Random)
- Real-time messaging via WebSockets
- Typing indicators
- Online users list
- Direct messages
- Message history (last 50 per room)

## Run
```bash
cd backend  && npm install && npm run dev   # :4001
cd frontend && npm install && npm start     # :3003
```

## Scaling
- Redis pub/sub for multi-server Socket.io
- MongoDB for message persistence
- Message pagination for history

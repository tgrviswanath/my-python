# Project 01 — Authentication System

## Architecture
```
auth-system/
├── frontend/          React app (login, register, dashboard)
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       └── services/
└── backend/           Node.js + Express + JWT
    └── src/
        ├── routes/
        ├── middleware/
        ├── models/
        └── services/
```

## Features
- Register / Login / Logout
- JWT access + refresh tokens
- Password hashing (bcrypt)
- Protected routes
- Role-based access control
- Rate limiting on auth endpoints
- CSRF protection

## Run
```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm start
```

## Security Considerations
- Passwords hashed with bcrypt (12 rounds)
- JWT stored in httpOnly cookies (not localStorage)
- Refresh token rotation
- Rate limiting: 5 attempts per 15 min
- HTTPS only in production

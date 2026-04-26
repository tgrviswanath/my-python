# Project 04 — Analytics Dashboard

## Architecture
```
dashboard/
├── backend/   Node.js + Express (analytics API)
│   └── src/server.js
└── frontend/  React (charts, tables, metrics)
    └── src/App.jsx
```

## Features
- KPI metrics with trend indicators
- Revenue chart (30/90 day)
- Traffic sources breakdown
- Top products table
- Recent orders with status
- Users by device/country
- Tab navigation (Overview, Users, Products, Orders)

## Run
```bash
cd backend  && npm install && npm run dev   # :4003
cd frontend && npm install && npm start     # :3004
```

## Scaling
- Replace mock data with real DB queries
- Add Redis caching for expensive aggregations
- Add date range filters
- Export to CSV/PDF

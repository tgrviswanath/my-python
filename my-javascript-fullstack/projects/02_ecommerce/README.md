# Project 02 — E-Commerce Platform

## Architecture
```
ecommerce/
├── frontend/          React app
│   └── src/
│       ├── pages/     Home, Products, Cart, Checkout, Orders
│       ├── components/ ProductCard, Cart, Checkout form
│       ├── hooks/     useCart, useProducts, useCheckout
│       └── store/     Cart context + reducer
└── backend/           Node.js + Express + MongoDB
    └── src/
        ├── routes/    products, orders, users, auth
        ├── models/    Product, Order, User (Mongoose)
        └── services/  OrderService, PaymentService
```

## Features
- Product listing with search, filter, sort, pagination
- Shopping cart (localStorage persistence)
- Checkout with address form
- Order history
- Admin: product CRUD, order management

## Run
```bash
cd backend  && npm install && npm run dev   # :4002
cd frontend && npm install && npm start     # :3002
```

## Scaling
- Redis for cart sessions
- CDN for product images
- Elasticsearch for product search
- Message queue for order processing

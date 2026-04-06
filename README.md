# 🔗 LinkSnap — Production URL Shortener

A production-grade URL shortener with real-time analytics, Redis caching, rate limiting, QR codes, and admin dashboard.

## ✨ Feature Set

| Feature | Details |
|---|---|
| **URL Shortening** | Base62 encoding, collision-free, custom codes |
| **Analytics** | Real-time WebSocket + historical charts |
| **Rate Limiting** | Redis sliding window — 100 req/min per IP |
| **Caching** | Redis TTL cache — <10ms lookup |
| **Auth** | JWT (15min) + Refresh tokens (7 days) |
| **QR Codes** | Auto-generated PNG/SVG per URL |
| **Link Expiration** | Per-URL expiry timestamps |
| **Admin Dashboard** | Full user + URL management |
| **Prometheus** | `/metrics` endpoint |
| **Docker** | Multi-container with Nginx reverse proxy |
| **Swagger** | Full OpenAPI docs at `/api-docs` |

## 🛠 Tech Stack

- **Backend**: Node.js 20 + Express + TypeScript
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache**: Redis 7 (ioredis)
- **Proxy**: Nginx 1.25
- **Auth**: JWT (jose) + bcrypt
- **QR**: qrcode
- **Realtime**: Socket.IO WebSocket
- **Monitoring**: Prometheus (prom-client)
- **Frontend**: Next.js 14 + Tailwind CSS + Recharts

## 🚀 Quick Start (Docker Compose)

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/production-url-shortener.git
cd production-url-shortener

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_REFRESH_SECRET, ADMIN_PASSWORD

# 3. Start all services
docker compose -f docker-compose.prod.yml up -d

# 4. Run migrations + seed
docker exec urlshortener_backend npx prisma migrate deploy
docker exec urlshortener_backend npx ts-node prisma/seed.ts

# 5. Open
# Frontend:  http://localhost:3000
# Backend:   http://localhost:4000
# API Docs:  http://localhost:4000/api-docs
# Metrics:   http://localhost:4000/metrics
# Prometheus:http://localhost:9090
# Via Nginx: http://localhost:80
```

## 🖥 Local Development (No Docker)

### Prerequisites
- Node.js 20+
- PostgreSQL 16 running
- Redis 7 running

### Backend

```bash
cd backend
npm install
cp ../.env.example .env
# Edit .env

npx prisma migrate dev --name init
npx prisma generate
npx ts-node prisma/seed.ts
npm run dev
# → http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
# Create .env.local:
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
echo "NEXT_PUBLIC_WS_URL=http://localhost:4000" >> .env.local
npm run dev
# → http://localhost:3000
```

## 📡 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### URLs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shorten` | Create short URL |
| GET | `/api/urls` | Get user's URLs |
| DELETE | `/api/urls/:id` | Delete a URL |
| GET | `/api/qr/:shortCode` | Get QR code |
| GET | `/:shortCode` | Redirect to original |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/:urlId` | URL analytics |
| GET | `/api/analytics/global/stats` | Platform stats |

### Admin (ADMIN role required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Dashboard stats |
| GET | `/api/admin/urls` | All URLs paginated |
| DELETE | `/api/admin/urls/:id` | Delete any URL |
| GET | `/api/admin/users` | All users paginated |
| PATCH | `/api/admin/users/:id/toggle` | Toggle user active |
| PATCH | `/api/admin/users/:id/role` | Change user role |
| POST | `/api/admin/cache/flush` | Flush Redis cache |

### System
| Endpoint | Description |
|----------|-------------|
| GET `/health` | Health check (DB + Redis) |
| GET `/ready` | Readiness check |
| GET `/metrics` | Prometheus metrics |
| GET `/api-docs` | Swagger UI |

## 🔐 Demo Accounts

After seeding:
- **Admin**: admin@example.com / Admin@123456
- **Demo User**: demo@urlshort.io / Demo@123456

## 🐙 GitHub Push

```bash
git init
git add .
git commit -m "Initial commit — Production URL Shortener"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/production-url-shortener.git
git push -u origin main
```

## 🧪 Testing the API

```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test@12345","name":"Test"}'

# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123456"}'

# Shorten (anonymous)
curl -X POST http://localhost:4000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://github.com","title":"GitHub"}'

# Health check
curl http://localhost:4000/health
```

## 🏗 Architecture

```
Browser ──► Nginx (80/443) ──► Frontend (3000) [Next.js]
                          ──► Backend (4000) [Express]
                                   ├── PostgreSQL (5432)
                                   ├── Redis (6379)
                                   └── WebSocket (Socket.IO)
Prometheus (9090) ──► /metrics endpoint
```

## 🛡 Security Features

- Helmet.js security headers
- CORS restricted to frontend origin
- Rate limiting (100/min API, 20/min shorten, 10/min auth)
- JWT with short expiry + refresh rotation
- bcrypt password hashing (cost=12)
- Input validation via Zod
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention via Helmet CSP

## ⚠️ Common Issues

### `DATABASE_URL` connection refused
```bash
# Check PostgreSQL is running
pg_isready -U urluser -d urlshortener
# Or with Docker:
docker ps | grep postgres
```

### Redis connection error
```bash
redis-cli ping
# Should return PONG
```

### Prisma migration error
```bash
cd backend
npx prisma migrate reset  # WARNING: drops all data
npx prisma migrate dev --name init
```

### JWT errors
Make sure `JWT_SECRET` is at least 32 characters in `.env`

### Port already in use
```bash
lsof -i :4000  # Find process
kill -9 <PID>
```

# Docker Setup for Local Development

## Overview

ProdFactory uses Redis for backend state validation. In production, we use Upstash Redis (serverless). For local development, this Docker Compose setup runs Redis locally.

## Prerequisites

- **Docker Desktop** installed and running
  - Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - macOS: [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - Linux: Install Docker Engine and Docker Compose
- **pnpm** (already required for this project)

## Quick Start

### First Time Setup

1. **Copy environment variables:**
   ```bash
   cp .env.example .env.local
   ```

2. **Start Redis:**
   ```bash
   pnpm start:db
   ```

3. **Verify it's running:**
   ```bash
   docker ps
   ```
   You should see two containers: `prodfactory-redis` and `prodfactory-redis-insight`

4. **Access RedisInsight (optional):**
   Open http://localhost:5540 in your browser

### Daily Development Workflow

- **Start:** `pnpm start:db` (if not already running)
- **Stop:** `docker compose down` (when done for the day)
- **View logs:** `docker compose logs -f redis`
- **Restart:** `docker compose restart`
- **Reset all data:** `docker compose down -v` (⚠️ deletes all Redis data)

## Connection Details

| Service        | Access                                          |
|----------------|------------------------------------------------|
| Redis (from host)     | `localhost:6379` or `redis://localhost:6379`   |
| Redis (from Docker)   | `redis:6379` or `redis://redis:6379`           |
| RedisInsight   | http://localhost:5540                          |

## RedisInsight Usage

RedisInsight is a web-based GUI for Redis:

1. Open http://localhost:5540
2. **Add database manually:**
   - Click "Add Database"
   - **Host:** `redis` (Docker service name)
   - **Port:** `6379`
   - **Database Alias:** `ProdFactory Local`
   - Click "Add Database"

   **Note:** Use `redis` as the hostname (not `localhost` or `127.0.0.1`) because RedisInsight runs inside a Docker container and needs to use the Docker network.

3. Use it to:
   - Browse keys and values
   - Execute Redis commands
   - Monitor memory usage
   - Profile queries

## Data Persistence

Data is stored in Docker named volumes and persists between container restarts:

- `docker compose down` → Data preserved ✅
- `docker compose up` → Previous data still there ✅
- `docker compose down -v` → Data deleted ⚠️

**To completely reset your local Redis:**
```bash
docker compose down -v
pnpm start:db
```

## Troubleshooting

### "Cannot connect to Docker daemon"

**Cause:** Docker Desktop is not running

**Solution:** Start Docker Desktop and wait for it to fully initialize

---

### Port 6379 already in use

**Cause:** Another Redis instance is using port 6379

**Solution:**
1. Check what's using the port:
   ```bash
   # Windows
   netstat -ano | findstr :6379

   # macOS/Linux
   lsof -i :6379
   ```

2. Stop the conflicting service or modify `docker-compose.yml` to use a different port:
   ```yaml
   ports:
     - "6380:6379"  # Changed from 6379:6379
   ```
   Then update `REDIS_URL` in `.env.local` to `redis://localhost:6380`

---

### RedisInsight can't connect to Redis

**Cause:** Services not on the same Docker network

**Solution:** Make sure you started both services together with `pnpm start:db`. RedisInsight auto-discovers Redis when they're in the same `docker-compose.yml` file.

---

### Containers keep restarting

**Cause:** Port conflict or invalid configuration

**Solution:**
1. Check logs: `docker compose logs redis`
2. Ensure no syntax errors in `docker-compose.yml`
3. Try stopping all containers: `docker compose down`
4. Start again: `pnpm start:db`

---

## Local vs Production

| Aspect           | Local Development        | Production (Upstash)     |
|------------------|--------------------------|--------------------------|
| Redis Version    | Redis 8 (Docker)         | Redis 7 (Upstash)        |
| Protocol         | Standard Redis           | REST API                 |
| Connection       | `redis://localhost:6379` | Upstash REST URL         |
| Client Library   | TBD (ioredis/node-redis) | `@upstash/redis`         |
| Data Persistence | Docker volumes           | Upstash managed          |
| Environment Vars | `REDIS_URL`              | `UPSTASH_REDIS_REST_*`   |

The application code (to be implemented) will automatically detect the environment and use the appropriate client.

---

## Useful Commands

```bash
# Start services
pnpm start:db

# Stop services (keeps data)
docker compose down

# Restart services
docker compose restart

# View logs (follow mode)
docker compose logs -f redis

# View logs (all at once)
docker compose logs redis

# Execute Redis CLI
docker exec -it prodfactory-redis redis-cli

# Test Redis connection
docker exec -it prodfactory-redis redis-cli ping
# Should respond: PONG

# Stop and delete all data
docker compose down -v

# Check container status
docker ps

# Remove all stopped containers
docker compose down
```

---

## Next Steps

This Docker setup provides the Redis infrastructure. The next implementation phase will:

1. Install Redis client libraries (`@upstash/redis`, `ioredis`)
2. Create API routes for game state management
3. Update `GameStateProvider` to sync with the backend
4. Implement server-side validation and plausibility checks

See `BACKEND-STATE-SUGGESTION.md` for the full backend architecture plan.

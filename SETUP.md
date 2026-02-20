# 🚀 SmartMaint AI - Setup Guide

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Git

## Quick Start

### 1. Navigate to Project
```bash
cd C:\Users\houss\smartmaint
```

### 2. Set Up Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your preferred settings (optional)
# Default values will work for development
```

### 3. Start All Services
```bash
docker-compose up -d
```

This will start:
- ✅ PostgreSQL database (port 5432)
- ✅ Redis cache (port 6379)
- ✅ NestJS backend API (port 3001)
- ✅ Next.js frontend (port 3000)

### 4. Initialize Database

Wait for all containers to be healthy (about 30 seconds), then run:

```bash
# Access backend container
docker exec -it smartmaint-backend bash

# Inside the container, run:
npm run migration:run
npm run db:seed
```

Or run migrations from your host machine:
```bash
docker exec -it smartmaint-backend npm run migration:run
docker exec -it smartmaint-backend npm run db:seed
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation (Swagger)**: http://localhost:3001/api/docs

## Default Login Credentials

After seeding the database, you can use these credentials:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartmaint.com | admin123 |
| Technician | tech@smartmaint.com | tech123 |
| Worker | worker@smartmaint.com | worker123 |

⚠️ **Change these passwords in production!**

## Development Workflow

### Backend Development

```bash
# Access backend container
docker exec -it smartmaint-backend bash

# Install new packages
npm install <package-name>

# Run migrations
npm run migration:run

# View logs
docker logs -f smartmaint-backend
```

### Frontend Development

```bash
# Access frontend container
docker exec -it smartmaint-frontend bash

# Install new packages
npm install <package-name>

# View logs
docker logs -f smartmaint-frontend
```

### Database Access

```bash
# Access PostgreSQL
docker exec -it smartmaint-postgres psql -U smartmaint -d smartmaint_db

# Or use a GUI tool:
# Host: localhost
# Port: 5432
# Database: smartmaint_db
# User: smartmaint
# Password: smartmaint123
```

### Redis Access

```bash
# Access Redis CLI
docker exec -it smartmaint-redis redis-cli
```

## Common Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild containers (after code changes)
docker-compose up -d --build

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v

# Restart a specific service
docker-compose restart backend
```

## Troubleshooting

### Port Already in Use

If ports 3000, 3001, 5432, or 6379 are already in use:

1. Edit `.env` file and change the ports:
   ```
   FRONTEND_PORT=3002
   BACKEND_PORT=3003
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   ```

2. Restart containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### Database Connection Issues

1. Check if PostgreSQL is running:
   ```bash
   docker ps | grep postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker logs smartmaint-postgres
   ```

3. Verify environment variables:
   ```bash
   docker exec smartmaint-backend env | grep DATABASE
   ```

### Backend Not Starting

1. Check backend logs:
   ```bash
   docker logs smartmaint-backend
   ```

2. Verify dependencies are installed:
   ```bash
   docker exec smartmaint-backend npm list --depth=0
   ```

3. Rebuild backend container:
   ```bash
   docker-compose up -d --build backend
   ```

### Frontend Not Starting

1. Check frontend logs:
   ```bash
   docker logs smartmaint-frontend
   ```

2. Verify environment variables:
   ```bash
   docker exec smartmaint-frontend env | grep NEXT_PUBLIC
   ```

## Project Structure

```
smartmaint/
├── backend/              # NestJS backend API
│   ├── src/
│   │   ├── auth/        # Authentication module
│   │   ├── users/        # User management
│   │   ├── tickets/      # Ticket management
│   │   └── database/     # Database config & migrations
│   └── Dockerfile
├── frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities
│   └── Dockerfile
├── docker-compose.yml    # Docker services
├── .env.example         # Environment template
├── .env                 # Environment variables
├── README.md            # Project documentation
├── SETUP.md             # Detailed setup guide
└── QUICKSTART.md        # Quick start guide
```

## Next Steps

1. ✅ **Phase 0 Complete**: Project setup and foundation
2. 🔄 **Phase 1**: Continue building core features (dashboards, file uploads)
3. ⏳ **Phase 2**: AI Integration (LLM, RAG, Chatbot)
4. ⏳ **Phase 3**: Multi-channel integration (WhatsApp, Email)

## Support

For issues or questions:
- Check the logs: `docker-compose logs -f`
- Review the API docs: http://localhost:3001/api/docs
- Check the README.md for more information

---

Happy coding! 🚀

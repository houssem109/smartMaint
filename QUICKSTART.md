# ⚡ Quick Start Guide

Get SmartMaint AI up and running in 5 minutes!

## Step 1: Start Docker Services

```bash
docker-compose up -d
```

Wait about 30 seconds for all containers to start.

## Step 2: Initialize Database

```bash
# Run migrations
docker exec -it smartmaint-backend npm run migration:run

# Seed database with default users
docker exec -it smartmaint-backend npm run db:seed
```

## Step 3: Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/api/docs

## Step 4: Login

Use these default credentials:

- **Admin**: admin@smartmaint.com / admin123
- **Technician**: tech@smartmaint.com / tech123
- **Worker**: worker@smartmaint.com / worker123

## That's it! 🎉

You now have SmartMaint AI running locally.

For detailed setup instructions, see [SETUP.md](./SETUP.md)

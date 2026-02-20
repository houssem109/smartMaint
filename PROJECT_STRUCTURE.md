# 📁 SmartMaint AI - Project Structure

## Repository Structure

```
smartmaint/
├── backend/                      # NestJS Backend API
│   ├── src/
│   │   ├── auth/                 # Authentication Module
│   │   │   ├── dto/              # Data Transfer Objects
│   │   │   │   ├── login.dto.ts
│   │   │   │   └── register.dto.ts
│   │   │   ├── guards/           # Auth Guards
│   │   │   │   └── local-auth.guard.ts
│   │   │   ├── strategies/       # Passport Strategies
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── local.strategy.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   ├── users/                # User Management Module
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   ├── tickets/              # Ticket Management Module
│   │   │   ├── dto/
│   │   │   │   ├── create-ticket.dto.ts
│   │   │   │   └── update-ticket.dto.ts
│   │   │   ├── entities/
│   │   │   │   ├── ticket.entity.ts
│   │   │   │   ├── conversation.entity.ts
│   │   │   │   └── attachment.entity.ts
│   │   │   ├── tickets.controller.ts
│   │   │   ├── tickets.service.ts
│   │   │   └── tickets.module.ts
│   │   ├── common/               # Shared Utilities
│   │   │   ├── decorators/
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── entities/
│   │   │   │   └── audit-log.entity.ts
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── roles.guard.ts
│   │   ├── database/             # Database Configuration
│   │   │   ├── migrations/       # Database Migrations
│   │   │   │   └── 1700000000000-InitialSchema.ts
│   │   │   ├── scripts/          # Database Scripts
│   │   │   │   ├── init.ts
│   │   │   │   └── seed.ts
│   │   │   ├── seeds/            # Seed Data
│   │   │   │   └── seed.ts
│   │   │   ├── database.module.ts
│   │   │   ├── data-source.ts
│   │   │   └── init-db.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── app.module.ts
│   ├── database/                 # Database Init Scripts (for Docker)
│   │   └── init/
│   │       └── 01-init.sql
│   ├── uploads/                  # File Upload Directory
│   ├── .dockerignore
│   ├── .eslintrc.js
│   ├── .prettierrc
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                     # Next.js Frontend
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── lib/                  # Utilities
│   │   │   ├── api.ts            # API Client (Axios)
│   │   │   └── utils.ts          # Helper Functions
│   │   └── store/                # State Management (Zustand)
│   │       └── auth-store.ts
│   ├── .dockerignore
│   ├── .eslintrc.json
│   ├── Dockerfile
│   ├── next.config.js
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── docker-compose.yml            # Docker Compose Configuration
├── .env                          # Environment Variables (create from .env.example)
├── .env.example                  # Environment Variables Template
├── .gitignore                    # Git Ignore Rules
├── README.md                     # Main Documentation
├── SETUP.md                      # Detailed Setup Guide
├── QUICKSTART.md                 # Quick Start Guide
└── PROJECT_STRUCTURE.md          # This File
```

## Key Directories

### Backend (`/backend`)
- **NestJS** framework with TypeScript
- **TypeORM** for database operations
- **JWT** authentication with Passport
- **Swagger/OpenAPI** documentation
- Modular architecture (auth, users, tickets)

### Frontend (`/frontend`)
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Axios** for API calls

### Root Level
- **docker-compose.yml**: Orchestrates all services
- **.env**: Environment configuration
- **Documentation**: README, SETUP, QUICKSTART guides

## Docker Services

1. **PostgreSQL** (port 5432) - Database
2. **Redis** (port 6379) - Cache
3. **Backend** (port 3001) - NestJS API
4. **Frontend** (port 3000) - Next.js App

## Getting Started

1. Navigate to project: `cd smartmaint`
2. Copy environment: `cp .env.example .env`
3. Start services: `docker-compose up -d`
4. Initialize DB: `docker exec -it smartmaint-backend npm run migration:run`
5. Seed data: `docker exec -it smartmaint-backend npm run db:seed`

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

# 🚀 SmartMaint AI - Maintenance Management System

A comprehensive AI-powered maintenance management system with multi-channel support (Web, WhatsApp, Email), intelligent ticket routing, and conversational AI assistance.

## 🏗️ Project Architecture

### System Overview
SmartMaint AI is a full-stack application built with a microservices-oriented architecture, containerized using Docker, and designed for scalability and maintainability.

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Frontend)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Next.js 14 (React 18, TypeScript, Tailwind CSS)     │  │
│  │  - Server-Side Rendering (SSR)                        │  │
│  │  - Client-Side Rendering (CSR)                        │  │
│  │  - Progressive Web App (PWA) Ready                   │  │
│  │  - Dark/Light Mode Support                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/REST API
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer (Backend)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  NestJS Framework (Node.js, TypeScript, Express)      │  │
│  │  - RESTful API                                        │  │
│  │  - JWT Authentication                                 │  │
│  │  - Role-Based Access Control (RBAC)                   │  │
│  │  - Swagger/OpenAPI Documentation                      │  │
│  │  - WebSocket Support (Socket.io)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PostgreSQL  │  │    Redis     │  │  Vector DB   │     │
│  │   (Primary)  │  │   (Cache)    │  │  (ChromaDB)  │     │
│  │              │  │              │  │              │     │
│  │ - Users      │  │ - Sessions   │  │ - Embeddings │     │
│  │ - Tickets    │  │ - Real-time  │  │ - Knowledge  │     │
│  │ - Logs       │  │   Data       │  │   Base       │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              AI/ML Layer (Future Phases)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Ollama    │  │  LangChain   │  │  Embeddings  │     │
│  │   (LLM)      │  │  (RAG)       │  │  (Vectors)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│          Integration Layer (Future Phases)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     n8n      │  │   Twilio     │  │     SMTP     │     │
│  │ (Automation) │  │  (WhatsApp)  │  │   (Email)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend Technologies
- **Framework**: Next.js 14.2+ (React 18.2, TypeScript 5.3)
- **Styling**: Tailwind CSS 3.4+ with Dark Mode support
- **State Management**: Zustand 4.4+ (with persistence)
- **HTTP Client**: Axios 1.6+
- **Notifications**: react-hot-toast 2.6+
- **Form Handling**: React Hook Form 7.49+ with Zod validation
- **UI Components**: Custom components with Tailwind
- **Routing**: Next.js App Router (file-based routing)

### Backend Technologies
- **Framework**: NestJS 10.3+ (Node.js 18+, TypeScript 5.3)
- **Runtime**: Node.js 18+ (Alpine Linux)
- **HTTP Server**: Express.js (via NestJS)
- **Authentication**: JWT (JSON Web Tokens) with Passport.js
- **Authorization**: Role-Based Access Control (RBAC)
- **API Documentation**: Swagger/OpenAPI 3.0
- **WebSockets**: Socket.io 4.6+ (for real-time features)
- **Validation**: class-validator & class-transformer

### Database & Storage
- **Primary Database**: PostgreSQL 15 (Alpine)
  - ACID compliance
  - Full-text search support
  - JSON/JSONB support for flexible schemas
- **Cache Layer**: Redis 7 (Alpine)
  - Session storage
  - Real-time data caching
  - Pub/Sub for notifications
- **Vector Database**: ChromaDB (Future - Phase 2)
  - Document embeddings storage
  - Semantic search capabilities

### DevOps & Infrastructure
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx (Future - Production)
- **Monitoring**: Prometheus + Grafana (Future)
- **Logging**: ELK Stack (Future)
- **CI/CD**: GitHub Actions (Future)

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript
- **Linting**: ESLint 8.56+
- **Code Formatting**: Prettier 3.1+
- **Version Control**: Git
- **API Testing**: Swagger UI (built-in)

### AI/ML Stack (Future Phases)
- **LLM Runtime**: Ollama (Local deployment)
- **LLM Models**: Llama 3.1 8B / Mistral 7B
- **RAG Framework**: LangChain
- **Embeddings**: Sentence Transformers (all-MiniLM-L6-v2)
- **Vector Database**: ChromaDB / Qdrant

### Integration Tools (Future Phases)
- **Workflow Automation**: n8n
- **WhatsApp API**: Twilio WhatsApp Business API
- **Email Service**: SMTP/IMAP (Nodemailer)
- **Push Notifications**: Web Push API

## 📋 Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Git
- Node.js 18+ (for local development without Docker)

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone <repository-url>
cd smartmaint
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start all services with Docker Compose
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- NestJS backend API (port 3001)
- Next.js frontend (port 3000)

### 4. Run database migrations
```bash
# Access backend container
docker exec -it smartmaint-backend bash

# Run migrations
npm run migration:run
```

### 5. Access the application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs (Swagger)

## 📁 Project Structure

```
smartmaint/
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── users/          # User management
│   │   ├── tickets/        # Ticket management
│   │   ├── ai/             # AI integration (Phase 2)
│   │   ├── approvals/      # Approval system (Phase 4)
│   │   └── common/         # Shared utilities
│   ├── database/
│   │   ├── migrations/     # Database migrations
│   │   └── seeds/          # Seed data
│   └── Dockerfile
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/            # Next.js app router
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities
│   │   └── store/          # State management
│   └── Dockerfile
├── docker-compose.yml      # Docker services configuration
├── .env.example            # Environment variables template
├── .env                    # Environment variables (create from .env.example)
├── README.md               # This file
├── SETUP.md                # Detailed setup guide
└── QUICKSTART.md           # Quick start guide
```

## 🔐 Default Credentials

After running migrations and seeds:
- **Admin**: admin@smartmaint.com / admin123
- **Technician**: tech@smartmaint.com / tech123
- **Worker**: worker@smartmaint.com / worker123

⚠️ **Change these in production!**

## 🔌 API Architecture

### RESTful API Design
- **Base URL**: `http://localhost:3001/api`
- **Authentication**: Bearer Token (JWT)
- **Response Format**: JSON
- **Error Handling**: Standardized error responses
- **Versioning**: Future API versioning support

### Endpoints Structure
```
/api/auth/
  POST   /login          # User login
  POST   /register       # User registration
  GET    /profile        # Get current user profile

/api/users/
  GET    /               # List all users (Admin)
  GET    /technicians    # List technicians
  GET    /me             # Get current user
  GET    /:id            # Get user by ID
  PATCH  /:id            # Update user (Admin)
  DELETE /:id            # Delete user (Admin)

/api/tickets/
  POST   /               # Create ticket
  GET    /               # List tickets (filtered by role)
  GET    /:id            # Get ticket details
  PATCH  /:id            # Update ticket
  DELETE /:id            # Delete ticket
  POST   /:id/assign     # Assign ticket to technician
```

### Authentication Flow
1. User submits credentials → `/api/auth/login`
2. Server validates and returns JWT token
3. Client stores token in localStorage
4. Subsequent requests include token in `Authorization` header
5. Server validates token on each request
6. Token expires after 7 days (configurable)

### Role-Based Access Control
- **Worker**: Can create and view own tickets, delete own tickets
- **Technician**: Can view all tickets, update status, assign tickets, close tickets
- **Admin**: Full access to all features, user management, system configuration

## 🧪 Development

### Backend Development
```bash
cd backend
npm install
npm run start:dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
# Create migration
npm run migration:create -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 📊 Development Phases

- ✅ **Phase 0**: Project Setup & Planning
- ✅ **Phase 1**: Core Foundation (Authentication, Tickets, Dashboards)
  - ✅ User authentication & authorization
  - ✅ Ticket CRUD operations
  - ✅ Role-based dashboards
  - ✅ Dark/Light mode
  - ✅ Toast notifications
  - ✅ Real-time data refresh
- 🔄 **Phase 2**: AI Integration (LLM, RAG, Chatbot)
  - ⏳ Ollama setup
  - ⏳ RAG knowledge system
  - ⏳ Conversational chatbot
  - ⏳ AI suggestion engine
- ⏳ **Phase 3**: Multi-Channel Integration (WhatsApp, Email)
  - ⏳ n8n workflow setup
  - ⏳ WhatsApp integration
  - ⏳ Email processing
- ⏳ **Phase 4**: Approval System & Rollback
  - ⏳ Approval workflow
  - ⏳ Action execution engine
  - ⏳ Rollback mechanism
- ⏳ **Phase 5**: PWA & Mobile Optimization
  - ⏳ Service workers
  - ⏳ Push notifications
  - ⏳ Offline support
- ⏳ **Phase 6**: Analytics & Reporting
  - ⏳ Analytics dashboard
  - ⏳ Report generation
  - ⏳ Data visualization
- ⏳ **Phase 7**: Testing & QA
  - ⏳ Unit tests
  - ⏳ Integration tests
  - ⏳ E2E tests
- ⏳ **Phase 8**: Deployment & Launch
  - ⏳ Production setup
  - ⏳ Monitoring & logging
  - ⏳ User training

## 🐳 Docker Architecture

### Container Services
- **smartmaint-postgres**: PostgreSQL 15 database
- **smartmaint-redis**: Redis 7 cache
- **smartmaint-backend**: NestJS API server
- **smartmaint-frontend**: Next.js web application

### Network Architecture
- **Network**: `smartmaint-network` (bridge network)
- **Internal Communication**: Services communicate via service names
- **Port Mapping**: 
  - Frontend: `3000:3000`
  - Backend: `3001:3001`
  - PostgreSQL: `5433:5432` (host:container)
  - Redis: `6379:6379`

### Volume Management
- **postgres_data**: Persistent PostgreSQL data
- **redis_data**: Persistent Redis data
- **Code Volumes**: Live code mounting for hot reload

### Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes data)
docker-compose down -v

# Rebuild containers
docker-compose up -d --build

# Restart specific service
docker-compose restart backend

# Access PostgreSQL
docker exec -it smartmaint-postgres psql -U smartmaint -d smartmaint_db

# Access Redis CLI
docker exec -it smartmaint-redis redis-cli

# Access backend container shell
docker exec -it smartmaint-backend bash

# Access frontend container shell
docker exec -it smartmaint-frontend bash
```

## 📝 API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:3001/api/docs
- **API Endpoints**: Fully documented with OpenAPI/Swagger 3.0
- **Interactive Testing**: Test endpoints directly from Swagger UI
- **Schema Definitions**: Request/response schemas included

## 🔄 Data Flow Architecture

### Ticket Creation Flow
```
Worker → Frontend Form → API POST /tickets → Backend Service → 
Database → Response → Frontend → Toast Notification → Dashboard Refresh
```

### Authentication Flow
```
User Login → API POST /auth/login → Validate Credentials → 
Generate JWT → Store Token → Redirect to Dashboard → 
Protected Routes → JWT Validation → Access Granted
```

### Real-Time Updates Flow
```
Backend Change → Database Update → Frontend Polling (5s) → 
Fetch Updated Data → Update UI → Toast Notification
```

## 🎨 UI/UX Architecture

### Design System
- **Color Scheme**: Tailwind CSS with custom dark mode
- **Typography**: System fonts with semantic sizing
- **Spacing**: Consistent spacing scale (Tailwind)
- **Components**: Reusable component library
- **Responsive**: Mobile-first design approach

### State Management
- **Global State**: Zustand stores (auth, theme)
- **Local State**: React useState hooks
- **Server State**: React Query (future)
- **Form State**: React Hook Form

### User Experience Features
- **Dark Mode**: System preference + manual toggle
- **Toast Notifications**: Non-blocking feedback
- **Loading States**: Skeleton loaders and spinners
- **Error Handling**: User-friendly error messages
- **Confirmation Modals**: Custom modal dialogs
- **Auto-refresh**: Automatic data updates every 5 seconds

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Submit a pull request

## 📄 License

[Your License Here]

## 🆘 Support

For issues and questions:
- Create an issue in the repository
- Contact the development team

---

Built with ❤️ for SmartMaint AI

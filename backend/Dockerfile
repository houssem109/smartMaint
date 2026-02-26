FROM node:18-alpine

WORKDIR /app

# Install build tools for native modules (e.g., bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "run", "start:dev"]

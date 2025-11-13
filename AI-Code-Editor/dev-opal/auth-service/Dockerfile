FROM node:20-alpine

WORKDIR /app

# System deps required to build sqlite3 native bindings  
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    linux-headers

# Install deps separately for better layer caching
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

# Copy source
COPY . .

# Rebuild sqlite3 for the current platform
RUN npm rebuild sqlite3

# Create database dir for SQLite sessions
RUN mkdir -p /app/database

ENV NODE_ENV=production
ENV AUTH_PORT=3010

EXPOSE 3010

CMD ["node", "server.js"]



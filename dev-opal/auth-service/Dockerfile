FROM node:20-slim

WORKDIR /app

# System deps required to build sqlite3 native bindings
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       python3 make g++ build-essential libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install deps separately for better layer caching
COPY package*.json ./
RUN npm ci --only=production \
    && npm rebuild sqlite3 --build-from-source \
    && npm cache clean --force

# Copy source
COPY . .

# Create database dir for SQLite sessions
RUN mkdir -p /app/database && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV AUTH_PORT=3010

EXPOSE 3010

CMD ["node", "server.js"]



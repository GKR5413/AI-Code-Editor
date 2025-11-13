FROM node:20-alpine

WORKDIR /app

# Install system dependencies for gRPC
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production --legacy-peer-deps

# Copy source files
COPY *.js ./
COPY proto ./proto

# Expose ports
ENV PORT=6000
EXPOSE 6000 50053

# Default workspace path inside the container (shared volume will mount here)
ENV WORKSPACE_PATH=/workspace

CMD ["node", "server.js"]


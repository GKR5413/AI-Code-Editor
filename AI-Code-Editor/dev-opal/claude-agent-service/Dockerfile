# Claude Agent Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install system dependencies for gRPC and native modules
RUN apk add --no-cache python3 make g++
COPY package*.json ./

# Install dependencies
RUN npm install --production && npm cache clean --force

# Copy application code
COPY *.js ./

EXPOSE 6001

CMD ["node", "server.js"]

# Claude Agent Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production && npm cache clean --force

# Copy application code
COPY *.js ./

EXPOSE 6001

CMD ["node", "server.js"]

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy source
COPY server.js ./

# Expose port
ENV PORT=6000
EXPOSE 6000

# Default workspace path inside the container (shared volume will mount here)
ENV WORKSPACE_PATH=/workspace

CMD ["node", "server.js"]



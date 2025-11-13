# VelocIDE Main Application
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies including build tools for node-pty
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    linux-headers

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p /app/workspace /app/projects

# Expose port for Vite dev server
EXPOSE 5173

# Set environment variables
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# Start the development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
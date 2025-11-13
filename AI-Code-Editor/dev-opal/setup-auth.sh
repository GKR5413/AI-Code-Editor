#!/bin/bash

echo "🔐 Setting up VelocIDE Authentication Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

# Create auth-service directory if it doesn't exist
mkdir -p auth-service

# Install auth service dependencies
echo "📦 Installing authentication service dependencies..."
cd auth-service

if [ ! -f package.json ]; then
    echo "❌ auth-service/package.json not found. Make sure you've created the auth service files."
    exit 1
fi

npm install

# Create .env file from example
if [ ! -f .env ]; then
    echo "🔧 Creating environment configuration..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "⚠️  Please edit auth-service/.env and add your GitHub OAuth credentials:"
        echo "   - GITHUB_CLIENT_ID"
        echo "   - GITHUB_CLIENT_SECRET"
        echo "   - SESSION_SECRET (generate a secure random string)"
        echo "   - JWT_SECRET (generate a secure random string)"
    else
        echo "❌ .env.example file not found"
        exit 1
    fi
else
    echo "✅ .env file already exists"
fi

# Create database directory
mkdir -p database

# Initialize database
echo "🗄️  Initializing authentication database..."
npm run migrate || echo "⚠️  Database migration script not found, database will be created automatically on first run"

cd ..

echo ""
echo "✅ Authentication service setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create a GitHub OAuth App:"
echo "   - Go to https://github.com/settings/applications/new"
echo "   - Application name: VelocIDE"
echo "   - Homepage URL: http://localhost:8080"
echo "   - Authorization callback URL: http://localhost:3010/auth/github/callback"
echo ""
echo "2. Copy the Client ID and Client Secret to auth-service/.env"
echo ""
echo "3. Generate secure secrets for SESSION_SECRET and JWT_SECRET in .env:"
echo "   - You can use: openssl rand -hex 32"
echo ""
echo "4. Start the development servers:"
echo "   npm run dev:full"
echo ""
echo "🚀 VelocIDE will be available at http://localhost:8080"
echo "🔐 Authentication service will run on http://localhost:3010"
#!/bin/bash

# VelocIDE Quick Start Script
# This script helps you quickly set up and run VelocIDE locally

set -e

echo "🚀 VelocIDE Quick Start"
echo "======================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running."
    echo "Please start Docker Desktop and try again."
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo "❌ Error: .env.docker file not found"
    echo "Please create .env.docker with your API keys"
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Check for API keys
if grep -q "GEMINI_API_KEY=AIzaSy" .env.docker; then
    echo "✅ Gemini API key configured"
else
    echo "⚠️  Gemini API key not found in .env.docker"
fi

if grep -q "GROQ_API_KEY=gsk_" .env.docker; then
    echo "✅ Groq API key configured"
else
    echo "⚠️  Groq API key not found in .env.docker"
fi

echo ""
echo "📦 Building and starting services..."
echo "This may take a few minutes on first run."
echo ""

# Build and start services
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "✅ Services Status:"
docker-compose ps

echo ""
echo "🎉 VelocIDE is now running!"
echo ""
echo "📍 Access Points:"
echo "   Frontend:        http://localhost:5173"
echo "   Agent Service:   http://localhost:6000"
echo "   Claude Agent:    http://localhost:6001"
echo "   Auth Service:    http://localhost:3010"
echo "   Compiler:        http://localhost:3002"
echo ""
echo "📋 Useful Commands:"
echo "   View logs:       docker-compose logs -f"
echo "   Stop services:   docker-compose down"
echo "   Restart:         docker-compose restart"
echo ""
echo "📖 Documentation: See LOCAL_SETUP_GUIDE.md"
echo ""
echo "Happy coding! 🎨"

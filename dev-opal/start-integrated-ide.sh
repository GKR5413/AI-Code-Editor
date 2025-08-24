#!/bin/bash

# AI-Powered IDE - Integrated Startup Script
# This script sets up and starts the complete IDE environment with shared volumes

set -e

echo "🚀 Starting AI-Powered IDE with Integrated Containers..."
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

print_success "Docker is running ✓"

# Stop any existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.integrated.yml down 2>/dev/null || true

# Build terminal container image first
print_status "Building terminal container image..."
docker-compose -f docker-compose.integrated.yml build terminal-container-builder

# Build and start all services
print_status "Building and starting integrated IDE services..."
docker-compose -f docker-compose.integrated.yml up -d --build

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check service health
print_status "Checking service health..."

services=(
    "http://localhost:8080:IDE Interface"
    "http://localhost:3002:Compiler Service" 
    "http://localhost:3003:Terminal Service"
    "http://localhost:3005:File System API"
)

all_healthy=true

for service in "${services[@]}"; do
    url=$(echo $service | cut -d: -f1,2,3)
    name=$(echo $service | cut -d: -f4-)
    
    if curl -f -s $url/health > /dev/null 2>&1 || curl -f -s $url > /dev/null 2>&1; then
        print_success "$name is running ✓"
    else
        print_warning "$name may not be ready yet"
        all_healthy=false
    fi
done

echo ""
echo "🎉 AI-Powered IDE Setup Complete!"
echo "=================================="
echo ""
echo "📱 Access your IDE at: http://localhost:8080"
echo ""
echo "🔧 Service URLs:"
echo "   • IDE Interface:     http://localhost:8080"
echo "   • Compiler Service:  http://localhost:3002"
echo "   • Terminal Service:  http://localhost:3003" 
echo "   • File System API:   http://localhost:3005"
echo ""
echo "📁 Shared Volumes:"
echo "   • Workspace:  /workspace (shared across all containers)"
echo "   • Projects:   /projects (your project files)"
echo ""
echo "🔧 Useful Commands:"
echo "   • View logs:          docker-compose -f docker-compose.integrated.yml logs -f"
echo "   • Stop IDE:           docker-compose -f docker-compose.integrated.yml down"
echo "   • Restart services:   docker-compose -f docker-compose.integrated.yml restart"
echo "   • View containers:    docker-compose -f docker-compose.integrated.yml ps"
echo ""
echo "💡 Features:"
echo "   ✓ File Manager with shared workspace access"
echo "   ✓ Multi-language compiler with 20+ languages"  
echo "   ✓ Docker-based terminal with full dev environment"
echo "   ✓ All containers share the same workspace"
echo "   ✓ Real-time file synchronization"
echo ""

if [ "$all_healthy" = false ]; then
    print_warning "Some services may still be starting up. Please wait a moment and refresh your browser."
fi

print_success "Your AI-Powered IDE is ready! 🚀"
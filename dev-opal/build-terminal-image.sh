#!/bin/bash

echo "🔨 Building AI-IDE Terminal Container Image..."

# Build the terminal container image
docker build -f Dockerfile.terminal-container -t ai-ide-terminal-container:latest .

if [ $? -eq 0 ]; then
    echo "✅ Terminal container image built successfully!"
    echo "🐳 Image: ai-ide-terminal-container:latest"
else
    echo "❌ Failed to build terminal container image"
    exit 1
fi

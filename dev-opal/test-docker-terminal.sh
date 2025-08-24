#!/bin/bash

echo "🧪 Testing Docker Terminal Setup..."
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
    fi
}

# Test 1: Check if Docker is running
echo "1. Checking Docker status..."
docker info > /dev/null 2>&1
print_status $? "Docker is running"

# Test 2: Check if terminal container image exists
echo "2. Checking terminal container image..."
docker images | grep -q "ai-ide-terminal-container"
print_status $? "Terminal container image exists"

# Test 3: Check if port 3003 is available
echo "3. Checking port 3003 availability..."
lsof -i :3003 > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Port 3003 is in use${NC}"
else
    echo -e "${GREEN}✅ Port 3003 is available${NC}"
fi

# Test 4: Check if terminal service is running
echo "4. Checking terminal service health..."
if command -v curl &> /dev/null; then
    response=$(curl -s http://localhost:3003/health 2>/dev/null)
    if [ $? -eq 0 ] && echo "$response" | grep -q "ok"; then
        echo -e "${GREEN}✅ Terminal service is healthy${NC}"
    else
        echo -e "${RED}❌ Terminal service is not responding${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  curl not available, skipping health check${NC}"
fi

# Test 5: Check Docker Compose configuration
echo "5. Checking Docker Compose configuration..."
docker-compose config > /dev/null 2>&1
print_status $? "Docker Compose configuration is valid"

# Test 6: Check required files
echo "6. Checking required files..."
files=(
    "Dockerfile.terminal"
    "Dockerfile.terminal-container"
    "docker-terminal-server.js"
    "docker-compose.yml"
    "start-docker-ide.js"
)

all_files_exist=true
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "   ${GREEN}✅ $file${NC}"
    else
        echo -e "   ${RED}❌ $file${NC}"
        all_files_exist=false
    fi
done

if [ "$all_files_exist" = true ]; then
    echo -e "${GREEN}✅ All required files exist${NC}"
else
    echo -e "${RED}❌ Some required files are missing${NC}"
fi

# Test 7: Check if scripts are executable
echo "7. Checking script permissions..."
scripts=(
    "build-terminal-image.sh"
    "test-docker-terminal.sh"
)

all_scripts_executable=true
for script in "${scripts[@]}"; do
    if [ -x "$script" ]; then
        echo -e "   ${GREEN}✅ $script is executable${NC}"
    else
        echo -e "   ${RED}❌ $script is not executable${NC}"
        all_scripts_executable=false
    fi
done

if [ "$all_scripts_executable" = true ]; then
    echo -e "${GREEN}✅ All scripts are executable${NC}"
else
    echo -e "${RED}❌ Some scripts are not executable${NC}"
fi

echo ""
echo "=================================="
echo "🎯 Test Summary:"

# Count results
total_tests=7
passed_tests=0

# Re-run tests to count results
docker info > /dev/null 2>&1 && ((passed_tests++))
docker images | grep -q "ai-ide-terminal-container" && ((passed_tests++))
docker-compose config > /dev/null 2>&1 && ((passed_tests++))
[ "$all_files_exist" = true ] && ((passed_tests++))
[ "$all_scripts_executable" = true ] && ((passed_tests++))

# Health check (if curl available)
if command -v curl &> /dev/null; then
    response=$(curl -s http://localhost:3003/health 2>/dev/null)
    if [ $? -eq 0 ] && echo "$response" | grep -q "ok"; then
        ((passed_tests++))
    fi
else
    ((passed_tests++)) # Skip this test if curl not available
fi

echo -e "Passed: ${GREEN}$passed_tests/$total_tests${NC}"

if [ $passed_tests -eq $total_tests ]; then
    echo -e "${GREEN}🎉 All tests passed! Docker terminal should work.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Start the Docker IDE: npm run start:docker:full"
    echo "2. Open http://localhost:5173 in your browser"
    echo "3. Check if terminal shows 'Online' status"
else
    echo -e "${RED}⚠️  Some tests failed. Please fix the issues above.${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Build terminal image: ./build-terminal-image.sh"
    echo "2. Check Docker is running: docker info"
    echo "3. Free port 3001: kill-port 3001"
    echo "4. Make scripts executable: chmod +x *.sh"
fi

echo ""
echo "For detailed help, see: DOCKER_TERMINAL_GUIDE.md"

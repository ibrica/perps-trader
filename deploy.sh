#!/bin/bash

# =============================================================================
# Perps Trader VPS Deployment Script
# =============================================================================
# This script automates the deployment of perps-trader and its dependencies
# on a VPS using Docker Compose.
# =============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRADER_AI_PATH="${TRADER_AI_PATH:-../trader-ai}"
SOL_INDEXER_PATH="${SOL_INDEXER_PATH:-../sol-indexer}"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if file exists
check_file() {
    if [ -f "$1" ]; then
        print_success "Found: $1"
        return 0
    else
        print_error "Missing: $1"
        return 1
    fi
}

# Check if directory exists
check_directory() {
    if [ -d "$1" ]; then
        print_success "Found directory: $1"
        return 0
    else
        print_warning "Missing directory: $1"
        return 1
    fi
}

# Generate secure random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# =============================================================================
# Validation Functions
# =============================================================================

validate_dependencies() {
    print_header "Validating Dependencies"

    local all_good=true

    if command_exists docker; then
        print_success "Docker is installed"
        docker --version
    else
        print_error "Docker is not installed"
        all_good=false
    fi

    if command_exists docker-compose; then
        print_success "Docker Compose is installed"
        docker-compose --version
    else
        print_error "Docker Compose is not installed"
        all_good=false
    fi

    if command_exists git; then
        print_success "Git is installed"
    else
        print_error "Git is not installed"
        all_good=false
    fi

    if [ "$all_good" = false ]; then
        print_error "Missing required dependencies. Please install them first."
        exit 1
    fi

    echo ""
}

validate_project_structure() {
    print_header "Validating Project Structure"

    local all_good=true

    # Check main files
    check_file "$SCRIPT_DIR/docker-compose.yml" || all_good=false
    check_file "$SCRIPT_DIR/Dockerfile" || all_good=false
    check_file "$SCRIPT_DIR/package.json" || all_good=false

    # Check external services
    if ! check_directory "$SCRIPT_DIR/$TRADER_AI_PATH"; then
        print_warning "trader-ai directory not found at $TRADER_AI_PATH"
        print_info "AI predictions will not be available"
    fi

    if ! check_directory "$SCRIPT_DIR/$SOL_INDEXER_PATH"; then
        print_error "sol-indexer directory not found at $SOL_INDEXER_PATH"
        print_error "Sol-indexer is REQUIRED for price feeds"
        all_good=false
    fi

    if [ "$all_good" = false ]; then
        print_error "Project structure validation failed"
        exit 1
    fi

    print_success "Project structure validated"
    echo ""
}

validate_env_file() {
    print_header "Validating Environment Configuration"

    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        print_warning ".env file not found"

        if [ -f "$SCRIPT_DIR/.env.example" ]; then
            print_info "Creating .env from .env.example"
            cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
            print_warning "Please edit .env file with your configuration before continuing"
            print_info "Required variables: MONGODB_URI, HL_ADDRESS, HL_PRIVATE_KEY, CHAINSTREAM_API_KEY"

            read -p "Press Enter after you've configured .env, or Ctrl+C to exit..."
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_success ".env file exists"
    fi

    # Check critical variables
    source "$SCRIPT_DIR/.env"

    local missing_vars=()

    # Check MongoDB
    if [ -z "$MONGODB_URI" ] || [ "$MONGODB_URI" = "mongodb+srv://username:password@cluster.mongodb.net/perps-trader?retryWrites=true&w=majority" ]; then
        missing_vars+=("MONGODB_URI")
    fi

    # Check Hyperliquid (if enabled)
    if [ "$HL_ENABLED" = "true" ]; then
        [ -z "$HL_ADDRESS" ] || [ "$HL_ADDRESS" = "your_wallet_address_here" ] && missing_vars+=("HL_ADDRESS")
        [ -z "$HL_PRIVATE_KEY" ] || [ "$HL_PRIVATE_KEY" = "your_encrypted_private_key_here" ] && missing_vars+=("HL_PRIVATE_KEY")
        [ -z "$HL_KEY_SECRET" ] || [ "$HL_KEY_SECRET" = "your_encryption_secret_here" ] && missing_vars+=("HL_KEY_SECRET")
    fi

    # Check Chainstream (required for sol-indexer)
    if [ -z "$CHAINSTREAM_API_KEY" ]; then
        missing_vars+=("CHAINSTREAM_API_KEY")
    fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing or unconfigured environment variables:"
        for var in "${missing_vars[@]}"; do
            print_error "  - $var"
        done
        print_info "Please configure these in .env file"
        exit 1
    fi

    print_success "Environment configuration validated"
    echo ""
}

# =============================================================================
# Deployment Functions
# =============================================================================

setup_clickhouse_password() {
    print_header "Setting Up ClickHouse Password"

    source "$SCRIPT_DIR/.env"

    if [ -z "$CLICKHOUSE_PASSWORD" ]; then
        print_info "Generating secure ClickHouse password..."
        CLICKHOUSE_PASSWORD=$(generate_password)

        # Append to .env
        echo "" >> "$SCRIPT_DIR/.env"
        echo "# Generated ClickHouse password ($(date))" >> "$SCRIPT_DIR/.env"
        echo "CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD" >> "$SCRIPT_DIR/.env"

        print_success "Generated and saved ClickHouse password"
    else
        print_success "ClickHouse password already configured"
    fi

    echo ""
}

build_services() {
    print_header "Building Docker Services"

    cd "$SCRIPT_DIR"

    print_info "Building perps-trader..."
    docker-compose build perps-trader

    if [ -d "$SOL_INDEXER_PATH" ]; then
        print_info "Building sol-indexer..."
        docker-compose build sol-indexer
    fi

    if [ -d "$TRADER_AI_PATH" ]; then
        print_info "Building trader-ai..."
        docker-compose build trader-ai
    fi

    print_success "All services built successfully"
    echo ""
}

start_services() {
    print_header "Starting Services"

    cd "$SCRIPT_DIR"

    print_info "Starting infrastructure services (ClickHouse)..."
    docker-compose up -d clickhouse

    print_info "Waiting for ClickHouse to be healthy..."
    sleep 10

    if [ -d "$SOL_INDEXER_PATH" ]; then
        print_info "Starting sol-indexer..."
        docker-compose up -d sol-indexer

        print_info "Waiting for sol-indexer to be healthy..."
        sleep 10
    fi

    if [ -d "$TRADER_AI_PATH" ]; then
        print_info "Starting trader-ai..."
        docker-compose up -d trader-ai
    fi

    print_info "Starting perps-trader..."
    docker-compose up -d perps-trader

    if [ ! -z "$DD_API_KEY" ]; then
        print_info "Starting Datadog agent..."
        docker-compose up -d datadog-agent
    fi

    print_success "All services started"
    echo ""
}

check_service_health() {
    print_header "Checking Service Health"

    local max_retries=30
    local retry_count=0

    print_info "Waiting for services to be healthy (max ${max_retries}s)..."

    while [ $retry_count -lt $max_retries ]; do
        if docker-compose ps | grep -q "Up (healthy)"; then
            print_success "Services are healthy"
            echo ""
            docker-compose ps
            return 0
        fi

        sleep 1
        retry_count=$((retry_count + 1))
        echo -n "."
    done

    echo ""
    print_warning "Some services may not be healthy yet"
    print_info "Check logs with: docker-compose logs"
    echo ""
    docker-compose ps
}

display_access_info() {
    print_header "Deployment Complete!"

    source "$SCRIPT_DIR/.env"

    # Get server IP
    SERVER_IP=$(curl -s ifconfig.me || echo "your-vps-ip")

    echo -e "${GREEN}Your perps-trader platform is now running!${NC}"
    echo ""
    echo -e "${BLUE}Service Access:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}Perps Trader API:${NC}      http://$SERVER_IP:7777"
    echo -e "${GREEN}Health Check:${NC}          http://$SERVER_IP:7777/health"
    echo -e "${GREEN}Sol-Indexer WebSocket:${NC} ws://$SERVER_IP:7070"
    echo -e "${GREEN}Sol-Indexer API:${NC}       http://$SERVER_IP:7071"
    echo -e "${GREEN}ClickHouse:${NC}            http://$SERVER_IP:8123"
    echo ""

    if [ -d "$TRADER_AI_PATH" ]; then
        echo -e "${YELLOW}Trader-AI (internal):${NC}  http://localhost:7007 (SSH tunnel required)"
        echo -e "  ${BLUE}ssh -L 7007:127.0.0.1:7007 user@$SERVER_IP${NC}"
        echo ""
    fi

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "View logs:           docker-compose logs -f perps-trader"
    echo "Check status:        docker-compose ps"
    echo "Restart service:     docker-compose restart perps-trader"
    echo "Stop all:            docker-compose down"
    echo "View resources:      docker stats"
    echo ""

    if [ "$HL_ENABLED" = "true" ]; then
        echo -e "${YELLOW}⚠ Trading is ENABLED${NC}"
        echo -e "Environment: ${GREEN}$HL_ENV${NC}"
        echo -e "Make sure you've tested thoroughly on testnet first!"
    else
        echo -e "${YELLOW}⚠ Trading is DISABLED${NC}"
        echo "Set HL_ENABLED=true in .env to enable trading"
    fi
    echo ""

    print_info "Check full documentation: docs/DEPLOYMENT.md"
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    clear

    print_header "Perps Trader Deployment Script"
    echo ""

    # Validation phase
    validate_dependencies
    validate_project_structure
    validate_env_file

    # Setup phase
    setup_clickhouse_password

    # Confirm before proceeding
    echo -e "${YELLOW}Ready to deploy. This will:${NC}"
    echo "  1. Build all Docker images"
    echo "  2. Start all services"
    echo "  3. Configure databases"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deployment cancelled"
        exit 0
    fi

    # Deployment phase
    build_services
    start_services
    check_service_health
    display_access_info

    print_success "Deployment completed successfully!"
}

# Run main function
main "$@"

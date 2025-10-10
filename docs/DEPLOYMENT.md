# VPS Deployment Guide

Comprehensive deployment guide for the perps-trader perpetual futures trading platform on a VPS using Docker Compose.

## 📋 Prerequisites

- VPS with Ubuntu 20.04+ (minimum 4GB RAM, 40GB disk)
- SSH access to your VPS
- Docker and Docker Compose installed
- MongoDB Atlas account (for database)
- API keys for external services

## 🚀 Quick Deployment

### 1. Setup Project Structure

```bash
mkdir trading-platform
cd trading-platform

# Clone all repositories
git clone <perps-trader-repo-url> perps-trader
git clone <trader-ai-repo-url> trader-ai
git clone <sol-indexer-repo-url> sol-indexer

# Navigate to main directory
cd perps-trader
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your actual values
nano .env
```

### 3. Deploy Full Stack

```bash
# Make deployment script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

That's it! The script will:

- Validate your setup
- Check for required external services
- Deploy all services (perps-trader, trader-ai, sol-indexer, databases)
- Show you access information

## 🛠️ Manual Deployment

If you prefer manual control:

```bash
# Build and start all services
docker-compose build
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f perps-trader
```

## 📊 Service Access

After deployment, you can access:

- **Perps Trader API**: `http://your-vps-ip:7777`
- **Sol-Indexer WebSocket**: `ws://your-vps-ip:7070`
- **Sol-Indexer API**: `http://your-vps-ip:7071`
- **ClickHouse**: `http://your-vps-ip:8123`
- **Trader-AI**: Internal only (use SSH tunnel)
- **Datadog Agent**: Internal APM (if enabled)

### Accessing Trader-AI

Trader-AI runs internally for security. To access it:

```bash
# Create SSH tunnel
ssh -L 7007:127.0.0.1:7007 user@your-vps-ip

# Then access locally
curl http://localhost:7007/health
```

## 🔧 Management Commands

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs -f perps-trader
docker-compose logs -f sol-indexer
docker-compose logs -f trader-ai

# Restart a service
docker-compose restart perps-trader

# Stop all services
docker-compose down

# Full restart (rebuild)
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# View resource usage
docker stats

# Clean up old containers and images
docker system prune -a
```

## 🔒 Security Configuration

### Firewall Setup

```bash
# Allow SSH
sudo ufw allow ssh

# Allow application ports
sudo ufw allow 7777  # Perps Trader API
sudo ufw allow 7070  # Sol-Indexer WebSocket (optional)
sudo ufw allow 7071  # Sol-Indexer API (optional)
sudo ufw allow 8123  # ClickHouse (optional, internal only recommended)

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### SSL Setup (Recommended for Production)

For production with domain:

```bash
# Install certbot and nginx
sudo apt update
sudo apt install certbot nginx

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure nginx reverse proxy
sudo nano /etc/nginx/sites-available/perps-trader
```

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:7777;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/perps-trader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔧 Configuration

### Required Environment Variables

```bash
# ============================================================================
# CORE APPLICATION
# ============================================================================
APP_PORT=7777
APP_HOST=0.0.0.0
ENVIRONMENT=production

# MongoDB Atlas (REQUIRED)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/perps-trader?retryWrites=true&w=majority

# ============================================================================
# HYPERLIQUID TRADING (REQUIRED for trading)
# ============================================================================
HL_ENABLED=true                    # Set to true to enable trading
HL_ENV=testnet                     # testnet or mainnet
HL_API_URL=https://api.hyperliquid-testnet.xyz
HL_INFO_URL=https://api.hyperliquid-testnet.xyz/info

# Wallet Configuration (Get encrypted key using encryptPrivateKey utility)
HL_ADDRESS=your_wallet_address
HL_PRIVATE_KEY=your_encrypted_private_key
HL_KEY_SECRET=your_encryption_secret

# Trading Parameters
HL_DEFAULT_LEVERAGE=3              # Default leverage (1-50)
HL_MAX_OPEN_POSITIONS=1            # Maximum concurrent positions
HL_STOP_LOSS_PERCENT=10            # Stop loss percentage
HL_TAKE_PROFIT_PERCENT=20          # Take profit percentage
HL_DEFAULT_AMOUNT_IN=100           # Default trade size in USDC

# Risk Management
HL_MAX_LEVERAGE_PER_SYMBOL=10      # Maximum leverage per symbol
HL_MAX_NOTIONAL_PER_ORDER=10000    # Maximum notional per order
HL_MAX_TOTAL_NOTIONAL=50000        # Maximum total notional across all positions

# ============================================================================
# EXTERNAL SERVICES
# ============================================================================

# Sol-Indexer (REQUIRED for price feeds)
INDEXER_HOST=sol-indexer
INDEXER_WS_PORT=7070
INDEXER_API_PORT=7071
CHAINSTREAM_API_KEY=your_syndica_chainstream_api_key

# Trader-AI (OPTIONAL for AI predictions)
PREDICTOR_URL=http://trader-ai
PREDICTOR_PORT=7007
TRADER_AI_API_KEY=optional_api_key

# ClickHouse (Used by indexer and AI services)
CLICKHOUSE_USERNAME=default
CLICKHOUSE_PASSWORD=secure_password_here
CLICKHOUSE_DATABASE=atrader

# ============================================================================
# DATADOG MONITORING (OPTIONAL)
# ============================================================================
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
DD_SITE=datadoghq.eu

# ============================================================================
# SERVICE PATHS (FOR DOCKER COMPOSE)
# ============================================================================
TRADER_AI_PATH=../trader-ai
SOL_INDEXER_PATH=../sol-indexer
```

### Encrypting Your Private Key

**IMPORTANT**: Never store unencrypted private keys in environment variables!

```bash
# Inside the perps-trader container or locally with Node.js
node -e "
const crypto = require('crypto-js');
const privateKey = 'your_raw_private_key_here';
const secret = 'your_secure_random_secret_here';
const encrypted = crypto.AES.encrypt(privateKey, secret).toString();
console.log('Encrypted key:', encrypted);
"
```

Use the encrypted output as `HL_PRIVATE_KEY` and your secret as `HL_KEY_SECRET`.

## 🚨 Troubleshooting

### Common Issues

1. **Services not starting**

   ```bash
   # Check logs for errors
   docker-compose logs perps-trader
   docker-compose logs sol-indexer

   # Check if ports are available
   sudo netstat -tulpn | grep :7777
   sudo netstat -tulpn | grep :7070
   sudo netstat -tulpn | grep :7071
   ```

2. **MongoDB connection errors**

   ```bash
   # Verify MongoDB URI format
   # Check MongoDB Atlas network access (whitelist VPS IP)
   # Check MongoDB Atlas user credentials

   # Test connection
   docker-compose exec perps-trader sh -c "curl -v $MONGODB_URI"
   ```

3. **Sol-Indexer not connecting**

   ```bash
   # Check Chainstream API key
   docker-compose logs sol-indexer

   # Verify sol-indexer is healthy
   docker-compose ps sol-indexer
   curl http://localhost:7071/health
   ```

4. **Out of memory**

   ```bash
   # Check memory usage
   free -h

   # Check Docker usage
   docker stats

   # Consider upgrading VPS or reducing max open positions
   ```

5. **Hyperliquid connection errors**

   ```bash
   # Verify network connectivity
   curl -v https://api.hyperliquid-testnet.xyz/info

   # Check wallet configuration
   docker-compose logs perps-trader | grep -i "hyperliquid"

   # Verify private key decryption
   docker-compose logs perps-trader | grep -i "wallet"
   ```

6. **Missing external service repositories**

   ```bash
   # Check if trader-ai and sol-indexer directories exist
   ls ../trader-ai
   ls ../sol-indexer

   # If missing, clone them
   cd ..
   git clone <trader-ai-repo> trader-ai
   git clone <sol-indexer-repo> sol-indexer
   cd perps-trader
   ```

### Health Checks

```bash
# Perps Trader health
curl -f http://localhost:7777/health

# Sol-Indexer health
curl -f http://localhost:7071/health

# ClickHouse health
curl -f http://localhost:8123/ping

# Check all container health
docker-compose ps
```

### Debug Mode

```bash
# Run with debug logging
docker-compose down
docker-compose up perps-trader

# Or set LOG_LEVEL=debug in .env
LOG_LEVEL=debug docker-compose up -d perps-trader
```

## 📊 Monitoring

### Resource Usage

```bash
# System resources
htop

# Docker resources
docker stats

# Disk usage
df -h
du -sh /var/lib/docker

# Log file sizes
du -sh logs/
```

### Application Logs

```bash
# Real-time logs for perps-trader
docker-compose logs -f perps-trader

# Last 100 lines
docker-compose logs --tail=100 perps-trader

# Logs with timestamps
docker-compose logs -t perps-trader

# All services
docker-compose logs -f

# Export logs to file
docker-compose logs perps-trader > perps-trader-logs.txt
```

### Trading Metrics

```bash
# Check open positions
curl http://localhost:7777/api/positions

# Check recent trades
curl http://localhost:7777/api/trades

# Check application health
curl http://localhost:7777/health
```

### Datadog Monitoring (Optional)

If Datadog is configured:

1. Visit your Datadog dashboard
2. Navigate to APM > Services
3. Find `perps-trader` service
4. Monitor:
   - Request rates and latencies
   - Error rates
   - Trade execution metrics
   - Position management operations

## 🔄 Updates and Maintenance

### Updating the Application

```bash
# Navigate to perps-trader directory
cd /path/to/perps-trader

# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache perps-trader
docker-compose up -d

# Check logs
docker-compose logs -f perps-trader
```

### Updating External Services

```bash
# Update sol-indexer
cd ../sol-indexer
git pull origin main
cd ../perps-trader
docker-compose build --no-cache sol-indexer
docker-compose up -d sol-indexer

# Update trader-ai
cd ../trader-ai
git pull origin main
cd ../perps-trader
docker-compose build --no-cache trader-ai
docker-compose up -d trader-ai
```

### Database Maintenance

```bash
# Backup MongoDB (from MongoDB Atlas dashboard)
# or using mongodump for self-hosted MongoDB

# Clean up old ClickHouse data (if needed)
docker-compose exec clickhouse clickhouse-client --query "
  OPTIMIZE TABLE atrader.pump_fun_trades FINAL;
"

# Check ClickHouse disk usage
docker-compose exec clickhouse du -sh /var/lib/clickhouse
```

### Log Rotation

Docker automatically handles log rotation with the configuration in docker-compose.yml:

```yaml
logging:
  driver: 'json-file'
  options:
    max-size: '50m'
    max-file: '3'
```

To manually clean up old logs:

```bash
# Clean up Docker logs
docker system prune -a --volumes

# Or clean specific service logs
truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

## 🔐 Security Best Practices

### 1. Private Key Management

- ✅ Always encrypt private keys using crypto-js
- ✅ Never commit private keys to version control
- ✅ Use strong encryption secrets (minimum 32 characters)
- ✅ Rotate keys periodically
- ❌ Never expose unencrypted keys in environment variables
- ❌ Never share keys in logs or error messages

### 2. API Key Security

- ✅ Store API keys in `.env` file (add to `.gitignore`)
- ✅ Use different API keys for testnet and mainnet
- ✅ Rotate API keys periodically
- ✅ Monitor API key usage for suspicious activity

### 3. Network Security

- ✅ Use firewall (UFW) to restrict access
- ✅ Only expose necessary ports (7777 for API)
- ✅ Use SSH key authentication (disable password auth)
- ✅ Keep internal services (ClickHouse, Redis) unexposed
- ✅ Use SSL/TLS for production (nginx reverse proxy)

### 4. MongoDB Security

- ✅ Use MongoDB Atlas with IP whitelist
- ✅ Use strong passwords
- ✅ Enable MongoDB encryption at rest
- ✅ Regular backups
- ✅ Monitor database access logs

### 5. Docker Security

- ✅ Run containers as non-root user (already configured)
- ✅ Keep Docker and images updated
- ✅ Scan images for vulnerabilities
- ✅ Limit container resources (memory, CPU)

## 📈 Production Checklist

Before going to production:

- [ ] Test thoroughly on testnet first
- [ ] Set `HL_ENV=mainnet` and update API URLs
- [ ] Use real mainnet wallet with encrypted keys
- [ ] Configure appropriate risk parameters
- [ ] Set up SSL/TLS with nginx
- [ ] Configure firewall rules
- [ ] Enable Datadog monitoring (recommended)
- [ ] Set up MongoDB Atlas with backups
- [ ] Configure log aggregation
- [ ] Set up alerting (Datadog, PagerDuty, etc.)
- [ ] Document runbook for common issues
- [ ] Test recovery procedures
- [ ] Set up health check monitoring
- [ ] Configure auto-restart policies
- [ ] Review and adjust position limits
- [ ] Test stop-loss and take-profit logic

## 📞 Support

For issues:

1. Check service logs: `docker-compose logs [service]`
2. Check system resources: `htop`, `docker stats`, `df -h`
3. Verify environment configuration: `.env` file
4. Check project structure: trader-ai and sol-indexer directories
5. Review health endpoints: `/health` on all services
6. Check MongoDB Atlas connectivity
7. Verify Hyperliquid API connectivity

### Common Commands Reference

```bash
# Start everything
docker-compose up -d

# Stop everything
docker-compose down

# Restart perps-trader only
docker-compose restart perps-trader

# View perps-trader logs
docker-compose logs -f perps-trader

# Check container status
docker-compose ps

# Execute command in container
docker-compose exec perps-trader sh

# Check resource usage
docker stats

# Clean up Docker
docker system prune -a

# Full rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

**Fast, reliable, and secure VPS deployment for the perps-trader perpetual futures trading platform.**

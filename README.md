# Perps Trader

A lean, production-ready perpetual futures trading service focused on Hyperliquid platform with AI-powered predictions and multi-platform architecture for future expansion.

## Overview

Perps Trader is a simplified, perps-only trading application that integrates:

- **Hyperliquid Trading**: Perpetual futures trading on Hyperliquid testnet/mainnet
- **AI Integration**: Optional AI predictions via external trader-ai service
- **Real-time Data**: Price feeds and market data via sol-indexer service
- **Automated Execution**: Scheduled trading jobs with position monitoring
- **Clean Architecture**: Modular design for easy platform expansion

## Architecture

- **NestJS Backend**: TypeScript-based API with dependency injection
- **MongoDB**: Primary data store for trades, positions, and settings
- **NestJS Schedule**: Cron jobs for trade monitoring and execution
- **Datadog APM**: Optional monitoring and observability
- **Docker**: Containerized deployment with health checks

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- MongoDB Atlas connection string
- Hyperliquid wallet credentials

### Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

### Docker Deployment

```bash
# Copy environment template
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Check health
curl http://localhost:7777/health
```

## Configuration

### Environment Variables

#### Core Application

- `APP_PORT=7777` - API server port
- `APP_HOST=0.0.0.0` - API server host
- `MONGODB_URI` - MongoDB Atlas connection string
- `ENVIRONMENT=production` - Application environment

#### Hyperliquid Trading

- `HL_ENABLED=false` - Enable/disable Hyperliquid trading
- `HL_ENV=testnet` - Hyperliquid environment (testnet/mainnet)
- `HL_API_URL` - Hyperliquid API endpoint
- `HL_ADDRESS` - Trading wallet address
- `HL_PRIVATE_KEY` - Encrypted wallet private key
- `HL_KEY_SECRET` - Encryption key for private key
- `HL_DEFAULT_LEVERAGE=3` - Default trading leverage
- `HL_MAX_OPEN_POSITIONS=1` - Maximum concurrent positions

#### External Services (Optional)

- `PREDICTOR_URL=http://trader-ai` - AI predictor service URL
- `INDEXER_HOST=sol-indexer` - Price indexer service host
- `DD_API_KEY` - Datadog API key for monitoring

See `.env.example` for complete configuration options.

## Trading Features

### Automated Trading

- **AI-Driven Decisions**: Integrates with external AI predictions
- **Risk Management**: Configurable stop-loss and take-profit levels
- **Position Monitoring**: Real-time position tracking and management
- **Multi-Asset Support**: Trade multiple perpetual futures

### Platform Management

- **Hyperliquid Integration**: Native support for Hyperliquid perps
- **Extensible Architecture**: Easy to add new trading platforms
- **Strategy Framework**: Pluggable trading strategy system

## API Endpoints

- `GET /` - Application status
- `GET /health` - Health check
- `GET /version` - Application version

## Development

### Project Structure

```
src/
  app/
    hyperliquid/         # Hyperliquid platform integration
    perps/               # Perpetual futures domain logic
    platform-manager/    # Multi-platform trading abstraction
    trade/              # Core trading functionality
    trade-manager/      # Trade orchestration and management
    trade-position/     # Position tracking and lifecycle
    indexer/            # Price feed integration
    predictor/          # AI prediction integration
    jobs/               # Scheduled trading jobs
  config/               # Application configuration
  infrastructure/       # External service adapters
  shared/              # Common utilities and models
```

### Key Components

- **TradeManagerService**: Orchestrates trading operations across platforms
- **HyperliquidService**: Handles Hyperliquid API integration and order execution
- **PlatformManagerService**: Manages multiple trading platform registrations
- **TradeMonitorScheduler**: Automated position monitoring and trade execution

### Testing

```bash
# Run all tests
yarn test

# Run integration tests
yarn test:integration

# Lint code
yarn lint

# Format code
yarn prettier:fix
```

## Deployment

### Production Deployment

1. **Configure Environment**: Update `.env` with production values
2. **Deploy Services**: Use Docker Compose for full-stack deployment
3. **Monitor Health**: Set up monitoring via `/health` endpoint
4. **Configure Alerts**: Set up Datadog alerts for trading operations

### Security Considerations

- **Key Encryption**: Private keys are encrypted using `crypto-js`
- **Environment Isolation**: Separate testnet/mainnet configurations
- **Health Monitoring**: Comprehensive health checks and logging
- **Non-root Container**: Docker runs as non-privileged user

## Integration

### External Services

- **trader-ai**: AI prediction service for trading signals
- **sol-indexer**: Real-time price feeds and market data
- **MongoDB Atlas**: Managed database for persistent storage
- **Datadog**: Optional APM and monitoring

### Adding New Platforms

The architecture supports adding new trading platforms:

1. Implement platform-specific service in `infrastructure/`
2. Create platform module in `app/`
3. Register platform in `PlatformManagerModule`
4. Configure platform-specific settings

## Support

For issues and questions:

- Check the [issues](https://github.com/your-org/perps-trader/issues) page
- Review configuration in `.env.example`
- Check logs via `docker-compose logs perps-trader`

## License

MIT License - see LICENSE file for details.

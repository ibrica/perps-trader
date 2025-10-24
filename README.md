# Perps Trader

A lean, production-ready perpetual futures trading service focused on Hyperliquid platform with AI-powered predictions and multi-platform architecture for future expansion.

## Overview

Perps Trader is a simplified, perps-only trading application that integrates:

- **Hyperliquid Trading**: Perpetual futures trading on Hyperliquid testnet/mainnet
- **AI Integration**: Optional AI predictions via external trader-ai service
- **Real-time Data**: Price feeds and market data via sol-indexer service
- **Automated Execution**: Scheduled trading jobs with position monitoring
- **Web Dashboard**: Next.js dashboard with Google OAuth for monitoring and control
- **Clean Architecture**: Modular design for easy platform expansion

## Architecture

- **NestJS Backend**: TypeScript-based API with dependency injection
- **Next.js Dashboard**: React-based web interface for monitoring and control
- **Google OAuth 2.0**: Secure authentication with email whitelist
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

# Start backend development server
yarn dev

# Start dashboard (in separate terminal)
yarn dashboard:dev

# Build for production
yarn build
yarn dashboard:build
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

#### Dashboard & Authentication

- `GOOGLE_CLIENT_ID` - Google OAuth 2.0 client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth 2.0 client secret
- `GOOGLE_CALLBACK_URL` - OAuth callback URL (default: http://localhost:7777/api/auth/google/callback)
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_EXPIRATION=7d` - JWT token expiration time
- `ALLOWED_EMAILS` - Comma-separated list of authorized email addresses
- `DASHBOARD_URL=http://localhost:3000` - Dashboard frontend URL for OAuth redirect

#### External Services

- `PREDICTOR_URL=http://trader-ai` - AI predictor service URL (optional)
- `INDEXER_HOST=sol-indexer` - Price indexer service host (required for OHLCV data)
- `INDEXER_API_PORT=7071` - Indexer API port
- `DD_API_KEY` - Datadog API key for monitoring (optional)

#### Entry Timing & Extreme Tracking (NEW)

- `HL_ENTRY_TIMING_ENABLED=true` - Enable multi-timeframe entry timing
- `HL_ENTRY_TIMING_USE_REAL_EXTREMES=true` - Use OHLCV-based extreme tracking
- `HL_ENTRY_TIMING_EXTREME_LOOKBACK_MINUTES=60` - Lookback period for extremes

See `.env.example` for complete configuration options.

## Trading Features

### Automated Trading

- **AI-Driven Decisions**: Integrates with external AI predictions with confidence thresholds
- **Entry Timing Optimization**: Multi-timeframe trend analysis with real OHLCV extreme tracking
- **Risk Management**: Configurable stop-loss, take-profit, and trailing stops
- **Position Monitoring**: Real-time position tracking and management
- **Multi-Asset Support**: Trade multiple perpetual futures

### Platform Management

- **Hyperliquid Integration**: Native support for Hyperliquid perps
- **Extensible Architecture**: Easy to add new trading platforms
- **Strategy Framework**: Pluggable trading strategy system

## Dashboard

The web-based dashboard provides comprehensive monitoring and control capabilities:

### Features

- **Real-time Analytics**: PnL tracking, win rates, position metrics
- **Position Management**: View and control open/closed positions
- **Configuration**: Manage perp settings and trading parameters
- **Trading Control**: Emergency halt via closeAllPositions toggle
- **Secure Access**: Google OAuth 2.0 with email whitelist

### Quick Start

```bash
# Terminal 1 - Start backend
yarn dev

# Terminal 2 - Start dashboard
yarn dashboard:dev

# Access dashboard at http://localhost:3000
```

### Setup

1. **Configure Google OAuth**: Create OAuth credentials in Google Cloud Console
2. **Set Environment Variables**: Add credentials and allowed emails to `.env`
3. **Start Services**: Run backend and dashboard
4. **Access Dashboard**: Navigate to http://localhost:3000

See [docs/dashboard.md](docs/dashboard.md) for complete documentation.

## API Endpoints

### Core

- `GET /` - Application status
- `GET /health` - Health check
- `GET /version` - Application version

### Dashboard API

- `GET /api/dashboard/analytics` - Trading analytics and metrics
- `GET /api/dashboard/positions` - Position tracking and management
- `PATCH /api/dashboard/positions/:id` - Update position (exit flag)
- `GET /api/dashboard/perps` - Perp configuration
- `PATCH /api/dashboard/perps/:id` - Update perp settings
- `GET /api/dashboard/settings` - System settings
- `PATCH /api/dashboard/settings` - Update settings (trading halt)

### Authentication

- `GET /api/auth/google` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler
- `GET /api/auth/me` - Get current user profile

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
    dashboard/          # Dashboard API endpoints
    auth/               # Google OAuth & JWT authentication
    indexer/            # Price feed integration
    predictor/          # AI prediction integration
    jobs/               # Scheduled trading jobs
  dash/                 # Next.js dashboard frontend
    pages/              # Dashboard pages
    components/         # React components
    services/           # API client
    types/              # TypeScript types
    styles/             # CSS styles
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
- **OAuth Authentication**: Google OAuth 2.0 with email whitelist
- **JWT Tokens**: Secure session management with expiring tokens
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

## Documentation

- [Dashboard Guide](docs/dashboard.md) - Complete dashboard documentation
- [Trade Decision Flow](docs/trade-decision-flow.md) - Trading logic and decision process
- [Extreme Tracking Feature](docs/extreme-tracking-feature.md) - OHLCV-based entry timing

## Support

For issues and questions:

- Check the [issues](https://github.com/your-org/perps-trader/issues) page
- Review configuration in `.env.example`
- Check logs via `docker-compose logs perps-trader`
- See [docs/dashboard.md](docs/dashboard.md) for dashboard-specific issues

## License

MIT License - see LICENSE file for details.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Perps Trader - Lean Perpetual Futures Trading Platform

## Overview

Perps Trader is a lean, production-ready perpetual futures trading service focused on Hyperliquid platform with AI-powered predictions and multi-platform architecture for future expansion. The application has been simplified from a complex multi-platform Solana trading system into a focused perps-only trader.

## Core Architecture

### Technology Stack

- **Backend**: NestJS (Node.js framework)
- **Database**: MongoDB (primary)
- **Scheduling**: NestJS Schedule (@nestjs/schedule) for cron jobs
- **Trading Platform**: Hyperliquid (perpetual futures)
- **External Services**: Predictor (AI), Indexer (price feeds)
- **Monitoring**: Datadog integration (optional)

### Service Architecture

The application follows a simplified modular architecture with core trading services:

1. **Main Trading Service** (`perps-trader`) - Core trading engine and API
2. **AI Trading Service** (`trader-ai`) - External AI-powered analysis and predictions
3. **Price Indexer** (`sol-indexer`) - External real-time price data indexing
4. **Infrastructure Services**: MongoDB, optional Datadog

## Core Functionality

### 1. Hyperliquid Trading Only

The platform is focused exclusively on Hyperliquid perpetual futures trading:

- **Hyperliquid Perps** - Main and only trading platform
- **Position Management** - Real-time position tracking and lifecycle
- **Risk Management** - Configurable leverage, stop-loss, take-profit
- **Market Orders** - IOC (Immediate or Cancel) execution

### 2. Trading Engine Components

#### Trade Manager Service

- Orchestrates trading operations on Hyperliquid
- Manages trade positions and lifecycle
- Handles entry/exit decisions based on AI predictions
- Monitors real-time market data and executes trades

#### Hyperliquid Service

- **HyperliquidService**: Handles API integration and order execution
- **HyperliquidTradingStrategy**: AI-powered entry/exit decision logic
- **HyperliquidTokenDiscovery**: Token/symbol discovery and mapping

#### Job Scheduling

- **TradeMonitorScheduler**: NestJS Schedule-based cron job (every minute)
- **Distributed Locking**: MongoDB-based locks to prevent duplicate execution
- **Position Monitoring**: Continuous monitoring and automated closing

### 3. AI Integration

- **PredictorModule**: Integrates with external trader-ai service for trading signals
- **HTTP-based**: Simple REST API integration for predictions

### 4. External Service Integration

#### Price Data Provider

- **IndexerModule**: Connects to external sol-indexer service
- **WebSocket**: Real-time price feeds
- **HTTP API**: Price queries and market data
- **Required**: Critical for trading decisions

#### AI Predictions

- **PredictorAdapter**: HTTP client for trader-ai service
- **Optional**: Trading can operate without AI predictions
- **REST API**: Simple request/response for trade signals

### 5. Data Management

#### Database

- **MongoDB**: Primary data store for trades, positions, settings
- **No ClickHouse**: Removed time-series database dependency
- **No Redis**: Removed caching and message queue dependency

#### Models

- **Trade**: Trade execution records
- **TradePosition**: Active position tracking
- **Perp**: Perpetual futures definitions
- **Settings**: Application configuration

### 6. Configuration and Settings

#### Environment Configuration

- **Simplified configs**: Only essential services
- **Hyperliquid config**: API URLs, wallet credentials, trading parameters
- **External services**: Predictor and indexer endpoints
- **Security**: Encrypted private keys with crypto-js

#### Trading Parameters

- Default leverage, position limits, risk management
- Stop-loss and take-profit percentages
- Maximum notional amounts and position counts

### 7. Job Processing

#### NestJS Schedule

- **TradeMonitorScheduler**: Replaces complex Bull/Redis queue system
- **Cron pattern**: `* * * * *` (every minute)
- **Distributed locks**: MongoDB-based to prevent duplicate execution
- **Simple and reliable**: No external queue dependencies

#### Background Tasks

- **Position monitoring**: Check and close positions based on conditions
- **Trade execution**: Start new trading when position count is low
- **Health monitoring**: Service health and connectivity checks

### 8. Security and Risk Management

#### Wallet Security

- **Encrypted keys**: Private keys encrypted with crypto-js
- **Environment secrets**: Secure environment variable management
- **No hardcoded credentials**: All sensitive data via environment

#### Trading Risk

- **Position limits**: Maximum open positions and notional amounts
- **Leverage controls**: Per-symbol and global leverage limits
- **Stop-loss protection**: Automatic position closing on adverse moves

### 9. Deployment and Operations

#### Docker Deployment

- **Single service**: Simplified from multi-service architecture
- **External dependencies**: Connects to external AI and indexer services
- **Health checks**: Built-in health monitoring
- **Production ready**: Optimized Dockerfile and docker-compose

#### Monitoring

- **Datadog integration**: Optional APM and logging
- **Health endpoints**: `/health`, `/version` for monitoring
- **Structured logging**: Winston-based logging with levels

## Key Features

### Automated Trading

- **AI-driven decisions**: Automated entry/exit based on external predictions
- **Position management**: Real-time position tracking and management
- **Risk management**: Configurable risk parameters
- **Hyperliquid focus**: Single platform for maximum reliability

### Real-time Operations

- **Price monitoring**: Real-time price feeds from indexer service
- **Position monitoring**: Continuous position health checks
- **Performance tracking**: Real-time profit/loss tracking
- **Service health**: Automated health monitoring

### Clean Architecture

- **Modular design**: Feature-based module organization
- **Simplified dependencies**: Minimal external requirements
- **Type safety**: Comprehensive TypeScript usage
- **Production ready**: Docker, health checks, monitoring

## Essential Development Commands

### Core Development

```bash
# Install dependencies and start development
yarn install
yarn dev                   # Start NestJS backend with hot reload

# Build and production
yarn build                 # Build the NestJS application
yarn start:prod           # Start built application
```

### Testing

```bash
# Run all tests
yarn test                 # Jest with custom configuration
yarn test:integration     # Integration tests

# Clean up
yarn clean               # Remove dist and cache files
```

### Code Quality

```bash
# Linting and formatting
yarn lint                 # ESLint check
yarn lint:fix             # Auto-fix linting issues
yarn prettier             # Check formatting
yarn prettier:fix         # Auto-format all files
```

### Docker Operations

```bash
# Local development
docker-compose up -d              # Start all services
docker-compose down              # Stop all services
docker-compose logs perps-trader # View application logs
```

## Important Architecture Patterns

### Module Structure

Clean NestJS modular architecture:

- **App Modules** (`src/app/`): Core business logic modules
- **Infrastructure** (`src/infrastructure/`): External service adapters
- **Jobs** (`src/app/jobs/`): NestJS Schedule-based cron jobs
- **Shared** (`src/shared/`): Common utilities, constants, and types

### Path Aliases (TypeScript)

Clean import paths using TypeScript path mapping:

```typescript
@perps/*          // src/*
@perps-app/*      // src/app/*
@perps-shared/*   // src/shared/*
@perps-infra/*    // src/infrastructure/*
```

### Key Architectural Components

**Trading Flow:**

1. **TradeMonitorScheduler** runs every minute via NestJS Schedule
2. **TradeManagerService** orchestrates all trading operations
3. **HyperliquidService** handles platform-specific interactions
4. **PredictorModule** gets AI predictions
5. **IndexerModule** provides real-time price data (required)

**Service Dependencies:**

- MongoDB for persistent data
- External AI service (trader-ai) for predictions
- External indexer service (sol-indexer) for price feeds
- Optional Datadog for monitoring

### Configuration Management

Simplified configuration with essential services only:

- `src/config/app.config.ts` - Core application settings
- `src/config/hyperliquid.config.ts` - Trading platform configuration
- `src/config/predictor.config.ts` - AI service integration
- `src/config/indexer.config.ts` - Price feed integration
- `src/config/dd-config.ts` - Optional Datadog configuration

### Error Handling Strategy

Simple error hierarchy in `src/shared/`:

- **Domain-specific exceptions** for business logic
- **Service-level error handling** for external API calls
- **Comprehensive logging** with Winston

### Testing Patterns

- **Unit tests** for business logic
- **Integration tests** with MongoDB
- **Service mocking** for external dependencies
- **Path aliases** supported in Jest configuration

### Monitoring and Observability

- **Optional Datadog integration** with distributed tracing
- **Health checks** for service monitoring
- **Structured logging** with Winston
- **Performance monitoring** for trading operations

## Development Guidelines

### Trading Safety

- **Never commit private keys** - Use encrypted keys only
- **Test on testnet first** - Always validate on Hyperliquid testnet
- **Monitor positions carefully** - Set appropriate risk limits
- **Validate AI predictions** - Don't blindly trust external signals

### Code Standards

- **TypeScript strict mode** - Comprehensive type safety
- **ESLint + Prettier** - Consistent code formatting
- **Modular design** - Keep components focused and testable
- **Clean imports** - Use path aliases for clean code

### External Service Integration

- **Graceful degradation** - Handle service outages
- **Retry logic** - Implement appropriate retry strategies
- **Health monitoring** - Monitor external service health
- **Fallback strategies** - Operate when optional services are down

# Important Reminders

- **Lean and focused**: This is a simplified perps-only trader
- **Hyperliquid only**: Single platform for maximum reliability
- **External dependencies**: AI and indexer services are external
- **No Redis/ClickHouse**: Simplified to MongoDB only
- **NestJS Schedule**: Simple cron jobs, no message queues
- **Production ready**: Docker, monitoring, health checks included

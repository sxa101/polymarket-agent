# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server (serves static files)
npm run dev      # Start Python HTTP server on port 8000
npm start        # Same as npm run dev

# Building & Validation
npm run build    # Lint project (just validates JS syntax)
npm run lint     # Validate JavaScript syntax across js/ directory

# Testing
npm run test            # Run Playwright end-to-end tests
npm run test:ui         # Run Playwright tests with UI interface
npm run test:debug      # Run tests in debug mode
npm run test:headed     # Run tests in headed browser mode
npm run install-playwright  # Install Playwright browsers
```

## Architecture Overview

This is a **browser-based Progressive Web App** for Polymarket prediction market trading that runs entirely client-side with no server dependencies.

### Core Architecture Layers

**Application Entry Point**: `js/app-working.js`
- Main orchestrator class `PolymarketTradingAgent`
- Dual-mode operation: Demo/Production switching via `ProductionConfig.FEATURES.DEMO_MODE`
- Component lifecycle management with comprehensive error handling

**Configuration Management**: `js/config/production-config.js`
- Centralized production configuration for API endpoints, network settings, trading limits
- Feature flags for demo mode, trading enablement, debug controls
- Rate limiting, security settings, and risk parameters

**Data Layer**: `js/data/database.js`
- IndexedDB wrapper with 9 object stores: markets, priceHistory, strategies, orders, trades, performance, userConfig, alertRules, alertHistory
- Advanced indexing and query capabilities for efficient data retrieval

**API Integration**: `js/core/`
- Dual API system: Demo (`polymarket-api.js`) and Production (`real-polymarket-api.js`)
- Real-time WebSocket manager for live market data (`real-websocket-manager.js`)
- Web3 wallet integration via MetaMask (`wallet-manager.js`)

**Trading Engine**: `js/trading/`
- Multi-strategy trading execution (`trading-engine.js`, `strategy-manager.js`)
- Advanced order management with production safety features (`order-manager.js`)
- Smart order execution algorithms (`smart-orders.js`)
- Real-time market analysis and opportunity scoring (`market-analyzer.js`)
- Comprehensive risk management with position sizing (`risk-manager.js`)

**Security & Monitoring**: `js/security/`, `js/monitoring/`
- Enterprise-grade security with AES-256 encryption
- System health monitoring and real-time diagnostics
- Privacy controls with GDPR compliance

### Key Architectural Patterns

**Event-Driven Design**: Custom EventEmitter system for component communication
**Component-Based**: Clear separation with dependency injection for testing
**Progressive Web App**: Service Worker (`sw.js`) with intelligent caching strategies
**Dual-Mode Operation**: Seamless switching between demo and production environments

### Technology Integration

- **Blockchain**: Polygon network (Mainnet/Mumbai testnet)
- **Web3**: MetaMask integration with EIP-712 signatures
- **Storage**: IndexedDB for persistent client-side data
- **Real-time**: WebSocket connections for live market data
- **PWA**: Service Worker with manifest.json for native app experience

### Production Configuration

The system uses comprehensive production configuration in `js/config/production-config.js`:
- **API Endpoints**: Real Polymarket CLOB API, Gamma API, WebSocket streams
- **Trading Controls**: Position sizing, daily loss limits, slippage controls
- **Security**: Wallet validation, transaction timeouts, rate limiting
- **Feature Toggles**: Demo mode, trading enablement, debug modes

### Data Flow

```
Market Data → API Layer → Database → Trading Engine → Strategy Execution
     ↓            ↓           ↓            ↓              ↓
WebSocket → Real-time UI ← Event Bus ← Risk Manager ← Order Management
```

### Testing Strategy

Uses Playwright for comprehensive browser testing across Chrome, Firefox, and Safari with UI, debug, and headed test modes available.

### Key Development Notes

- No build step required - uses ES6 modules directly in browser
- Demo mode provides safe testing with simulated data
- Production mode requires MetaMask wallet connection
- All trading logic includes comprehensive safety checks and rate limiting
- Component initialization is tracked with detailed status reporting
- Error handling includes graceful fallbacks and recovery mechanisms
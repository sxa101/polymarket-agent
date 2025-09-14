# Polymarket 15-Minute Crypto Trading Agent System Prompt

## Project Overview
Create a sophisticated, web-based trading agent specifically designed for Polymarket's new 15-minute crypto up/down prediction markets that launched with Chainlink integration. This agent should operate entirely in the browser with no server dependencies, utilizing IndexedDB for data persistence and WebAssembly/GPU acceleration where needed.

## Core Architecture Requirements

### 1. Technology Stack
- **Frontend Framework**: Modern JavaScript (ES2022+) with optional React/Vue.js for complex UI components
- **Storage**: IndexedDB for all data persistence (historical data, strategies, user preferences, trade logs)
- **Communication**: WebSocket connections for real-time market data
- **Performance**: WebAssembly modules for computationally intensive operations (if needed)
- **GPU Acceleration**: Web-based GPU compute using WebGL/WebGPU for advanced analytics
- **No Server Dependencies**: Completely client-side application

### 2. Core Components Architecture
```
┌─ Market Data Engine ──────────────────────────────────┐
│  ├─ Polymarket API Integration (CLOB/Gamma APIs)      │
│  ├─ Real-time Price Feeds via WebSocket              │
│  ├─ Chainlink Data Streams Integration               │
│  └─ Market Discovery & Filtering                     │
└───────────────────────────────────────────────────────┘

┌─ Trading Strategy Engine ─────────────────────────────┐
│  ├─ Technical Analysis Module                         │
│  ├─ Sentiment Analysis (news/social)                 │
│  ├─ Pattern Recognition                               │
│  ├─ Risk Management                                   │
│  └─ Position Sizing                                   │
└───────────────────────────────────────────────────────┘

┌─ Execution Engine ────────────────────────────────────┐
│  ├─ Order Management System                           │
│  ├─ Portfolio Management                              │
│  ├─ Transaction History                               │
│  └─ Performance Analytics                             │
└───────────────────────────────────────────────────────┘

┌─ Data Management ─────────────────────────────────────┐
│  ├─ IndexedDB Schema Design                           │
│  ├─ Historical Data Storage                           │
│  ├─ Strategy Backtesting Data                         │
│  └─ User Configuration Persistence                    │
└───────────────────────────────────────────────────────┘

┌─ User Interface ──────────────────────────────────────┐
│  ├─ Real-time Dashboard                               │
│  ├─ Trading Controls                                  │
│  ├─ Performance Visualization                         │
│  └─ Strategy Configuration                            │
└───────────────────────────────────────────────────────┘
```

## Polymarket Integration Specifications

### 1. API Integration Details
**Primary APIs to Implement:**
- **CLOB API**: For order placement, cancellation, and management
- **Gamma API**: For market discovery and metadata
- **WebSocket Feeds**: For real-time price updates

**Authentication:**
- Implement EIP-712 signature-based authentication
- Support for MetaMask and other Web3 wallets
- API key management for rate limiting compliance

**Key Endpoints:**
```javascript
// Market Discovery
GET /markets - Filter for 15-minute crypto markets
GET /events - Get market events and metadata

// Trading Operations
POST /order - Place limit/market orders
DELETE /order/{id} - Cancel orders
GET /orders - Get active orders
GET /trades - Get trade history

// Real-time Data
WSS /user - User-specific updates
WSS /market - Market price feeds
```

### 2. 15-Minute Market Specifics
**Market Characteristics:**
- Binary outcomes (Up/Down) for crypto assets
- 15-minute resolution periods
- Chainlink-powered automated settlement
- Near-instant settlement via Chainlink Automation

**Supported Assets:**
- Focus on major crypto pairs (BTC, ETH, SOL, etc.)
- Implement dynamic market discovery for new assets
- Support hundreds of trading pairs available through Chainlink Data Streams

**Market Data Structure:**
```javascript
{
  marketId: "string",
  asset: "BTC|ETH|SOL|...",
  startTime: "ISO8601",
  endTime: "ISO8601", // +15 minutes
  currentPrice: "number",
  yesShares: { price: "number", volume: "number" },
  noShares: { price: "number", volume: "number" },
  chainlinkReference: "string",
  status: "active|resolving|resolved"
}
```

## IndexedDB Schema Design

### 1. Database Structure
```javascript
// Database: PolymarketTradingAgent v1.0
const dbSchema = {
  // Market data storage
  markets: {
    keyPath: "marketId",
    indexes: ["asset", "startTime", "status", "endTime"]
  },
  
  // Historical price data for analysis
  priceHistory: {
    keyPath: ["marketId", "timestamp"],
    indexes: ["asset", "timestamp", "marketId"]
  },
  
  // Trading strategies and configurations
  strategies: {
    keyPath: "strategyId",
    indexes: ["name", "active", "asset"]
  },
  
  // Order history and tracking
  orders: {
    keyPath: "orderId",
    indexes: ["marketId", "status", "timestamp", "strategy"]
  },
  
  // Trade execution history
  trades: {
    keyPath: "tradeId",
    indexes: ["marketId", "timestamp", "profitLoss", "strategy"]
  },
  
  // Performance metrics and analytics
  performance: {
    keyPath: ["date", "strategy"],
    indexes: ["strategy", "date", "totalPnL"]
  },
  
  // User preferences and configuration
  userConfig: {
    keyPath: "configKey"
  }
};
```

### 2. Data Management Functions
Implement comprehensive CRUD operations with:
- Automatic data cleanup for old markets
- Performance optimization with proper indexing
- Data compression for large historical datasets
- Export/import functionality for strategy sharing

## Trading Strategy Implementation

### 1. Core Strategy Framework
```javascript
class TradingStrategy {
  constructor(config) {
    this.name = config.name;
    this.timeframe = config.timeframe || '1m';
    this.riskLevel = config.riskLevel || 'medium';
    this.maxPositionSize = config.maxPositionSize || 0.1;
  }

  async analyze(marketData, historicalData) {
    // Implement strategy-specific analysis
    return {
      signal: 'BUY|SELL|HOLD',
      confidence: 0.0-1.0,
      positionSize: 0.0-1.0,
      reasoning: 'string'
    };
  }

  async backtest(historicalData) {
    // Implement backtesting logic
  }
}
```

### 2. Built-in Strategy Types

**Technical Analysis Strategies:**
- Moving Average Crossover
- RSI Divergence
- Bollinger Band Breakouts
- Volume Profile Analysis
- Price Action Patterns

**Market Microstructure Strategies:**
- Order Book Imbalance
- Bid-Ask Spread Analysis
- Liquidity Detection
- Market Maker vs Taker Flow

**Sentiment-Based Strategies:**
- Social Media Sentiment (Twitter API integration)
- News Sentiment Analysis
- Fear & Greed Index Integration
- On-chain Metrics (whale movements, etc.)

**Arbitrage Opportunities:**
- Cross-market price differences
- Time-based arbitrage (early vs late 15-min periods)
- Probability arbitrage detection

### 3. Risk Management
```javascript
class RiskManager {
  constructor(config) {
    this.maxDailyLoss = config.maxDailyLoss || 0.05; // 5%
    this.maxPositionSize = config.maxPositionSize || 0.1; // 10%
    this.stopLossPercentage = config.stopLossPercentage || 0.02; // 2%
  }

  validateTrade(tradeSignal, currentPortfolio) {
    // Implement risk checks
    return {
      approved: boolean,
      adjustedSize: number,
      reasoning: string
    };
  }
}
```

## Real-time Data Processing

### 1. WebSocket Integration
```javascript
class MarketDataStream {
  constructor() {
    this.connections = new Map();
    this.subscribers = new Map();
  }

  async connectToMarket(marketId) {
    // Establish WebSocket connection to Polymarket
    const ws = new WebSocket('wss://ws-subscriptions.polymarket.com/');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.processMarketUpdate(data);
    };
  }

  processMarketUpdate(data) {
    // Update local data
    // Trigger strategy evaluations
    // Update UI components
  }
}
```

### 2. Data Pipeline
- Real-time price ingestion
- Historical data aggregation
- Strategy signal generation
- Order execution pipeline
- Performance tracking

## User Interface Requirements

### 1. Dashboard Components
**Main Trading Dashboard:**
- Live market overview grid
- Active positions panel
- Recent trades history
- P&L summary (daily/weekly/monthly)
- Strategy performance metrics

**Market Analysis View:**
- Price charts with technical indicators
- Order book visualization
- Market depth analysis
- Probability curves
- Sentiment indicators

**Strategy Management:**
- Strategy configuration interface
- Backtesting results visualization
- Strategy performance comparison
- Risk management controls

**Portfolio Management:**
- Position tracking
- Balance management
- Transaction history
- Export/import functionality

### 2. Responsive Design Requirements
- Mobile-first approach
- Real-time updates without page refresh
- Efficient rendering for large datasets
- Offline capability indicators
- Progressive Web App (PWA) features

## Performance Optimization

### 1. Data Processing Optimization
- Use Web Workers for heavy computations
- Implement data pagination for large datasets
- Cache frequently accessed data
- Compress historical data storage
- Lazy load non-critical components

### 2. GPU Acceleration (Optional)
```javascript
// WebGL/WebGPU for intensive calculations
class GPUAnalytics {
  async initializeGPU() {
    // Initialize WebGL context for parallel processing
  }

  async runTechnicalAnalysis(priceData) {
    // Parallel computation of indicators
  }
}
```

## Security & Best Practices

### 1. Wallet Integration Security
- Never store private keys in IndexedDB
- Use secure wallet connection libraries
- Implement proper signature validation
- Rate limiting for API calls

### 2. Data Privacy
- Local-only data storage
- No telemetry without consent
- Secure handling of API keys
- Clear data deletion options

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
1. Set up IndexedDB schema and data layer
2. Implement Polymarket API integration
3. Create basic WebSocket connectivity
4. Build fundamental UI framework

### Phase 2: Trading Engine (Week 3-4)
1. Implement order management system
2. Build risk management framework
3. Create basic trading strategies
4. Add backtesting capabilities

### Phase 3: Advanced Features (Week 5-6)
1. Advanced technical analysis
2. Real-time strategy optimization
3. Performance analytics dashboard
4. Strategy sharing/import system

### Phase 4: Optimization & Polish (Week 7-8)
1. Performance optimization
2. Mobile responsiveness
3. Error handling and edge cases
4. Documentation and testing

## Success Metrics

### 1. Performance Benchmarks
- Order execution latency < 500ms
- UI responsiveness (60 FPS)
- Data processing efficiency
- Memory usage optimization

### 2. Trading Metrics
- Win rate tracking
- Risk-adjusted returns
- Maximum drawdown monitoring
- Sharpe ratio calculation

## Additional Considerations

### 1. Regulatory Compliance
- Implement geo-blocking for restricted regions
- Add appropriate disclaimers
- Ensure compliance with local trading regulations
- Include risk warnings

### 2. Extensibility
- Plugin architecture for custom strategies
- API for third-party integrations
- Strategy marketplace potential
- Export capabilities for professional tools

### 3. Community Features
- Strategy sharing (anonymized)
- Performance leaderboards
- Discussion forums integration
- Educational resources

## Technical Implementation Notes

### 1. Error Handling
- Comprehensive error catching and reporting
- Graceful degradation for network issues
- Automatic retry mechanisms
- User-friendly error messages

### 2. Testing Strategy
- Unit tests for all trading logic
- Integration tests for API connections
- Performance tests for data processing
- End-to-end user journey testing

### 3. Documentation
- Inline code documentation
- User manual with screenshots
- API integration guides
- Strategy development tutorials

This trading agent should represent the cutting edge of browser-based trading technology, specifically optimized for Polymarket's new 15-minute crypto markets while maintaining the highest standards of performance, security, and user experience.
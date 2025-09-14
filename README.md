# Polymarket 15-Minute Crypto Trading Agent

A sophisticated, browser-based trading agent specifically designed for Polymarket's 15-minute crypto up/down prediction markets. This application operates entirely client-side with no server dependencies, utilizing modern web technologies for real-time trading automation.

## 🚀 Features

### Core Trading Engine
- **Real-time Market Data**: WebSocket integration for live price feeds and market updates
- **Multiple Trading Strategies**: Built-in technical analysis strategies (MA, RSI, Bollinger Bands, Order Book analysis)
- **Risk Management**: Comprehensive position sizing, loss limits, and portfolio risk controls
- **Order Management**: Automated order placement, cancellation, and fill monitoring
- **Performance Analytics**: Real-time P&L tracking, win rates, and strategy performance metrics

### Browser-First Architecture
- **No Server Required**: Completely client-side application
- **IndexedDB Storage**: Persistent data storage for strategies, trades, and market history
- **Web3 Integration**: MetaMask wallet connection with EIP-712 signing
- **Real-time UI**: Responsive dashboard with live market data updates
- **Offline Capable**: Core functionality works without constant internet connection

### Advanced Features
- **Multi-Strategy Support**: Run multiple trading strategies simultaneously
- **Backtesting Engine**: Test strategies against historical data
- **Market Discovery**: Automatic detection of new 15-minute crypto markets
- **Risk Monitoring**: Real-time risk assessment and automatic position adjustments
- **Performance Tracking**: Detailed analytics and reporting

## 🏗️ Architecture

The application follows a modular architecture with clear separation of concerns:

```
┌─ Core Components ─────────────────────────────────────┐
│  ├─ PolymarketAPI      │ API integration & data       │
│  ├─ MarketDataStream   │ Real-time WebSocket feeds    │
│  ├─ WalletManager      │ Web3 wallet integration      │
│  └─ DatabaseManager    │ IndexedDB data persistence   │
└───────────────────────────────────────────────────────┘

┌─ Trading Engine ──────────────────────────────────────┐
│  ├─ TradingEngine      │ Main orchestration logic     │
│  ├─ StrategyManager    │ Strategy execution & mgmt    │
│  ├─ RiskManager        │ Risk assessment & limits     │
│  └─ OrderManager       │ Order lifecycle management   │
└───────────────────────────────────────────────────────┘

┌─ User Interface ──────────────────────────────────────┐
│  ├─ UIManager          │ Main UI orchestration        │
│  ├─ Dashboard          │ Real-time trading overview   │
│  ├─ Markets            │ Market browser & analysis    │
│  └─ Analytics          │ Performance & reporting      │
└───────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES2022+), HTML5, CSS3
- **Data Storage**: IndexedDB for persistent client-side storage
- **Real-time Communication**: WebSocket for market data streams
- **Web3 Integration**: MetaMask provider with EIP-712 signatures
- **Performance**: Optimized for browser execution with Web Workers support
- **Styling**: Modern CSS with responsive design

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/polymarket-15min-trading-agent.git
   cd polymarket-15min-trading-agent
   ```

2. **Install dependencies** (optional, for development):
   ```bash
   npm install
   ```

3. **Start local development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:8000`

## 🚀 Quick Start

1. **Install MetaMask**: Ensure you have MetaMask browser extension installed
2. **Connect Wallet**: Click "Connect Wallet" and approve the connection
3. **Switch to Polygon**: The app will prompt you to switch to Polygon network
4. **Create Strategy**: Navigate to Strategies tab and create your first trading strategy
5. **Start Trading**: Activate strategies and monitor performance on the Dashboard

## 📊 Trading Strategies

### Built-in Strategies

1. **Moving Average Crossover**
   - Fast and slow moving average crossover signals
   - Configurable periods and position sizing
   - Best for trending markets

2. **RSI Divergence**
   - Relative Strength Index overbought/oversold signals
   - Configurable RSI periods and thresholds
   - Effective for mean-reversion opportunities

3. **Bollinger Bands**
   - Price breakout/reversion from Bollinger Band boundaries
   - Configurable standard deviation and periods
   - Works well in ranging markets

4. **Order Book Imbalance**
   - Detects large order book imbalances for directional moves
   - Real-time order book analysis
   - Effective for short-term price movements

### Creating Custom Strategies

Strategies can be created through the UI or by extending the `BaseStrategy` class:

```javascript
class CustomStrategy extends BaseStrategy {
    async runAnalysis(marketData) {
        // Implement your strategy logic
        const signals = [];
        
        for (const data of marketData) {
            // Analyze market data
            const signal = this.analyzeMarket(data);
            if (signal) {
                signals.push(this.createSignal(
                    data.market.marketId,
                    signal.direction, // 'BUY' or 'SELL'
                    signal.confidence,
                    signal.reasoning
                ));
            }
        }
        
        return signals;
    }
}
```

## ⚙️ Configuration

### Risk Management Settings

The risk manager can be configured with various parameters:

```javascript
const riskConfig = {
    maxDailyLoss: 0.05,        // 5% max daily loss
    maxPositionSize: 0.10,      // 10% max position size
    maxOpenOrders: 20,          // Max concurrent orders
    stopLossPercentage: 0.02,   // 2% stop loss
    maxDrawdown: 0.15,          // 15% max drawdown
    maxSingleAssetExposure: 0.25 // 25% max in single asset
};
```

### Strategy Parameters

Each strategy type has configurable parameters:

- **Moving Average**: Fast period, slow period, position size
- **RSI**: RSI period, overbought/oversold levels, position size  
- **Bollinger Bands**: Period, standard deviation, position size
- **Order Book**: Imbalance threshold, minimum spread, position size

## 📈 Performance Monitoring

The dashboard provides real-time performance metrics:

- **Total P&L**: Overall profit/loss across all strategies
- **Daily P&L**: Current day performance
- **Win Rate**: Percentage of profitable trades
- **Active Positions**: Current market positions
- **Recent Trades**: Latest executed trades
- **Strategy Performance**: Individual strategy metrics

## 🔒 Security Features

- **Client-side Only**: No server-side code reduces attack surface
- **Private Key Safety**: Keys never leave your browser/wallet
- **EIP-712 Signing**: Structured data signing for order authentication
- **Network Validation**: Automatic network switching to Polygon
- **Data Encryption**: Sensitive data encrypted in IndexedDB

## 🛡️ Risk Disclaimers

⚠️ **Important Risk Warnings**:

- **Trading Risk**: Prediction market trading involves significant financial risk
- **Automated Trading**: Automated strategies can lead to rapid losses
- **Market Risk**: Crypto markets are highly volatile and unpredictable
- **Software Risk**: This is experimental software - use at your own risk
- **Regulatory Risk**: Ensure compliance with local regulations

**Never trade with funds you cannot afford to lose.**

## 🔧 Development

### Project Structure

```
polymarket-agent/
├── index.html              # Main application entry point
├── styles.css              # Application styling
├── js/
│   ├── app.js              # Application initialization
│   ├── core/               # Core system components
│   │   ├── polymarket-api.js
│   │   ├── market-stream.js
│   │   └── wallet-manager.js
│   ├── data/               # Data management
│   │   └── database.js
│   ├── trading/            # Trading engine components
│   │   ├── trading-engine.js
│   │   ├── strategy-manager.js
│   │   ├── risk-manager.js
│   │   └── order-manager.js
│   ├── ui/                 # User interface
│   │   └── ui-manager.js
│   └── utils/              # Utility functions
│       ├── logger.js
│       └── event-emitter.js
└── package.json            # Project configuration
```

### Build Commands

```bash
npm run dev      # Start development server
npm run build    # Build and validate project
npm run lint     # Lint JavaScript files
npm run test     # Run tests (when implemented)
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📚 API Documentation

### Polymarket Integration

The application integrates with Polymarket's APIs:

- **CLOB API**: Order placement and management
- **Gamma API**: Market discovery and metadata  
- **WebSocket API**: Real-time market data feeds

### Database Schema

IndexedDB stores are organized as:

- `markets`: Market metadata and current state
- `priceHistory`: Historical price data for analysis
- `strategies`: Strategy configurations and state
- `orders`: Order history and status
- `trades`: Executed trade records
- `performance`: Performance metrics and analytics
- `userConfig`: User preferences and settings

## 🤝 Support

For support, questions, or bug reports:

- **GitHub Issues**: [Create an issue](https://github.com/your-username/polymarket-15min-trading-agent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/polymarket-15min-trading-agent/discussions)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Polymarket Team**: For providing the prediction market infrastructure
- **Chainlink**: For reliable price feeds and automation
- **MetaMask**: For Web3 wallet integration
- **Open Source Community**: For the tools and libraries that make this possible

---

**Disclaimer**: This software is for educational and research purposes. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.
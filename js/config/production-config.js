// Production Configuration for Polymarket Trading Agent
export const ProductionConfig = {
  // API Endpoints
  POLYMARKET_APIS: {
    CLOB_BASE: 'https://clob.polymarket.com',
    GAMMA_BASE: 'https://gamma-api.polymarket.com', 
    WEBSOCKET: 'wss://ws-subscriptions-clob.polymarket.com/ws/v1',
    INDEXER: 'https://polymarket-indexer.com',
    SUBGRAPH: 'https://api.thegraph.com/subgraphs/name/polymarket/polymarket-indexer'
  },

  // Network Configuration
  NETWORKS: {
    POLYGON_MAINNET: {
      chainId: '0x89',
      name: 'Polygon Mainnet',
      rpcUrls: [
        'https://polygon-rpc.com/',
        'https://rpc-mainnet.maticvigil.com/',
        'https://polygonapi.terminet.io/rpc'
      ],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      blockExplorerUrls: ['https://polygonscan.com/']
    },
    POLYGON_MUMBAI: {
      chainId: '0x13881',
      name: 'Polygon Mumbai Testnet',
      rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      blockExplorerUrls: ['https://mumbai.polygonscan.com/']
    }
  },

  // Trading Safety Limits
  TRADING_LIMITS: {
    MIN_ORDER_SIZE: 0.01, // Minimum USDC order
    MAX_POSITION_SIZE: 1000, // Maximum USDC per position
    MAX_DAILY_VOLUME: 5000, // Maximum daily trading volume
    DAILY_LOSS_LIMIT: 0.05, // 5% daily loss limit
    MAX_OPEN_ORDERS: 20, // Maximum concurrent orders
    MIN_MARKET_LIQUIDITY: 100, // Minimum market liquidity to trade
    MAX_SLIPPAGE: 0.02, // 2% maximum slippage
    POSITION_SIZE_LIMIT: 0.10, // 10% of portfolio max per position
    STOP_LOSS_THRESHOLD: 0.15 // 15% stop loss trigger
  },

  // Rate Limiting & Performance
  RATE_LIMITS: {
    API_CALLS_PER_MINUTE: 60,
    API_CALLS_PER_SECOND: 2,
    WEBSOCKET_RECONNECT_DELAY: 5000,
    MAX_WEBSOCKET_RECONNECT_ATTEMPTS: 10,
    ORDER_PLACEMENT_COOLDOWN: 1000, // 1 second between orders
    MARKET_DATA_REFRESH_RATE: 5000, // 5 seconds
    PRICE_UPDATE_THROTTLE: 1000 // 1 second price update throttle
  },

  // Alert System Configuration
  ALERT_SYSTEM: {
    CHECK_INTERVAL: 5000, // 5 seconds
    MAX_ACTIVE: 50,
    RETENTION_TIME: 24 * 60 * 60 * 1000, // 24 hours
    NOTIFICATION_TIMEOUT: 10000, // 10 seconds
    ENABLE_BROWSER_NOTIFICATIONS: true,
    ENABLE_SOUND_ALERTS: false,
    DEFAULT_PRIORITY: 'medium',
    COOLDOWN_PERIODS: {
      price_movement: 300000, // 5 minutes
      volume: 600000, // 10 minutes
      opportunity: 900000, // 15 minutes
      pnl: 600000, // 10 minutes
      time_based: 600000 // 10 minutes
    }
  },

  // Market Identification
  MARKET_FILTERS: {
    CRYPTO_ASSETS: ['BTC', 'ETH', 'SOL', 'ADA', 'MATIC', 'AVAX', 'DOT', 'LINK', 'UNI'],
    DURATION_15MIN: 15 * 60 * 1000, // 15 minutes in milliseconds
    REQUIRED_TAGS: ['crypto'],
    CHAINLINK_KEYWORDS: [
      'chainlink', 'automation', '15 minute', '15-minute', 
      'fifteen minute', '15min', '15 min'
    ],
    MIN_VOLUME_THRESHOLD: 50, // Minimum $50 volume
    MIN_LIQUIDITY_THRESHOLD: 100 // Minimum $100 liquidity
  },

  // Error Handling & Fallbacks
  ERROR_HANDLING: {
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    EXPONENTIAL_BACKOFF: true,
    CIRCUIT_BREAKER_THRESHOLD: 5, // Number of failures before circuit opens
    CIRCUIT_BREAKER_TIMEOUT: 30000, // 30 seconds
    FALLBACK_TO_DEMO: true, // Fallback to demo mode on critical failures
    LOG_ERRORS_TO_STORAGE: true
  },

  // Security Settings
  SECURITY: {
    REQUIRE_WALLET_CONNECTION: true,
    REQUIRE_NETWORK_VALIDATION: true,
    SIGNATURE_VALIDATION: true,
    SESSION_TIMEOUT: 3600000, // 1 hour
    MAX_GAS_PRICE: 100, // Maximum gas price in Gwei
    TRANSACTION_TIMEOUT: 300000 // 5 minutes
  },

  // Feature Flags
  FEATURES: {
    DEMO_MODE: false, // ✅ PRODUCTION MODE ENABLED
    TESTNET_MODE: true, // ✅ TESTNET MODE (SAFE FOR TESTING)
    ENABLE_TRADING: true, // ✅ TRADING ENABLED
    ENABLE_STRATEGIES: true,
    ENABLE_RISK_MANAGEMENT: true,
    ENABLE_ANALYTICS: true,
    ENABLE_NOTIFICATIONS: true,
    ENABLE_ALERT_SYSTEM: true,
    DEBUG_MODE: false,
    VERBOSE_LOGGING: false
  },

  // UI Configuration
  UI_CONFIG: {
    REFRESH_INTERVAL: 5000,
    CHART_UPDATE_INTERVAL: 2000,
    NOTIFICATION_TIMEOUT: 5000,
    MAX_VISIBLE_MARKETS: 50,
    DEFAULT_CHART_TIMEFRAME: '1h',
    THEME: 'dark'
  },

  // Contract Addresses (Polygon Mainnet)
  CONTRACTS: {
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    CTF_EXCHANGE: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    CONDITIONAL_TOKENS: '0x7D8610E9567d2a6C9808f0a7C5C1F2c1a4Aa0355'
  },

  // Development/Testing Configuration
  DEV_CONFIG: {
    MOCK_WALLET: false,
    SIMULATE_NETWORK_DELAYS: false,
    ENABLE_DEBUG_PANEL: true,
    LOG_ALL_API_CALLS: false,
    USE_LOCAL_STORAGE_CACHE: true
  }
};

// Environment Detection
export const Environment = {
  isDevelopment: () => window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  isProduction: () => !Environment.isDevelopment(),
  isTestnet: () => ProductionConfig.FEATURES.TESTNET_MODE,
  isMainnet: () => !ProductionConfig.FEATURES.TESTNET_MODE
};

// Configuration Validator
export class ConfigValidator {
  static validate() {
    const errors = [];

    // Validate required API endpoints
    if (!ProductionConfig.POLYMARKET_APIS.CLOB_BASE) {
      errors.push('Missing CLOB API base URL');
    }

    // Validate trading limits
    if (ProductionConfig.TRADING_LIMITS.MIN_ORDER_SIZE <= 0) {
      errors.push('Invalid minimum order size');
    }

    // Validate network configuration
    if (ProductionConfig.FEATURES.TESTNET_MODE && !ProductionConfig.NETWORKS.POLYGON_MUMBAI) {
      errors.push('Testnet mode requires Mumbai network configuration');
    }

    // Production safety checks
    if (Environment.isProduction()) {
      if (ProductionConfig.FEATURES.DEMO_MODE) {
        errors.push('Demo mode should be disabled in production');
      }

      if (ProductionConfig.FEATURES.DEBUG_MODE) {
        errors.push('Debug mode should be disabled in production');
      }

      if (!ProductionConfig.SECURITY.REQUIRE_WALLET_CONNECTION) {
        errors.push('Wallet connection should be required in production');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export default configuration based on environment
export default ProductionConfig;
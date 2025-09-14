import { test, expect } from '@playwright/test';

test.describe('Polymarket Trading Agent - Core Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow app to initialize
  });

  test.describe('Database Manager', () => {
    test('should initialize IndexedDB successfully', async ({ page }) => {
      const dbInitialized = await page.evaluate(async () => {
        if (!window.tradingAgent) return false;
        
        try {
          const db = window.tradingAgent.getComponent('database');
          return db && db.db !== null;
        } catch (error) {
          return false;
        }
      });

      expect(dbInitialized).toBeTruthy();
    });

    test('should create required object stores', async ({ page }) => {
      const storesCreated = await page.evaluate(async () => {
        if (!window.tradingAgent) return false;
        
        try {
          const db = window.tradingAgent.getComponent('database');
          if (!db || !db.db) return false;
          
          const expectedStores = ['markets', 'priceHistory', 'strategies', 'orders', 'trades', 'performance', 'userConfig'];
          const actualStores = Array.from(db.db.objectStoreNames);
          
          return expectedStores.every(store => actualStores.includes(store));
        } catch (error) {
          console.error('Error checking stores:', error);
          return false;
        }
      });

      expect(storesCreated).toBeTruthy();
    });

    test('should handle basic CRUD operations', async ({ page }) => {
      const crudTest = await page.evaluate(async () => {
        if (!window.tradingAgent) return false;
        
        try {
          const db = window.tradingAgent.getComponent('database');
          if (!db) return false;
          
          // Test configuration save/load
          await db.saveConfig('test_key', 'test_value');
          const value = await db.getConfig('test_key');
          
          return value === 'test_value';
        } catch (error) {
          console.error('CRUD test error:', error);
          return false;
        }
      });

      expect(crudTest).toBeTruthy();
    });
  });

  test.describe('API Integration', () => {
    test('should initialize Polymarket API', async ({ page }) => {
      const apiInitialized = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const api = window.tradingAgent.getComponent('api');
          return api !== null && api !== undefined;
        } catch (error) {
          return false;
        }
      });

      expect(apiInitialized).toBeTruthy();
    });

    test('should have rate limiting configured', async ({ page }) => {
      const rateLimitConfigured = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const api = window.tradingAgent.getComponent('api');
          return api && api.rateLimitDelay > 0;
        } catch (error) {
          return false;
        }
      });

      expect(rateLimitConfigured).toBeTruthy();
    });
  });

  test.describe('Market Data Stream', () => {
    test('should initialize WebSocket manager', async ({ page }) => {
      const streamInitialized = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const stream = window.tradingAgent.getComponent('marketStream');
          return stream !== null && stream !== undefined;
        } catch (error) {
          return false;
        }
      });

      expect(streamInitialized).toBeTruthy();
    });

    test('should handle connection states', async ({ page }) => {
      const connectionHandling = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const stream = window.tradingAgent.getComponent('marketStream');
          return stream && typeof stream.isConnected === 'function';
        } catch (error) {
          return false;
        }
      });

      expect(connectionHandling).toBeTruthy();
    });
  });

  test.describe('Trading Engine', () => {
    test('should initialize trading engine', async ({ page }) => {
      const engineInitialized = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          return engine !== null && engine !== undefined;
        } catch (error) {
          return false;
        }
      });

      expect(engineInitialized).toBeTruthy();
    });

    test('should have risk manager configured', async ({ page }) => {
      const riskManagerConfigured = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          return engine && engine.riskManager !== null;
        } catch (error) {
          return false;
        }
      });

      expect(riskManagerConfigured).toBeTruthy();
    });

    test('should have strategy manager configured', async ({ page }) => {
      const strategyManagerConfigured = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          return engine && engine.strategyManager !== null;
        } catch (error) {
          return false;
        }
      });

      expect(strategyManagerConfigured).toBeTruthy();
    });

    test('should provide status information', async ({ page }) => {
      const statusAvailable = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          if (!engine) return false;
          
          const status = engine.getStatus();
          return status && typeof status.isRunning === 'boolean';
        } catch (error) {
          return false;
        }
      });

      expect(statusAvailable).toBeTruthy();
    });
  });

  test.describe('Wallet Manager', () => {
    test('should initialize wallet manager', async ({ page }) => {
      const walletInitialized = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const wallet = window.tradingAgent.getComponent('wallet');
          return wallet !== null && wallet !== undefined;
        } catch (error) {
          return false;
        }
      });

      expect(walletInitialized).toBeTruthy();
    });

    test('should detect Web3 availability', async ({ page }) => {
      const web3Detection = await page.evaluate(() => {
        if (!window.tradingAgent) return 'no_agent';
        
        try {
          const wallet = window.tradingAgent.getComponent('wallet');
          if (!wallet) return 'no_wallet';
          
          // In test environment, Web3 won't be available
          const isWeb3Available = wallet.isWeb3Available();
          return isWeb3Available ? 'available' : 'not_available';
        } catch (error) {
          return 'error';
        }
      });

      // In test environment, Web3 should not be available
      expect(['not_available', 'error']).toContain(web3Detection);
    });

    test('should handle connection states', async ({ page }) => {
      const connectionStates = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const wallet = window.tradingAgent.getComponent('wallet');
          if (!wallet) return false;
          
          // Check if wallet has connection state methods
          return typeof wallet.isConnected === 'function' &&
                 typeof wallet.getAccount === 'function';
        } catch (error) {
          return false;
        }
      });

      expect(connectionStates).toBeTruthy();
    });
  });

  test.describe('UI Manager', () => {
    test('should initialize UI manager', async ({ page }) => {
      const uiInitialized = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const ui = window.tradingAgent.getComponent('ui');
          return ui !== null && ui !== undefined;
        } catch (error) {
          return false;
        }
      });

      expect(uiInitialized).toBeTruthy();
    });

    test('should have component management', async ({ page }) => {
      const componentManagement = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const ui = window.tradingAgent.getComponent('ui');
          return ui && ui.components && ui.components.size > 0;
        } catch (error) {
          return false;
        }
      });

      expect(componentManagement).toBeTruthy();
    });

    test('should handle view switching', async ({ page }) => {
      const viewSwitching = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const ui = window.tradingAgent.getComponent('ui');
          if (!ui) return false;
          
          // Test view switching functionality
          ui.switchView('markets');
          return ui.currentView === 'markets';
        } catch (error) {
          return false;
        }
      });

      expect(viewSwitching).toBeTruthy();
    });
  });

  test.describe('Event System', () => {
    test('should have working event emitters', async ({ page }) => {
      const eventSystem = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          if (!engine) return false;
          
          // Check if event emitter methods exist
          return typeof engine.on === 'function' &&
                 typeof engine.emit === 'function' &&
                 typeof engine.off === 'function';
        } catch (error) {
          return false;
        }
      });

      expect(eventSystem).toBeTruthy();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle component initialization errors gracefully', async ({ page }) => {
      // Monitor for unhandled errors
      const errors = [];
      page.on('pageerror', error => errors.push(error));

      // Trigger various component interactions
      await page.evaluate(async () => {
        if (window.tradingAgent) {
          try {
            // Test various component methods that might fail gracefully
            const ui = window.tradingAgent.getComponent('ui');
            if (ui) {
              ui.switchView('nonexistent'); // Should handle gracefully
            }
          } catch (error) {
            console.log('Expected error handled:', error.message);
          }
        }
      });

      await page.waitForTimeout(1000);

      // Should not have critical unhandled errors
      const criticalErrors = errors.filter(error => 
        !error.message.includes('ethereum') && 
        !error.message.includes('MetaMask') &&
        !error.message.includes('WebSocket')
      );

      expect(criticalErrors.length).toBeLessThan(2);
    });
  });
});
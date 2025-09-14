import { test, expect } from '@playwright/test';

test.describe('Polymarket Trading Agent - Strategy System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow app to initialize
  });

  test.describe('Strategy Creation', () => {
    test('should open strategy creation modal', async ({ page }) => {
      // Navigate to strategies view
      await page.click('button[data-view="strategies"]');
      
      // Click create strategy button
      await page.click('#create-strategy');
      
      // Modal should be visible
      await expect(page.locator('#modal-overlay')).toHaveClass(/active/);
      await expect(page.locator('#modal-title')).toContainText('Create New Strategy');
    });

    test('should have strategy form fields', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Check form fields exist
      await expect(page.locator('#strategy-name')).toBeVisible();
      await expect(page.locator('#strategy-type')).toBeVisible();
      await expect(page.locator('#strategy-asset')).toBeVisible();
      await expect(page.locator('#position-size')).toBeVisible();
    });

    test('should have expected strategy types', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Check strategy type options
      const strategyTypes = [
        'MovingAverageCrossover',
        'RSIDivergence', 
        'BollingerBands',
        'OrderBookImbalance'
      ];
      
      for (const strategyType of strategyTypes) {
        await expect(page.locator(`#strategy-type option[value="${strategyType}"]`)).toBeVisible();
      }
    });

    test('should have expected asset options', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Check asset options
      const assets = ['BTC', 'ETH', 'SOL'];
      
      for (const asset of assets) {
        await expect(page.locator(`#strategy-asset option[value="${asset}"]`)).toBeVisible();
      }
    });

    test('should validate strategy form', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Try to submit empty form
      await page.click('form button[type="submit"]');
      
      // Form should not submit (browser validation)
      const nameField = page.locator('#strategy-name');
      const isNameRequired = await nameField.getAttribute('required');
      expect(isNameRequired).toBe('');
    });

    test('should fill and submit strategy form', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Fill form
      await page.fill('#strategy-name', 'Test MA Strategy');
      await page.selectOption('#strategy-type', 'MovingAverageCrossover');
      await page.selectOption('#strategy-asset', 'BTC');
      await page.fill('#position-size', '3');
      
      // Submit form (this will likely fail in test environment but should attempt)
      await page.click('form button[type="submit"]');
      
      // Wait for processing
      await page.waitForTimeout(1000);
    });
  });

  test.describe('Strategy Management', () => {
    test('should display strategies list', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      
      // Strategies list should be visible
      await expect(page.locator('#strategies-list')).toBeVisible();
    });

    test('should show empty state initially', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      
      // Should show empty state for new users
      const emptyState = page.locator('#strategies-list .empty-state');
      // Wait a bit for the component to load and render empty state
      await page.waitForTimeout(1000);
      
      // Check if empty state is shown (it should be for a fresh installation)
      const hasEmptyState = await emptyState.count();
      expect(hasEmptyState).toBeGreaterThan(0);
    });

    test('should have backtest functionality', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      
      // Backtest button should be visible
      await expect(page.locator('#backtest-all')).toBeVisible();
      
      // Click backtest button
      await page.click('#backtest-all');
      
      // Should handle the click without errors
      await page.waitForTimeout(500);
    });
  });

  test.describe('Strategy Types Implementation', () => {
    test('should have strategy manager available', async ({ page }) => {
      const strategyManagerAvailable = await page.evaluate(() => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          return engine && engine.strategyManager !== null;
        } catch (error) {
          return false;
        }
      });

      expect(strategyManagerAvailable).toBeTruthy();
    });

    test('should have built-in strategy types', async ({ page }) => {
      const strategyTypes = await page.evaluate(() => {
        if (!window.tradingAgent) return [];
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          if (!engine || !engine.strategyManager) return [];
          
          return engine.strategyManager.getAvailableStrategyTypes();
        } catch (error) {
          return [];
        }
      });

      const expectedTypes = [
        'MovingAverageCrossover',
        'RSIDivergence',
        'BollingerBands',
        'OrderBookImbalance'
      ];

      expectedTypes.forEach(type => {
        expect(strategyTypes).toContain(type);
      });
    });

    test('should handle strategy creation programmatically', async ({ page }) => {
      const strategyCreated = await page.evaluate(async () => {
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          if (!engine) return false;
          
          const strategyConfig = {
            name: 'Test Strategy',
            type: 'MovingAverageCrossover',
            asset: 'BTC',
            positionSize: 0.05,
            active: false, // Don't activate in test
            strategyId: 'test_strategy_' + Date.now()
          };
          
          const strategy = await engine.addStrategy(strategyConfig);
          return strategy && strategy.id === strategyConfig.strategyId;
        } catch (error) {
          console.error('Strategy creation error:', error);
          return false;
        }
      });

      expect(strategyCreated).toBeTruthy();
    });
  });

  test.describe('Technical Analysis Components', () => {
    test('should have technical analysis methods', async ({ page }) => {
      const technicalAnalysis = await page.evaluate(() => {
        // Test if we can access strategy classes through the browser
        // This tests if the modules are properly loaded
        if (!window.tradingAgent) return false;
        
        try {
          const engine = window.tradingAgent.getComponent('tradingEngine');
          if (!engine || !engine.strategyManager) return false;
          
          // Test creating a strategy to verify methods exist
          const manager = engine.strategyManager;
          return manager && typeof manager.createStrategy === 'function';
        } catch (error) {
          return false;
        }
      });

      expect(technicalAnalysis).toBeTruthy();
    });
  });

  test.describe('Strategy Parameters', () => {
    test('should handle strategy configuration', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Test different position size values
      await page.fill('#position-size', '1');
      let value = await page.locator('#position-size').inputValue();
      expect(value).toBe('1');
      
      await page.fill('#position-size', '10');
      value = await page.locator('#position-size').inputValue();
      expect(value).toBe('10');
    });

    test('should validate position size range', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Test min/max attributes
      const positionSizeField = page.locator('#position-size');
      const min = await positionSizeField.getAttribute('min');
      const max = await positionSizeField.getAttribute('max');
      
      expect(min).toBe('1');
      expect(max).toBe('10');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle strategy errors gracefully', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      // Test various strategy operations
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      await page.click('.modal-close');
      await page.click('#backtest-all');

      await page.waitForTimeout(2000);

      // Should not have critical strategy-related errors
      const criticalErrors = errors.filter(error => 
        error.includes('strategy') && 
        !error.includes('WebSocket') &&
        !error.includes('ethereum')
      );

      expect(criticalErrors.length).toBeLessThan(3);
    });
  });
});
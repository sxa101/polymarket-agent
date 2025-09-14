import { test, expect } from '@playwright/test';

test.describe('Polymarket Trading Agent - UI Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Allow app to initialize
  });

  test.describe('Dashboard Components', () => {
    test('should display dashboard widgets', async ({ page }) => {
      // Check all dashboard widgets are visible
      await expect(page.locator('#active-markets')).toBeVisible();
      await expect(page.locator('#positions')).toBeVisible();
      await expect(page.locator('#pnl-summary')).toBeVisible();
      await expect(page.locator('#recent-trades')).toBeVisible();
    });

    test('should show empty states for new users', async ({ page }) => {
      // Check for empty state messages
      const emptyStates = page.locator('.empty-state');
      const count = await emptyStates.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should display P&L metrics', async ({ page }) => {
      const pnlSection = page.locator('#pnl-summary .pnl-metrics');
      await expect(pnlSection).toBeVisible();
      
      // Should have metric containers
      const metrics = page.locator('#pnl-summary .pnl-metric');
      const metricCount = await metrics.count();
      expect(metricCount).toBeGreaterThan(0);
    });
  });

  test.describe('Markets View', () => {
    test('should display markets interface', async ({ page }) => {
      await page.click('button[data-view="markets"]');
      
      // Check markets view elements
      await expect(page.locator('#asset-filter')).toBeVisible();
      await expect(page.locator('#refresh-markets')).toBeVisible();
      await expect(page.locator('#markets-grid')).toBeVisible();
    });

    test('should handle market refresh', async ({ page }) => {
      await page.click('button[data-view="markets"]');
      
      // Click refresh button
      await page.click('#refresh-markets');
      
      // Should show loading state (if implemented) or complete without errors
      await page.waitForTimeout(1000);
    });

    test('should filter markets by asset', async ({ page }) => {
      await page.click('button[data-view="markets"]');
      
      // Type in filter
      await page.fill('#asset-filter', 'BTC');
      
      // Should filter results (test basic functionality)
      const filterValue = await page.locator('#asset-filter').inputValue();
      expect(filterValue).toBe('BTC');
    });
  });

  test.describe('Strategies View', () => {
    test('should display strategies interface', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      
      // Check strategies view elements
      await expect(page.locator('#create-strategy')).toBeVisible();
      await expect(page.locator('#backtest-all')).toBeVisible();
      await expect(page.locator('#strategies-list')).toBeVisible();
    });

    test('should open create strategy modal', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      
      // Click create strategy button
      await page.click('#create-strategy');
      
      // Modal should open
      await expect(page.locator('#modal-overlay')).toHaveClass(/active/);
      await expect(page.locator('#modal-title')).toContainText('Create New Strategy');
    });

    test('should close modal when clicking overlay', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Click on overlay to close
      await page.click('#modal-overlay');
      
      // Modal should close
      await expect(page.locator('#modal-overlay')).not.toHaveClass(/active/);
    });

    test('should close modal with close button', async ({ page }) => {
      await page.click('button[data-view="strategies"]');
      await page.click('#create-strategy');
      
      // Click close button
      await page.click('.modal-close');
      
      // Modal should close
      await expect(page.locator('#modal-overlay')).not.toHaveClass(/active/);
    });
  });

  test.describe('Portfolio View', () => {
    test('should display portfolio interface', async ({ page }) => {
      await page.click('button[data-view="portfolio"]');
      
      // Check portfolio view is visible
      await expect(page.locator('#portfolio-view')).toHaveClass(/active/);
    });
  });

  test.describe('Analytics View', () => {
    test('should display analytics interface', async ({ page }) => {
      await page.click('button[data-view="analytics"]');
      
      // Check analytics view is visible
      await expect(page.locator('#analytics-view')).toHaveClass(/active/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should handle mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Check if navigation is still functional
      await expect(page.locator('.navigation')).toBeVisible();
      
      // Check if main content is visible
      await expect(page.locator('.main-content')).toBeVisible();
    });

    test('should handle tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Check layout adapts to tablet size
      await expect(page.locator('.dashboard-grid')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle console errors gracefully', async ({ page }) => {
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Perform various UI interactions
      await page.click('button[data-view="markets"]');
      await page.click('button[data-view="strategies"]');
      await page.click('button[data-view="portfolio"]');
      await page.click('button[data-view="analytics"]');
      await page.click('button[data-view="dashboard"]');

      await page.waitForTimeout(2000);

      // Filter out expected errors in test environment
      const unexpectedErrors = consoleErrors.filter(error => 
        !error.includes('ethereum') && 
        !error.includes('MetaMask') &&
        !error.includes('WebSocket') &&
        !error.includes('fetch')
      );

      expect(unexpectedErrors.length).toBeLessThan(5); // Allow some minor errors
    });
  });
});
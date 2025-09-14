import { test, expect } from '@playwright/test';

test.describe('Polymarket Trading Agent - App Initialization', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should load the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/Polymarket 15-Min Crypto Trading Agent/);
    
    // Check for main header
    await expect(page.locator('h1')).toContainText('Polymarket Trading Agent');
  });

  test('should display all navigation tabs', async ({ page }) => {
    const expectedTabs = ['Dashboard', 'Markets', 'Strategies', 'Portfolio', 'Analytics'];
    
    for (const tab of expectedTabs) {
      await expect(page.locator(`button[data-view="${tab.toLowerCase()}"]`)).toBeVisible();
    }
  });

  test('should show connection status indicators', async ({ page }) => {
    // Check wallet status indicator
    await expect(page.locator('#wallet-status')).toContainText('Wallet: Not Connected');
    
    // Check market status indicator  
    await expect(page.locator('#market-status')).toContainText('Markets: Disconnected');
  });

  test('should initialize dashboard by default', async ({ page }) => {
    // Dashboard should be active by default
    await expect(page.locator('#dashboard-view')).toHaveClass(/active/);
    await expect(page.locator('button[data-view="dashboard"]')).toHaveClass(/active/);
    
    // Check dashboard widgets are present
    await expect(page.locator('#active-markets')).toBeVisible();
    await expect(page.locator('#positions')).toBeVisible();
    await expect(page.locator('#pnl-summary')).toBeVisible();
    await expect(page.locator('#recent-trades')).toBeVisible();
  });

  test('should load JavaScript modules without errors', async ({ page }) => {
    // Check for JavaScript errors
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(new Error(msg.text()));
      }
    });

    await page.waitForLoadState('networkidle');
    
    // Allow some time for modules to load
    await page.waitForTimeout(2000);
    
    // Filter out expected errors (like MetaMask not being available in test environment)
    const criticalErrors = errors.filter(error => 
      !error.message.includes('ethereum') && 
      !error.message.includes('MetaMask') &&
      !error.message.includes('wallet')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should initialize database components', async ({ page }) => {
    // Wait for app to initialize
    await page.waitForTimeout(2000);
    
    // Check if trading agent is initialized
    const isInitialized = await page.evaluate(() => {
      return window.tradingAgent && window.tradingAgent.isInitialized;
    });
    
    expect(isInitialized).toBeTruthy();
  });

  test('should handle navigation between views', async ({ page }) => {
    // Test navigation to Markets view
    await page.click('button[data-view="markets"]');
    await expect(page.locator('#markets-view')).toHaveClass(/active/);
    await expect(page.locator('button[data-view="markets"]')).toHaveClass(/active/);
    
    // Test navigation to Strategies view
    await page.click('button[data-view="strategies"]');
    await expect(page.locator('#strategies-view')).toHaveClass(/active/);
    await expect(page.locator('button[data-view="strategies"]')).toHaveClass(/active/);
    
    // Test navigation back to Dashboard
    await page.click('button[data-view="dashboard"]');
    await expect(page.locator('#dashboard-view')).toHaveClass(/active/);
    await expect(page.locator('button[data-view="dashboard"]')).toHaveClass(/active/);
  });
});
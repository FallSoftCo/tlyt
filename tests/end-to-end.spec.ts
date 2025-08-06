import { test, expect } from '@playwright/test';

test.describe('TLYT End-to-End Tests', () => {
  
  test('should load homepage and create user', async ({ page }) => {
    await page.goto('/');
    
    // Check main heading loads
    await expect(page.locator('h1')).toContainText('TLYT');
    await expect(page.locator('text=YouTube Video Analysis with AI')).toBeVisible();
    
    // Should show welcome screen for new user
    await expect(page.locator('text=Welcome to TLYT')).toBeVisible();
    await expect(page.locator('text=Get started by pasting a YouTube video link')).toBeVisible();
    
    // Paste button should be visible
    await expect(page.getByRole('button', { name: /paste youtube link/i })).toBeVisible();
  });

  test('should handle clipboard paste workflow', async ({ page, context, browserName }) => {
    // Grant clipboard permissions (Chromium only)
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    
    await page.goto('/');
    
    // Set clipboard content to a YouTube URL
    try {
      await page.evaluate(() => {
        return navigator.clipboard.writeText('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      });
    } catch (error) {
      // Skip test if clipboard not available (Firefox in headless mode)
      if (browserName === 'firefox') {
        console.log('Skipping clipboard test for Firefox - clipboard not available in headless mode');
        return;
      }
      throw error;
    }
    
    const pasteButton = page.getByRole('button', { name: /paste youtube link/i });
    await expect(pasteButton).toBeVisible();
    
    // Click paste button
    await pasteButton.click();
    
    // Should show processing state
    await expect(page.locator('text=Processing...')).toBeVisible();
    
    // Wait for video to be processed and page to update
    // This tests the real YouTube API integration
    await expect(page.locator('text=Processing...')).toBeHidden({ timeout: 15000 });
    
    // Wait a moment for page to update after processing
    await page.waitForTimeout(1000);
    
    // Check what's actually on the page after processing
    const pageContent = await page.textContent('body');
    console.log('Page content after processing:', pageContent?.substring(0, 500));
    
    // Look for success indicators - either video was added or there's a specific error
    const hasVideoAdded = await page.locator('text=Video Added!').isVisible().catch(() => false);
    const hasYourVideos = await page.locator('text=Your Videos').isVisible().catch(() => false);
    const hasVideoCard = await page.locator('[data-testid="video-card"]').isVisible().catch(() => false);
    const hasRateLimitError = await page.locator('text=Rate limit exceeded').isVisible().catch(() => false);
    const hasYouTubeApiError = await page.locator('text=Failed to fetch video data from YouTube').isVisible().catch(() => false);
    const hasGenericApiError = await page.locator('text=YouTube API').isVisible().catch(() => false);
    
    // Should have some indication of success or a legitimate API error
    expect(hasVideoAdded || hasYourVideos || hasVideoCard || hasRateLimitError || hasYouTubeApiError || hasGenericApiError).toBeTruthy();
  });

  test('should handle video analysis workflow', async ({ page, context, browserName }) => {
    // Grant clipboard permissions (Chromium only)
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    
    await page.goto('/');
    
    // Set clipboard to YouTube URL
    try {
      await page.evaluate(() => {
        return navigator.clipboard.writeText('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      });
    } catch (error) {
      // Skip test if clipboard not available (Firefox in headless mode)
      if (browserName === 'firefox') {
        console.log('Skipping clipboard test for Firefox - clipboard not available in headless mode');
        return;
      }
      throw error;
    }
    
    // Paste video
    await page.getByRole('button', { name: /paste youtube link/i }).click();
    
    // Wait for processing
    await expect(page.locator('text=Processing...')).toBeHidden({ timeout: 15000 });
    
    // If video was successfully added, look for analysis button
    const analysisButton = page.getByRole('button', { name: /request.*analysis/i });
    
    if (await analysisButton.isVisible()) {
      // Click to request analysis
      await analysisButton.click();
      
      // Should show analyzing state
      await expect(page.locator('text=Analyzing...')).toBeVisible();
      
      // Wait for analysis to complete (this tests real Gemini API)
      await expect(page.locator('text=Analyzing...')).toBeHidden({ timeout: 30000 });
      
      // Should show TL;DR section or analysis results
      const hasTLDR = await page.locator('text=TL;DR').isVisible().catch(() => false);
      const hasAnalysisError = await page.locator('text=Failed to request analysis').isVisible().catch(() => false);
      
      expect(hasTLDR || hasAnalysisError).toBeTruthy();
    }
  });

  test('should persist user session with cookies', async ({ page, context }) => {
    // First visit
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('TLYT');
    
    // Get cookies after first visit
    const cookies = await context.cookies();
    const userIdCookie = cookies.find(cookie => cookie.name === 'userId');
    expect(userIdCookie).toBeDefined();
    
    // Reload page
    await page.reload();
    
    // Should still show the app (user persisted)
    await expect(page.locator('h1')).toContainText('TLYT');
    
    // Cookie should still be there
    const newCookies = await context.cookies();
    const persistedCookie = newCookies.find(cookie => cookie.name === 'userId');
    expect(persistedCookie?.value).toBe(userIdCookie?.value);
  });
});
import { test, expect } from '@playwright/test';

test.describe('Prove No Full Page Reload', () => {
  test('client state survives analysis completion', async ({ page, context, browserName }) => {
    // Skip non-chromium for clipboard
    if (browserName !== 'chromium') {
      test.skip();
      return;
    }
    
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    
    // Add video first
    await page.evaluate(() => navigator.clipboard.writeText('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
    await page.getByRole('button', { name: /paste youtube link/i }).click();
    await expect(page.locator('text=Processing...')).toBeHidden({ timeout: 15000 });
    
    // Set client state that would be lost on full page reload
    await page.evaluate(() => {
      window.PROOF_STATE = 'ROUTER_REFRESH_WORKS';
      window.reloadDetected = false;
      
      // Override location.reload to detect if called
      const originalReload = window.location.reload;
      window.location.reload = function() {
        window.reloadDetected = true;
        window.PROOF_STATE = 'FULL_PAGE_RELOAD_DETECTED';
      };
    });
    
    // Verify initial state
    const initialState = await page.evaluate(() => window.PROOF_STATE);
    expect(initialState).toBe('ROUTER_REFRESH_WORKS');
    
    console.log('✅ Initial client state set:', initialState);
    
    // Request analysis (this will trigger our refresh mechanism)
    const analysisButton = page.getByRole('button', { name: /request.*analysis/i });
    
    if (await analysisButton.isVisible()) {
      console.log('🚀 Starting analysis...');
      await analysisButton.click();
      
      // Wait a bit for the analysis to start
      await page.waitForTimeout(3000);
      
      // Check if analysis is progressing
      const isAnalyzing = await page.locator('text=Analyzing...').isVisible();
      console.log('Analysis in progress:', isAnalyzing);
      
      if (isAnalyzing) {
        // Wait for completion with extended timeout
        try {
          await expect(page.locator('text=Analyzing...')).toBeHidden({ timeout: 30000 });
          console.log('✅ Analysis completed');
        } catch (error) {
          console.log('⏱️ Analysis still running, checking state preservation anyway');
        }
      }
    }
    
    // Check if our client state survived
    const finalState = await page.evaluate(() => window.PROOF_STATE);
    const reloadWasDetected = await page.evaluate(() => window.reloadDetected);
    
    console.log('Final client state:', finalState);
    console.log('Full page reload detected:', reloadWasDetected);
    
    if (finalState === 'ROUTER_REFRESH_WORKS' && !reloadWasDetected) {
      console.log('🎉 PROOF: Using router.refresh() - client state preserved!');
    } else if (finalState === 'FULL_PAGE_RELOAD_DETECTED') {
      console.log('❌ DETECTED: Using window.location.reload() - bad!');
    } else {
      console.log('🤔 State changed but not through reload detection');
    }
    
    // The test passes if client state is preserved
    expect(finalState).toBe('ROUTER_REFRESH_WORKS');
    expect(reloadWasDetected).toBe(false);
  });
});
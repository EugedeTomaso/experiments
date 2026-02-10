import { test, expect } from '@playwright/test';

async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const editorVisible = await page.locator('.editor-section').isVisible().catch(() => false);

  if (!editorVisible) {
    const treeButtons = page.locator('.tree-button');
    const count = await treeButtons.count();
    if (count > 0) {
      await treeButtons.first().click();
      await page.waitForTimeout(300);
    }
  }
}

test('assistant panel divider screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await navigateToEditor(page);

  // Open assistant
  await page.locator('button[aria-label="Toggle assistant"]').click();
  await page.waitForTimeout(500);

  // Full page screenshot with assistant open
  await page.screenshot({ path: 'test-results/assistant-open.png', fullPage: false });

  // Check if divider is in the DOM
  const divider = page.locator('.pane-divider');
  const dividerVisible = await divider.isVisible();
  console.log('Divider visible:', dividerVisible);

  if (dividerVisible) {
    // Get divider bounding box
    const box = await divider.boundingBox();
    console.log('Divider bounding box:', JSON.stringify(box));

    // Hover over divider to trigger the ::after indicator
    await divider.hover();
    await page.waitForTimeout(300);

    // Screenshot while hovering
    await page.screenshot({ path: 'test-results/assistant-divider-hover.png', fullPage: false });

    // Take a zoomed screenshot around the divider area
    if (box) {
      await page.screenshot({
        path: 'test-results/divider-zoomed.png',
        clip: {
          x: Math.max(0, box.x - 100),
          y: Math.max(0, box.y - 50),
          width: 200,
          height: Math.min(box.height + 100, 400),
        },
      });
    }
  } else {
    console.log('DIVIDER NOT FOUND IN DOM');
    // Screenshot anyway to see what the layout looks like
    await page.screenshot({ path: 'test-results/assistant-no-divider.png', fullPage: false });
  }
});

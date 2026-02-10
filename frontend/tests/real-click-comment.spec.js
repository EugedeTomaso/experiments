import { test, expect } from '@playwright/test';

/**
 * Tests using REAL .click() (not dispatchEvent) on the Comment toolbar button.
 * These simulate exactly what the user does in their browser.
 */

// Helper: navigate to editor with a file open
async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const projectButtons = page.locator('.project-button');
  if ((await projectButtons.count()) === 0) {
    page.once('dialog', async (d) => await d.accept('Click Test'));
    await page.locator('.panel-header button.ghost', { hasText: '+ New' }).first().click();
    await page.waitForTimeout(500);
  } else {
    await projectButtons.first().click();
    await page.waitForTimeout(300);
  }

  // Create a fresh file to avoid state from prior tests
  page.once('dialog', async (d) => await d.accept(`Click Test ${Date.now()}`));
  await page.locator('button.ghost', { hasText: '+ File' }).click();
  await page.waitForTimeout(1000);

  const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

test('real click on Comment button opens the floating comment input', async ({ page }) => {
  const editor = await navigateToEditor(page);

  await editor.click();
  await page.keyboard.type('En un lugar de la Mancha, de cuyo nombre no quiero acordarme.', { delay: 20 });
  await page.waitForTimeout(500);

  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(500);

  const toolbar = page.locator('.selection-toolbar-btn');
  await expect(toolbar).toBeVisible({ timeout: 5000 });

  // Use REAL .click() — exactly what the user does
  await toolbar.click();
  await page.waitForTimeout(1000);

  const commentInput = page.locator('.comment-input-float');
  await expect(commentInput).toBeVisible({ timeout: 3000 });
});

test('real click creates an inline comment end-to-end', async ({ page }) => {
  const editor = await navigateToEditor(page);

  await editor.click();
  await page.keyboard.type('Texto para probar comentarios con click real.', { delay: 20 });
  await page.waitForTimeout(500);

  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(500);

  const toolbar = page.locator('.selection-toolbar-btn');
  await expect(toolbar).toBeVisible({ timeout: 5000 });

  // Real click on Comment button
  await toolbar.click();
  await page.waitForTimeout(500);

  const commentInput = page.locator('.comment-input-float');
  await expect(commentInput).toBeVisible({ timeout: 3000 });

  // Type and submit a comment
  await commentInput.locator('textarea').fill('Comentario con click real');
  await commentInput.locator('button.primary').click();
  await page.waitForTimeout(1000);

  // Comment input should close
  await expect(commentInput).not.toBeVisible({ timeout: 3000 });

  // Inline comment should appear in the list
  const inlineComment = page.locator('.comment-list .comment-inline').last();
  await expect(inlineComment).toBeVisible({ timeout: 5000 });
  await expect(inlineComment.locator('.comment-body')).toHaveText('Comentario con click real');

  // Highlight should appear in the editor
  const highlight = editor.locator('.comment-highlight');
  await expect(highlight).toBeVisible({ timeout: 5000 });
});

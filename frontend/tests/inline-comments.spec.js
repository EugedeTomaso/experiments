import { test, expect } from '@playwright/test';

// Helper: get the Milkdown editor's ProseMirror contenteditable div
async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

// Helper: ensure we have a project and file open in the editor
async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const editorVisible = await page.locator('.editor-section').isVisible().catch(() => false);

  if (!editorVisible) {
    const projectButtons = page.locator('.project-button');
    const projectCount = await projectButtons.count();

    if (projectCount === 0) {
      page.once('dialog', async (dialog) => {
        await dialog.accept('Test Comment Project');
      });
      await page.locator('.panel-header button.ghost', { hasText: '+ New' }).first().click();
      await page.waitForTimeout(500);
    } else {
      await projectButtons.first().click();
      await page.waitForTimeout(300);
    }

    const editorNow = await page.locator('.editor-section').isVisible().catch(() => false);
    if (!editorNow) {
      const fileButtons = page.locator('.tree-button');
      const fileCount = await fileButtons.count();
      if (fileCount > 0) {
        await fileButtons.first().click();
        await page.waitForTimeout(300);
      } else {
        page.once('dialog', async (dialog) => {
          await dialog.accept('Comment Test File');
        });
        await page.locator('button.ghost', { hasText: '+ File' }).click();
        await page.waitForTimeout(500);
      }
    }
  }

  const editor = await getEditor(page);
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

// Helper: clear the editor and type fresh
async function clearAndType(page, editor, text) {
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(300);
}

// Helper: select all text and trigger the Comment toolbar button
async function selectAndClickComment(page) {
  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(500);

  const toolbar = page.locator('.selection-toolbar-btn');
  await expect(toolbar).toBeVisible({ timeout: 5000 });

  // Use dispatchEvent('mousedown') because the button uses onMouseDown
  // and the tooltip plugin (tippy.js) can interfere with Playwright's full click()
  await toolbar.dispatchEvent('mousedown');
  await page.waitForTimeout(500);
}

test.describe('Inline Comments', () => {

  test('selection toolbar appears when text is selected', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'This is some sample text for commenting');

    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(500);

    const toolbar = page.locator('.selection-toolbar-btn');
    await expect(toolbar).toBeVisible({ timeout: 5000 });

    // Verify it shows the correct label
    await expect(toolbar).toContainText('Comment');
  });

  test('selection toolbar disappears when selection is cleared', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Some text to select');

    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(500);

    const toolbar = page.locator('.selection-toolbar-btn');
    await expect(toolbar).toBeVisible({ timeout: 5000 });

    // Click at end of text to collapse selection
    const box = await editor.boundingBox();
    await page.mouse.click(box.x + box.width - 10, box.y + 10);
    await page.waitForTimeout(500);

    await expect(toolbar).not.toBeVisible({ timeout: 5000 });
  });

  test('clicking Comment button opens the floating comment input', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Hello world this is a test');

    await selectAndClickComment(page);

    // The floating comment input should appear
    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    // It should have a textarea that is focused
    const textarea = commentInput.locator('textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();
  });

  test('submitting a comment creates an inline comment in the list', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'The quick brown fox jumps over the lazy dog');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    // Type a comment
    const textarea = commentInput.locator('textarea');
    await textarea.fill('This is my inline comment');

    // Click Post
    await commentInput.locator('button.primary').click();
    await page.waitForTimeout(1000);

    // The comment input should close
    await expect(commentInput).not.toBeVisible({ timeout: 3000 });

    // The comment should appear in the Comments tab with inline styling
    const inlineComment = page.locator('.comment-list .comment-inline').last();
    await expect(inlineComment).toBeVisible({ timeout: 5000 });

    // Should show the quoted text
    const quoted = inlineComment.locator('.comment-quoted');
    await expect(quoted).toBeVisible();

    // Should show the comment body
    const body = inlineComment.locator('.comment-body');
    await expect(body).toHaveText('This is my inline comment');
  });

  test('inline comment creates a highlight decoration in the editor', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Highlighted text should appear here');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    await commentInput.locator('textarea').fill('Highlight test comment');
    await commentInput.locator('button.primary').click();
    await page.waitForTimeout(1000);

    // Check for highlight decoration in the editor
    const highlight = editor.locator('.comment-highlight');
    await expect(highlight).toBeVisible({ timeout: 5000 });

    // The highlight should contain the text
    const highlightText = await highlight.textContent();
    expect(highlightText).toContain('Highlighted text should appear here');
  });

  test('clicking a highlight shows the comment popover', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Click on this highlighted text');

    // Create an inline comment
    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });
    await commentInput.locator('textarea').fill('Popover test comment');
    await commentInput.locator('button.primary').click();
    await page.waitForTimeout(1000);

    // Now click on the highlighted text
    const highlight = editor.locator('.comment-highlight');
    await expect(highlight).toBeVisible({ timeout: 5000 });
    await highlight.click();
    await page.waitForTimeout(500);

    // The popover should appear
    const popover = page.locator('.comment-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // It should show the comment body (use .first() as overlapping highlights may show multiple)
    const popoverBody = popover.locator('.comment-popover-body').first();
    await expect(popoverBody).toContainText('Popover test comment');
  });

  test('cancel button closes the floating comment input', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Cancel test text');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await commentInput.locator('button.ghost').click();
    await page.waitForTimeout(300);

    await expect(commentInput).not.toBeVisible({ timeout: 3000 });
  });

  test('Escape key closes the floating comment input', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Escape test text');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await expect(commentInput).not.toBeVisible({ timeout: 3000 });
  });

  test('Enter key submits the comment (without Shift)', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Enter submit test');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    const textarea = commentInput.locator('textarea');
    await textarea.fill('Comment via enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Input should close
    await expect(commentInput).not.toBeVisible({ timeout: 3000 });

    // Comment should appear
    const inlineComment = page.locator('.comment-list .comment-inline').last();
    const body = inlineComment.locator('.comment-body');
    await expect(body).toHaveText('Comment via enter');
  });

  test('document-level comment still works via the general comment input', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Document level comment test');
    await page.waitForTimeout(300);

    // Use the general comment input at bottom of comments tab
    const generalTextarea = page.locator('.comment-input textarea');
    await generalTextarea.fill('A document-level comment');
    await page.locator('.comment-input button.primary').click();
    await page.waitForTimeout(500);

    // Should appear in comments list
    const comments = page.locator('.comment-list .comment');
    const lastComment = comments.last();
    await expect(lastComment).toBeVisible({ timeout: 3000 });

    // Document-level comments should NOT have the .comment-inline class
    const hasInlineClass = await lastComment.evaluate(el => el.classList.contains('comment-inline'));
    expect(hasInlineClass).toBe(false);

    // Should NOT have quoted text
    const quoted = lastComment.locator('.comment-quoted');
    await expect(quoted).toHaveCount(0);
  });

  test('clicking inline comment in tab focuses the editor', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'First paragraph with some text to navigate to.');

    // Create inline comment
    await selectAndClickComment(page);
    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });
    await commentInput.locator('textarea').fill('Navigate to this');
    await commentInput.locator('button.primary').click();
    await page.waitForTimeout(1000);

    // Click elsewhere to remove focus from editor
    await page.locator('.comment-input textarea').click();
    await page.waitForTimeout(200);

    // Click the last inline comment in the tab (may have prior comments from shared state)
    const inlineComment = page.locator('.comment-list .comment-inline').last();
    await expect(inlineComment).toBeVisible({ timeout: 3000 });
    await inlineComment.click();
    await page.waitForTimeout(500);

    // The editor should receive focus (scrollToPos calls focus)
    const editorFocused = await editor.evaluate(
      (el) => el === document.activeElement || el.contains(document.activeElement)
    );
    expect(editorFocused).toBe(true);
  });

  test('Post button is disabled when comment input is empty', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Disabled button test');

    await selectAndClickComment(page);

    const commentInput = page.locator('.comment-input-float');
    await expect(commentInput).toBeVisible({ timeout: 3000 });

    // Post button should be disabled when textarea is empty
    const postButton = commentInput.locator('button.primary');
    await expect(postButton).toBeDisabled();

    // Type something
    await commentInput.locator('textarea').fill('Now enabled');

    // Post button should be enabled
    await expect(postButton).toBeEnabled();
  });
});

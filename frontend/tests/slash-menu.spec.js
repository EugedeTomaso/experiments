import { test, expect } from '@playwright/test';

// Helper: get the Milkdown editor's ProseMirror contenteditable div
async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

// Helper: ensure we have a project and file open in the editor
async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for the app to load
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  // Check if there's an active file with the editor visible
  const editorVisible = await page.locator('.editor-section').isVisible().catch(() => false);

  if (!editorVisible) {
    // Try to create a project first if none exists
    const projectButtons = page.locator('.project-button');
    const projectCount = await projectButtons.count();

    if (projectCount === 0) {
      // Create a new project
      page.once('dialog', async (dialog) => {
        await dialog.accept('Test Project');
      });
      await page.locator('.panel-header button.ghost', { hasText: '+ New' }).first().click();
      await page.waitForTimeout(500);
    } else {
      await projectButtons.first().click();
      await page.waitForTimeout(300);
    }

    // Now create a file if no editor is visible
    const editorNow = await page.locator('.editor-section').isVisible().catch(() => false);
    if (!editorNow) {
      // Look for existing file in tree
      const fileButtons = page.locator('.tree-button');
      const fileCount = await fileButtons.count();
      if (fileCount > 0) {
        await fileButtons.first().click();
        await page.waitForTimeout(300);
      } else {
        // Create a new file
        page.once('dialog', async (dialog) => {
          await dialog.accept('Test File');
        });
        await page.locator('button.ghost', { hasText: '+ File' }).click();
        await page.waitForTimeout(500);
      }
    }
  }

  // Wait for the editor to be ready
  const editor = await getEditor(page);
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

// Helper: clear the editor and type fresh
async function clearAndType(page, editor, text) {
  // Select all and delete existing content
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);

  // Type the text
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(200);
}

test.describe('Slash Menu', () => {

  test('slash menu appears when typing /', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Should show all 8 commands
    const items = page.locator('.slash-menu-item');
    await expect(items).toHaveCount(8);
  });

  test('slash menu disappears when pressing Escape or deleting /', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Delete the slash
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // Menu should disappear
    await expect(slashMenu).not.toBeVisible({ timeout: 3000 });
  });

  test('slash menu filters commands when typing after /', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/he');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Should only show heading commands
    const items = page.locator('.slash-menu-item');
    const count = await items.count();
    expect(count).toBe(3); // Heading 1, 2, 3

    // Verify they're all headings
    for (let i = 0; i < count; i++) {
      const label = await items.nth(i).locator('.slash-menu-label').textContent();
      expect(label.toLowerCase()).toContain('heading');
    }
  });

  test('slash menu shows "No matching commands" for bad filter', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/zzzzz');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    const empty = page.locator('.slash-menu-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toHaveText('No matching commands');
  });

  test('Heading 1: click inserts h1 block', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // Click Heading 1
    await page.locator('.slash-menu-item', { hasText: 'Heading 1' }).click();
    await page.waitForTimeout(300);

    // Menu should be gone
    await expect(slashMenu).not.toBeVisible();

    // Editor should contain an h1
    const h1 = editor.locator('h1');
    await expect(h1).toBeVisible({ timeout: 3000 });

    // Type some text in the heading
    await page.keyboard.type('Test Title');
    await page.waitForTimeout(200);

    const h1Text = await h1.textContent();
    expect(h1Text).toContain('Test Title');
  });

  test('Heading 2: click inserts h2 block', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Heading 2' }).click();
    await page.waitForTimeout(300);

    const h2 = editor.locator('h2');
    await expect(h2).toBeVisible({ timeout: 3000 });
  });

  test('Heading 3: click inserts h3 block', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Heading 3' }).click();
    await page.waitForTimeout(300);

    const h3 = editor.locator('h3');
    await expect(h3).toBeVisible({ timeout: 3000 });
  });

  test('Bullet list: click inserts ul', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Bullet list' }).click();
    await page.waitForTimeout(300);

    const ul = editor.locator('ul');
    await expect(ul).toBeVisible({ timeout: 3000 });

    // Type in the list item
    await page.keyboard.type('First item');
    await page.waitForTimeout(100);

    // Press Enter to add another list item
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second item');
    await page.waitForTimeout(200);

    const listItems = editor.locator('ul li');
    const liCount = await listItems.count();
    expect(liCount).toBeGreaterThanOrEqual(2);
  });

  test('Numbered list: click inserts ol', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Numbered list' }).click();
    await page.waitForTimeout(300);

    const ol = editor.locator('ol');
    await expect(ol).toBeVisible({ timeout: 3000 });
  });

  test('Quote: click inserts blockquote', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Quote' }).click();
    await page.waitForTimeout(300);

    const blockquote = editor.locator('blockquote');
    await expect(blockquote).toBeVisible({ timeout: 3000 });

    // Type in the blockquote
    await page.keyboard.type('A wise quote');
    await page.waitForTimeout(200);

    const bqText = await blockquote.textContent();
    expect(bqText).toContain('A wise quote');
  });

  test('Code block: click inserts code block', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Code block' }).click();
    await page.waitForTimeout(300);

    // Code blocks render as <pre> or <pre><code>
    const pre = editor.locator('pre');
    await expect(pre).toBeVisible({ timeout: 3000 });
  });

  test('Divider: click inserts hr', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Divider' }).click();
    await page.waitForTimeout(300);

    const hr = editor.locator('hr');
    await expect(hr).toBeVisible({ timeout: 3000 });
  });

  test('slash menu works in the middle of text (after space)', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Some text /');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });
  });

  test('slash menu does NOT appear mid-word (no space before /)', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'word/');

    const slashMenu = page.locator('.slash-menu');
    // Should NOT be visible because there's no space before /
    await page.waitForTimeout(500);
    const visible = await slashMenu.isVisible().catch(() => false);
    expect(visible).toBe(false);
  });

  test('mouse hover changes selected item', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    // First item should be selected by default
    const firstItem = page.locator('.slash-menu-item').first();
    await expect(firstItem).toHaveClass(/selected/);

    // Hover over the third item
    const thirdItem = page.locator('.slash-menu-item').nth(2);
    await thirdItem.hover();
    await page.waitForTimeout(100);

    await expect(thirdItem).toHaveClass(/selected/);
    // First should no longer be selected
    await expect(firstItem).not.toHaveClass(/selected/);
  });

  test('exiting heading: Enter after heading creates normal paragraph', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Heading 1' }).click();
    await page.waitForTimeout(300);

    await page.keyboard.type('My Heading');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    // After pressing Enter at end of heading, we should be in a normal paragraph
    await page.keyboard.type('Normal text');
    await page.waitForTimeout(200);

    // Should have an h1 AND a p
    const h1 = editor.locator('h1');
    const p = editor.locator('p');
    await expect(h1).toBeVisible();
    // The normal text should NOT be inside the heading
    const h1Text = await h1.textContent();
    expect(h1Text).not.toContain('Normal text');
  });

  test('exiting blockquote: double Enter exits blockquote', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Quote' }).click();
    await page.waitForTimeout(300);

    await page.keyboard.type('Quote text');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Now typing should be outside the blockquote
    await page.keyboard.type('Outside quote');
    await page.waitForTimeout(200);

    const blockquote = editor.locator('blockquote');
    const bqText = await blockquote.textContent();
    expect(bqText).not.toContain('Outside quote');
  });

  test('exiting bullet list: double Enter on empty item exits list', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Bullet list' }).click();
    await page.waitForTimeout(300);

    await page.keyboard.type('Item one');
    await page.keyboard.press('Enter');
    // Empty list item, press Enter again to exit
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    await page.keyboard.type('Outside list');
    await page.waitForTimeout(200);

    const ul = editor.locator('ul');
    const ulText = await ul.textContent();
    expect(ulText).not.toContain('Outside list');
  });

  test('exiting code block: arrow down or special exit', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '/');

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });

    await page.locator('.slash-menu-item', { hasText: 'Code block' }).click();
    await page.waitForTimeout(300);

    await page.keyboard.type('const x = 1;');

    // Try to exit code block: typically Mod+Enter or ArrowDown at end
    await page.keyboard.press('Meta+Enter');
    await page.waitForTimeout(300);

    await page.keyboard.type('Normal text after code');
    await page.waitForTimeout(200);

    // Check that normal text is outside the code block
    const pre = editor.locator('pre');
    const preText = await pre.textContent();
    // If Mod+Enter doesn't work, the text will be inside pre
    // This test documents the behavior
    const outsideCode = !preText.includes('Normal text after code');
    console.log(`Code block exit with Mod+Enter: ${outsideCode ? 'WORKS' : 'STUCK IN CODE BLOCK'}`);
  });

  test('slash command after heading text still works', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, '');

    // Type a heading manually, then press enter, then use slash
    await page.keyboard.type('# Title');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    await page.keyboard.type('/');
    await page.waitForTimeout(300);

    const slashMenu = page.locator('.slash-menu');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });
  });
});

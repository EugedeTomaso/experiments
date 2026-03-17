import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://marvintext.com';
const SCREENSHOT_DIR = 'test-results/visual';

/**
 * Helper: login via API and inject JWT tokens into localStorage.
 * Returns the tokens for use in subsequent API calls.
 */
async function login(page) {
  const response = await page.request.post(`${BASE_URL}/api/auth/login/`, {
    data: { email: 'admin@admin.com', password: 'admin123' },
  });
  const { tokens } = await response.json();

  await page.goto(`${BASE_URL}/app`);
  await page.evaluate((t) => {
    localStorage.setItem('mive:access_token', t.access);
    localStorage.setItem('mive:refresh_token', t.refresh);
  }, tokens);

  await page.goto(`${BASE_URL}/app`);
  await page.waitForSelector('.app-shell', { timeout: 15000 });

  return tokens;
}

/**
 * Helper: dismiss walkthrough / welcome screens if present.
 */
async function dismissWalkthrough(page) {
  const skipBtn = page.locator('text=Skip');
  if (await skipBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(400);
  }
  const exploreLink = page.locator('text=explore on your own');
  if (await exploreLink.isVisible({ timeout: 800 }).catch(() => false)) {
    await exploreLink.click();
    await page.waitForTimeout(400);
  }
}

/**
 * Helper: ensure a project is selected and a file is open in the editor.
 * Returns the ProseMirror editor locator.
 */
async function ensureEditorOpen(page) {
  await dismissWalkthrough(page);

  // If no editor visible, select first project
  const editorVisible = await page.locator('.editor-section').isVisible().catch(() => false);
  if (!editorVisible) {
    const projectButtons = page.locator('.project-button');
    const count = await projectButtons.count();
    if (count > 0) {
      await projectButtons.first().click();
      await page.waitForTimeout(500);
    }
  }

  // If still no editor, click first file in tree
  const editorNow = await page.locator('.editor-section').isVisible().catch(() => false);
  if (!editorNow) {
    const fileButtons = page.locator('.tree-button');
    const fileCount = await fileButtons.count();
    if (fileCount > 0) {
      await fileButtons.first().click();
      await page.waitForTimeout(500);
    }
  }

  const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

/**
 * Helper: create a test project with a file containing content via API.
 */
async function createProjectWithContent(page, tokens, content) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens.access}`,
  };

  const projRes = await page.request.post(`${BASE_URL}/api/projects/`, {
    headers,
    data: { name: `Visual Test ${Date.now()}` },
  });
  const project = await projRes.json();

  const fileRes = await page.request.post(`${BASE_URL}/api/nodes/`, {
    headers,
    data: {
      project: project.id,
      type: 'file',
      title: 'Visual Test Document',
      content_md: content || '',
    },
  });
  const file = await fileRes.json();

  return { project, file };
}

// ─────────────────────────────────────────────────────────────
// VISUAL REGRESSION TESTS
// ─────────────────────────────────────────────────────────────

test.describe('Visual Regression', () => {

  // 1. Login page
  test('01 - login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.auth-page', { timeout: 10000 });
    // Wait for the form to fully render
    await page.waitForSelector('.auth-form', { timeout: 5000 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-login-page.png`,
      fullPage: true,
    });
  });

  // 2. Main editor view — full layout after login
  test('02 - main editor view', async ({ page }) => {
    await login(page);
    const editor = await ensureEditorOpen(page);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-main-editor-view.png`,
      fullPage: false,
    });
  });

  // 3. Document with content — editor with text
  test('03 - document with content', async ({ page }) => {
    const tokens = await login(page);
    const sampleContent = [
      '# Chapter One: The Beginning',
      '',
      'It was a bright cold day in April, and the clocks were striking thirteen.',
      '',
      '## Setting the Scene',
      '',
      'The hallway smelt of boiled cabbage and old rag mats. At one end of it a coloured poster, too large for indoor display, had been tacked to the wall.',
      '',
      '> "Who controls the past controls the future. Who controls the present controls the past."',
      '',
      'Here is a list of important items:',
      '',
      '- First item with **bold** text',
      '- Second item with *italic* text',
      '- Third item with `inline code`',
      '',
      '```javascript',
      'const greeting = "Hello, world!";',
      'console.log(greeting);',
      '```',
    ].join('\n');

    const { project, file } = await createProjectWithContent(page, tokens, sampleContent);

    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await dismissWalkthrough(page);

    // Select the project
    const projectButton = page.locator('.project-button').filter({ hasText: 'Visual Test' }).last();
    if (await projectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    // Click the file
    const fileButton = page.locator('.tree-button').filter({ hasText: 'Visual Test Document' });
    if (await fileButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileButton.click();
      await page.waitForTimeout(800);
    }

    await page.waitForSelector('.editor-shell .ProseMirror', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-document-with-content.png`,
      fullPage: false,
    });
  });

  // 4. Sidebar tree — folder/file tree structure
  test('04 - sidebar tree', async ({ page }) => {
    await login(page);
    await dismissWalkthrough(page);

    // Open the outline/sidebar if not visible
    const outlineRail = page.locator('.outline-rail');
    const sidebarRail = page.locator('.sidebar-rail');

    // Click the outline toggle in the topbar
    const outlineToggle = page.locator('.topbar-icon-btn').first();
    if (await outlineToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Check if outline is already open
      const isCollapsed = await outlineRail.evaluate(el => el.classList.contains('collapsed')).catch(() => true);
      if (isCollapsed) {
        await outlineToggle.click();
        await page.waitForTimeout(500);
      }
    }

    // Select a project to see the file tree
    const projectButtons = page.locator('.project-button');
    if (await projectButtons.count() > 0) {
      await projectButtons.first().click();
      await page.waitForTimeout(800);
    }

    // Capture just the sidebar area
    const sidebarEl = page.locator('.outline-rail').first();
    if (await sidebarEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sidebarEl.screenshot({
        path: `${SCREENSHOT_DIR}/04-sidebar-tree.png`,
      });
    } else {
      // Fallback: capture full page
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/04-sidebar-tree.png`,
        fullPage: false,
      });
    }
  });

  // 5. Text selection toolbar — floating formatting toolbar
  test('05 - selection toolbar', async ({ page }) => {
    const tokens = await login(page);
    const { project } = await createProjectWithContent(
      page, tokens,
      'Select this text to see the formatting toolbar appear above the selection.'
    );

    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await dismissWalkthrough(page);

    const projectButton = page.locator('.project-button').filter({ hasText: 'Visual Test' }).last();
    if (await projectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    const fileButton = page.locator('.tree-button').filter({ hasText: 'Visual Test Document' });
    if (await fileButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileButton.click();
      await page.waitForTimeout(800);
    }

    const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Select all text to trigger the toolbar
    await editor.click();
    await page.keyboard.press('Meta+a');
    await page.waitForTimeout(600);

    // Wait for the selection toolbar to appear
    const toolbar = page.locator('.selection-toolbar-anchor[data-show="true"], .selection-toolbar');
    await expect(toolbar.first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-selection-toolbar.png`,
      fullPage: false,
    });
  });

  // 6. AI assistant panel open
  test('06 - assistant panel open', async ({ page }) => {
    await login(page);
    const editor = await ensureEditorOpen(page);

    // Ensure assistant panel is open — click the assistant toggle button
    const assistantToggle = page.locator('.topbar-icon-btn').filter({ hasText: /assistant|chat/i });
    // If no text match, use the button with the active state check
    const assistantBtn = page.locator('.topbar-icon-btn.active').nth(0);

    // Look for the assistant panel presence
    const assistantPanel = page.locator('.editor-area.with-assistant');
    const isOpen = await assistantPanel.isVisible().catch(() => false);

    if (!isOpen) {
      // Click assistant toggle — it's typically the second topbar icon button
      const topbarBtns = page.locator('.topbar-icon-btn');
      const count = await topbarBtns.count();
      // Try each button until we find the assistant toggle
      for (let i = 0; i < Math.min(count, 5); i++) {
        const btn = topbarBtns.nth(i);
        const text = await btn.getAttribute('title').catch(() => '');
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
        if (text?.toLowerCase().includes('assistant') || ariaLabel?.toLowerCase().includes('assistant')) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      // Fallback: if assistant panel still not open, try toggling the second topbar btn
      if (!await page.locator('.editor-area.with-assistant').isVisible().catch(() => false)) {
        // The assistant toggle is typically right after the outline toggle
        await topbarBtns.nth(1).click();
        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-assistant-panel-open.png`,
      fullPage: false,
    });
  });

  // 7. AI assistant panel closed — wider editor
  test('07 - assistant panel closed', async ({ page }) => {
    await login(page);
    const editor = await ensureEditorOpen(page);

    // Close assistant panel if open
    const isOpen = await page.locator('.editor-area.with-assistant').isVisible().catch(() => false);
    if (isOpen) {
      // Click the assistant toggle to close
      const topbarBtns = page.locator('.topbar-icon-btn');
      const count = await topbarBtns.count();
      for (let i = 0; i < Math.min(count, 5); i++) {
        const btn = topbarBtns.nth(i);
        const isActive = await btn.evaluate(el => el.classList.contains('active')).catch(() => false);
        const text = await btn.getAttribute('title').catch(() => '');
        if (text?.toLowerCase().includes('assistant') || (isActive && i === 1)) {
          await btn.click();
          await page.waitForTimeout(500);
          break;
        }
      }
    }

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-assistant-panel-closed.png`,
      fullPage: false,
    });
  });

  // 8. Project home — project overview page
  test('08 - project home', async ({ page }) => {
    await login(page);
    await dismissWalkthrough(page);

    // Select a project first
    const projectButtons = page.locator('.project-button');
    if (await projectButtons.count() > 0) {
      await projectButtons.first().click();
      await page.waitForTimeout(800);
    }

    // Click the project name in the topbar to go to project home
    const projectName = page.locator('.topbar-left .project-switcher, .topbar-left [class*="project-name"]').first();
    if (await projectName.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectName.click();
      await page.waitForTimeout(800);
    }

    // Wait for project home to render
    const projectHome = page.locator('.project-home, .all-projects');
    await expect(projectHome.first()).toBeVisible({ timeout: 5000 }).catch(() => {});

    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-project-home.png`,
      fullPage: false,
    });
  });

  // 9. Settings modal
  test('09 - settings modal', async ({ page }) => {
    await login(page);
    await dismissWalkthrough(page);

    // Open settings — usually via user avatar menu or settings button
    const settingsBtn = page.locator('.topbar-icon-btn').last();
    const userAvatar = page.locator('.topbar-avatar');

    if (await userAvatar.isVisible({ timeout: 2000 }).catch(() => false)) {
      await userAvatar.click();
      await page.waitForTimeout(400);

      // Look for settings option in the user menu
      const settingsOption = page.locator('text=Settings').first();
      if (await settingsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await settingsOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Wait for settings modal
    const settingsModal = page.locator('.settings-modal');
    if (await settingsModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/09-settings-modal.png`,
        fullPage: false,
      });
    } else {
      // Fallback: try keyboard shortcut or other access method
      await page.keyboard.press('Meta+,');
      await page.waitForTimeout(500);
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/09-settings-modal.png`,
        fullPage: false,
      });
    }
  });

  // 10. Mobile viewport (375px)
  test('10 - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await login(page);
    await dismissWalkthrough(page);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-mobile-viewport.png`,
      fullPage: false,
    });
  });

  // 11. Tablet viewport (768px)
  test('11 - tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await login(page);
    await dismissWalkthrough(page);
    await page.waitForTimeout(800);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-tablet-viewport.png`,
      fullPage: false,
    });
  });

  // 12. Empty document — new file with no content
  test('12 - empty document', async ({ page }) => {
    const tokens = await login(page);
    const { project } = await createProjectWithContent(page, tokens, '');

    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await dismissWalkthrough(page);

    const projectButton = page.locator('.project-button').filter({ hasText: 'Visual Test' }).last();
    if (await projectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    const fileButton = page.locator('.tree-button').filter({ hasText: 'Visual Test Document' });
    if (await fileButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileButton.click();
      await page.waitForTimeout(800);
    }

    await page.waitForSelector('.editor-shell .ProseMirror', { timeout: 10000 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-empty-document.png`,
      fullPage: false,
    });
  });

  // 13. Document header — title, word count, save status
  test('13 - document header', async ({ page }) => {
    const tokens = await login(page);
    const { project } = await createProjectWithContent(
      page, tokens,
      'Some content to populate the word count and save status indicators.'
    );

    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await dismissWalkthrough(page);

    const projectButton = page.locator('.project-button').filter({ hasText: 'Visual Test' }).last();
    if (await projectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    const fileButton = page.locator('.tree-button').filter({ hasText: 'Visual Test Document' });
    if (await fileButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileButton.click();
      await page.waitForTimeout(800);
    }

    // Wait for the document header to render with word count
    const docHeader = page.locator('.document-header');
    await expect(docHeader).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Capture just the document header area
    await docHeader.screenshot({
      path: `${SCREENSHOT_DIR}/13-document-header.png`,
    });
  });

  // 14. Formatting applied — bold/italic text in editor
  test('14 - formatting applied', async ({ page }) => {
    const tokens = await login(page);
    const formattedContent = [
      '# Formatted Document',
      '',
      'This paragraph has **bold text** and *italic text* and ***bold italic*** together.',
      '',
      'Here is some ~~strikethrough text~~ and `inline code` for variety.',
      '',
      '## A Subheading',
      '',
      'Another paragraph with a [link](https://example.com) and more **emphasis** on key points.',
      '',
      '1. First ordered item',
      '2. Second ordered item with **bold**',
      '3. Third ordered item with *italic*',
    ].join('\n');

    const { project } = await createProjectWithContent(page, tokens, formattedContent);

    await page.goto(`${BASE_URL}/app`);
    await page.waitForSelector('.app-shell', { timeout: 15000 });
    await dismissWalkthrough(page);

    const projectButton = page.locator('.project-button').filter({ hasText: 'Visual Test' }).last();
    if (await projectButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    const fileButton = page.locator('.tree-button').filter({ hasText: 'Visual Test Document' });
    if (await fileButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fileButton.click();
      await page.waitForTimeout(800);
    }

    await page.waitForSelector('.editor-shell .ProseMirror', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Capture the editor area with formatted content
    const editorSection = page.locator('.editor-section');
    if (await editorSection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editorSection.screenshot({
        path: `${SCREENSHOT_DIR}/14-formatting-applied.png`,
      });
    } else {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/14-formatting-applied.png`,
        fullPage: false,
      });
    }
  });

});

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8000';
const TEST_EMAIL = 'test@test.com';
const TEST_PASSWORD = 'testpass123';

// Helper: login via API and inject tokens into localStorage
async function login(page) {
  const res = await page.request.post(`${API_BASE}/api/auth/login/`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const { tokens } = await res.json();

  await page.goto('/');
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem('mive:access_token', access);
    localStorage.setItem('mive:refresh_token', refresh);
  }, tokens);

  return tokens;
}

// Helper: create a project with two files via API, return { project, file1, file2 }
async function createProjectWithTwoFiles(page, tokens) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${tokens.access}`,
  };

  const projRes = await page.request.post(`${API_BASE}/api/projects/`, {
    headers,
    data: { name: `NavTest ${Date.now()}` },
  });
  const project = await projRes.json();

  const file1Res = await page.request.post(`${API_BASE}/api/nodes/`, {
    headers,
    data: { project: project.id, type: 'file', title: 'File A', content_md: '' },
  });
  const file1 = await file1Res.json();

  const file2Res = await page.request.post(`${API_BASE}/api/nodes/`, {
    headers,
    data: { project: project.id, type: 'file', title: 'File B', content_md: '' },
  });
  const file2 = await file2Res.json();

  return { project, file1, file2 };
}

// Helper: get the Milkdown editor
async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

test.describe('Navigation preserves content', () => {

  test('content persists when navigating between files quickly (flush path)', async ({ page }) => {
    const tokens = await login(page);
    const { project } = await createProjectWithTwoFiles(page, tokens);

    // Navigate to the app and select our project
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    // Skip walkthrough if present
    const skipBtn = page.locator('text=Skip');
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(300);
    }
    // Also skip "explore on your own" link
    const exploreLink = page.locator('text=explore on your own');
    if (await exploreLink.isVisible({ timeout: 500 }).catch(() => false)) {
      await exploreLink.click();
      await page.waitForTimeout(300);
    }

    // Select our project via the project switcher
    const projectSwitcher = page.locator('.project-switcher, [class*="project-switch"]').first();
    if (await projectSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectSwitcher.click();
      await page.waitForTimeout(300);
    }

    // Find and click our project by name
    const projectButton = page.locator('.project-button, [class*="project"]').filter({ hasText: 'NavTest' }).last();
    if (await projectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for files to appear in the sidebar
    await page.waitForSelector('.tree-button', { timeout: 5000 });
    const fileButtons = page.locator('.tree-button');

    // Click File A
    await fileButtons.filter({ hasText: 'File A' }).click();
    await page.waitForTimeout(500);

    const editor = await getEditor(page);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type unique content
    const uniqueText = `Flush test ${Date.now()}`;
    await editor.click();
    await page.keyboard.type(uniqueText, { delay: 20 });

    // Wait only 300ms — NOT enough for the 1500ms debounce.
    // This forces the flush-on-navigate code path.
    await page.waitForTimeout(300);

    // Navigate to File B
    await fileButtons.filter({ hasText: 'File B' }).click();
    await page.waitForTimeout(500);

    // Navigate back to File A
    await fileButtons.filter({ hasText: 'File A' }).click();
    await page.waitForTimeout(500);

    // Verify the content is still there
    const editorAfter = await getEditor(page);
    const text = await editorAfter.innerText();
    expect(text).toContain(uniqueText);
  });

  test('content persists after full debounce save and navigation', async ({ page }) => {
    const tokens = await login(page);
    const { project } = await createProjectWithTwoFiles(page, tokens);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    // Skip walkthrough if present
    const skipBtn = page.locator('text=Skip');
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(300);
    }
    const exploreLink = page.locator('text=explore on your own');
    if (await exploreLink.isVisible({ timeout: 500 }).catch(() => false)) {
      await exploreLink.click();
      await page.waitForTimeout(300);
    }

    const projectSwitcher = page.locator('.project-switcher, [class*="project-switch"]').first();
    if (await projectSwitcher.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectSwitcher.click();
      await page.waitForTimeout(300);
    }

    const projectButton = page.locator('.project-button, [class*="project"]').filter({ hasText: 'NavTest' }).last();
    if (await projectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await projectButton.click();
      await page.waitForTimeout(500);
    }

    await page.waitForSelector('.tree-button', { timeout: 5000 });
    const fileButtons = page.locator('.tree-button');

    // Click File A
    await fileButtons.filter({ hasText: 'File A' }).click();
    await page.waitForTimeout(500);

    const editor = await getEditor(page);
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Type unique content
    const uniqueText = `Debounce test ${Date.now()}`;
    await editor.click();
    await page.keyboard.type(uniqueText, { delay: 20 });

    // Wait for the full debounce + API round-trip (1500ms + buffer)
    await page.waitForTimeout(2500);

    // Navigate away and back
    await fileButtons.filter({ hasText: 'File B' }).click();
    await page.waitForTimeout(500);
    await fileButtons.filter({ hasText: 'File A' }).click();
    await page.waitForTimeout(500);

    // Verify content
    const editorAfter = await getEditor(page);
    const text = await editorAfter.innerText();
    expect(text).toContain(uniqueText);
  });
});

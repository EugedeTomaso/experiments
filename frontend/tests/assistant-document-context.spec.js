import { test, expect } from '@playwright/test';

const DOC_A_CONTENT = 'ALPHA_CONTEXT_ONLY_20260210';
const DOC_B_CONTENT = 'BETA_CONTEXT_ONLY_20260210';

async function ensureOutlineOpen(page) {
  const outline = page.locator('.outline-rail');
  const visible = await outline.isVisible().catch(() => false);
  if (!visible) {
    await page.locator('button[aria-label="Toggle outline"]').click();
    await expect(outline).toBeVisible({ timeout: 3000 });
  }
}

async function setEditorContent(page, content) {
  const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10000 });
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  await page.keyboard.type(content, { delay: 20 });
  await page.waitForTimeout(300);
  return editor;
}

async function switchToFile(page, name) {
  await page.locator('.tree-label', { hasText: name }).click();
  await expect(page.locator('.document-header h1')).toContainText(name, { timeout: 5000 });
}

test.describe('Assistant Context Isolation', () => {
  test('uses only active document as context and updates only that document', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.app-shell', { timeout: 10000 });

    await ensureOutlineOpen(page);

    const projectName = `Context Isolation ${Date.now()}`;
    await page.locator('.project-switcher-trigger').click();
    page.once('dialog', async (dialog) => {
      await dialog.accept(projectName);
    });
    await page.locator('.project-switcher-item', { hasText: '+ New project' }).click();
    await page.waitForTimeout(500);

    // Create Doc A
    page.once('dialog', async (dialog) => {
      await dialog.accept('Context Doc A');
    });
    await page.locator('button.ghost', { hasText: '+ File' }).click();
    await page.waitForTimeout(500);
    await setEditorContent(page, DOC_A_CONTENT);

    // Create Doc B
    page.once('dialog', async (dialog) => {
      await dialog.accept('Context Doc B');
    });
    await page.locator('button.ghost', { hasText: '+ File' }).click();
    await page.waitForTimeout(500);
    await setEditorContent(page, DOC_B_CONTENT);

    // Ensure Doc A is active before invoking assistant
    await switchToFile(page, 'Context Doc A');

    // Mock agent resolve so we don't depend on external providers
    await page.route('**/api/agent-configs/resolve/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          config: {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.7,
            system_prompt: '',
          },
          agent_id: null,
          agent_name: null,
          inherited: false,
        }),
      });
    });

    const contextCheck = { includesDocA: false, includesDocB: false, systemContent: '' };
    const docAEscaped = DOC_A_CONTENT.replace(/_/g, '\\_');
    const docBEscaped = DOC_B_CONTENT.replace(/_/g, '\\_');

    await page.route('**/api/ai/stream', async (route) => {
      const postData = route.request().postDataJSON();
      const messages = postData?.messages || [];
      const systemMessage = messages.find((m) => m.role === 'system')?.content || '';
      contextCheck.systemContent = systemMessage;
      contextCheck.includesDocA = systemMessage.includes(DOC_A_CONTENT) || systemMessage.includes(docAEscaped);
      contextCheck.includesDocB = systemMessage.includes(DOC_B_CONTENT) || systemMessage.includes(docBEscaped);

      const updated = `${DOC_A_CONTENT}\n\nEdited by assistant.`;
      const body = [
        '<document>\n',
        `${updated}\n`,
        '</document>\n\n',
        '<message>\n',
        'Updated current document.\n',
        '</message>',
      ]
        .map((delta) => `data: ${JSON.stringify({ delta })}\n\n`)
        .join('') + 'data: [DONE]\n\n';

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    });

    // Open assistant and send message
    const panel = page.locator('.assistant-panel');
    if (!(await panel.isVisible().catch(() => false))) {
      await page.locator('button[aria-label="Toggle assistant"]').click();
      await expect(panel).toBeVisible({ timeout: 3000 });
    }

    await page.locator('.assistant-input').fill('Please update this document.');
    await page.locator('.assistant-send').click();

    const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
    await expect(editor).toContainText('Edited by assistant.', { timeout: 5000 });
    await expect(editor).toContainText(DOC_A_CONTENT);

    // Switch to Doc B and confirm it is unchanged
    await switchToFile(page, 'Context Doc B');
    await expect(editor).toContainText(DOC_B_CONTENT, { timeout: 5000 });
    await expect(editor).not.toContainText('Edited by assistant.');

    expect(contextCheck.includesDocA).toBeTruthy();
    expect(contextCheck.includesDocB).toBeFalsy();
  });
});

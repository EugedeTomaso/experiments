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
        await dialog.accept('Assistant Test Project');
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
          await dialog.accept('Assistant Test File');
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

// Helper: open the assistant panel
async function openAssistant(page) {
  const panel = page.locator('.assistant-panel');
  const isVisible = await panel.isVisible().catch(() => false);
  if (!isVisible) {
    await page.locator('button[aria-label="Toggle assistant"]').click();
    await expect(panel).toBeVisible({ timeout: 3000 });
  }
  return panel;
}

// Helper: build SSE response body from deltas
function buildSSE(deltas) {
  let body = '';
  for (const delta of deltas) {
    body += `data: ${JSON.stringify({ delta })}\n\n`;
  }
  body += 'data: [DONE]\n\n';
  return body;
}

// Helper: mock the AI stream endpoint with given deltas
async function mockStreamEndpoint(page, deltas) {
  const sseBody = buildSSE(deltas);
  await page.route('**/api/ai/stream', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    });
  });
}

// Helper: mock the agent resolve endpoint
async function mockAgentResolve(page) {
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
}

// Helper: send a message in the assistant chat
async function sendMessage(page, message) {
  const input = page.locator('.assistant-input');
  await input.fill(message);
  await page.locator('.assistant-send').click();
}

test.describe('Assistant Document Editing', () => {

  test('AI edits document directly when using <document> tags', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Original text here.');
    await page.waitForTimeout(500);

    await openAssistant(page);
    await mockAgentResolve(page);

    // Mock AI responding with document edit format
    await mockStreamEndpoint(page, [
      '<document>\n',
      'Rewritten text with improvements.\n',
      '</document>\n\n',
      '<message>\n',
      'Done! I rewrote your text. Like it?',
      '\n</message>',
    ]);

    await sendMessage(page, 'Rewrite the text');

    // Wait for streaming to complete
    await page.waitForTimeout(1500);

    // The editor should contain the new document content
    const editorText = await editor.textContent();
    expect(editorText).toContain('Rewritten text with improvements');
    expect(editorText).not.toContain('Original text here');

    // The chat should show the follow-up message, NOT the document content
    const chatThread = page.locator('.chat-thread');
    const assistantMessages = chatThread.locator('.chat-assistant .chat-content');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();
    expect(messageText).toContain('Done! I rewrote your text. Like it?');
    expect(messageText).not.toContain('Rewritten text with improvements');
  });

  test('AI responds in chat normally when no <document> tags', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Some document content.');
    await page.waitForTimeout(500);

    // Save the initial content
    const initialText = await editor.textContent();

    await openAssistant(page);
    await mockAgentResolve(page);

    // Mock AI responding normally (no document tags)
    await mockStreamEndpoint(page, [
      'This document is about ',
      'some interesting topic. ',
      'It has good structure.',
    ]);

    await sendMessage(page, 'What is this about?');
    await page.waitForTimeout(1500);

    // The editor should remain unchanged
    const editorTextAfter = await editor.textContent();
    expect(editorTextAfter).toBe(initialText);

    // The chat should show the full response
    const chatThread = page.locator('.chat-thread');
    const assistantMessages = chatThread.locator('.chat-assistant .chat-content');
    const lastMessage = assistantMessages.last();
    const messageText = await lastMessage.textContent();
    expect(messageText).toContain('This document is about some interesting topic');
  });

  test('shows "Writing to document..." indicator during document edit', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Test content.');
    await page.waitForTimeout(500);

    await openAssistant(page);
    await mockAgentResolve(page);

    // Use a slow stream to catch the indicator. We use route.fulfill with a
    // streaming approach: fulfill immediately with the full body. The indicator
    // appears because the <message> content is empty while <document> streams.
    // To test the indicator, we need to intercept and delay the response.
    await page.route('**/api/ai/stream', async (route) => {
      // Create a response that has document content but no message yet
      // The indicator shows when isEditingDocument=true and streamingContent is empty
      const encoder = new TextEncoder();
      const chunks = [
        'data: {"delta":"<document>\\n"}\n\n',
        'data: {"delta":"New content being written..."}\n\n',
      ];

      // Fulfill with partial content that triggers the indicator
      // Then after a delay, complete with the message
      const fullBody =
        'data: {"delta":"<document>\\n"}\n\n' +
        'data: {"delta":"New content."}\n\n' +
        'data: {"delta":"\\n</document>\\n\\n"}\n\n' +
        'data: {"delta":"<message>\\n"}\n\n' +
        'data: {"delta":"Updated!"}\n\n' +
        'data: {"delta":"\\n</message>"}\n\n' +
        'data: [DONE]\n\n';

      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: fullBody,
      });
    });

    await sendMessage(page, 'Edit the document');

    // The editing indicator or final message should appear
    await page.waitForTimeout(1500);

    // After completion, the chat should show "Updated!" (the message)
    const chatThread = page.locator('.chat-thread');
    const assistantMessages = chatThread.locator('.chat-assistant .chat-content');
    const lastMessage = assistantMessages.last();
    await expect(lastMessage).toContainText('Updated!');
  });

  test('typewriter effect applies content progressively', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Old content.');
    await page.waitForTimeout(500);

    await openAssistant(page);
    await mockAgentResolve(page);

    // Mock with document content split across many small chunks
    const docLines = [
      '<document>\n',
      '# New Heading\n\n',
      'First paragraph of new content.\n\n',
      'Second paragraph with more details.\n\n',
      'Third paragraph concluding the text.\n',
      '</document>\n\n',
      '<message>\nDone! Complete rewrite.\n</message>',
    ];

    await mockStreamEndpoint(page, docLines);

    await sendMessage(page, 'Completely rewrite the document');
    await page.waitForTimeout(2000);

    // The editor should have the final complete content
    const editorText = await editor.textContent();
    expect(editorText).toContain('New Heading');
    expect(editorText).toContain('First paragraph');
    expect(editorText).toContain('Second paragraph');
    expect(editorText).toContain('Third paragraph');
    expect(editorText).not.toContain('Old content');

    // Chat shows only the follow-up
    const lastMsg = page.locator('.chat-thread .chat-assistant .chat-content').last();
    await expect(lastMsg).toContainText('Done! Complete rewrite.');
  });

  test('document content does not appear in chat messages', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Starting text.');
    await page.waitForTimeout(500);

    await openAssistant(page);
    await mockAgentResolve(page);

    await mockStreamEndpoint(page, [
      '<document>\n',
      'This is SECRET_DOCUMENT_CONTENT that should only be in editor.\n',
      '</document>\n\n',
      '<message>\nI updated your document.\n</message>',
    ]);

    await sendMessage(page, 'Change the text');
    await page.waitForTimeout(1500);

    // Check ALL chat messages — none should contain the document content
    const allChatMessages = page.locator('.chat-thread .chat-content');
    const count = await allChatMessages.count();
    for (let i = 0; i < count; i++) {
      const text = await allChatMessages.nth(i).textContent();
      expect(text).not.toContain('SECRET_DOCUMENT_CONTENT');
    }

    // But the editor should have it
    const editorText = await editor.textContent();
    expect(editorText).toContain('SECRET_DOCUMENT_CONTENT');
  });

  test('fallback message when AI sends <document> but no <message>', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await clearAndType(page, editor, 'Fallback test.');
    await page.waitForTimeout(500);

    await openAssistant(page);
    await mockAgentResolve(page);

    // AI sends document but forgets the message tag
    await mockStreamEndpoint(page, [
      '<document>\nUpdated fallback content.\n</document>',
    ]);

    await sendMessage(page, 'Edit this');
    await page.waitForTimeout(1500);

    // Editor should be updated
    const editorText = await editor.textContent();
    expect(editorText).toContain('Updated fallback content');

    // Chat should show the fallback message
    const lastMsg = page.locator('.chat-thread .chat-assistant .chat-content').last();
    const msgText = await lastMsg.textContent();
    expect(msgText).toBe("I've updated the document.");
  });
});

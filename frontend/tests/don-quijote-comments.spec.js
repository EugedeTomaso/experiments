import { test, expect } from '@playwright/test';

const QUIJOTE_TEXT =
  'En un lugar de la Mancha, de cuyo nombre no quiero acordarme, ' +
  'no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, ' +
  'adarga antigua, rocín flaco y galgo corredor. ' +
  'Una olla de algo más vaca que carnero, salpicón las más noches, ' +
  'duelos y quebrantos los sábados, lantejas los viernes, ' +
  'algún palomino de añadidura los domingos, ' +
  'consumían las tres partes de su hacienda.';

// Helper: get the Milkdown editor's ProseMirror contenteditable div
async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

// Helper: navigate to a file in the editor
async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const editorVisible = await page.locator('.editor-section').isVisible().catch(() => false);

  if (!editorVisible) {
    const projectButtons = page.locator('.project-button');
    const projectCount = await projectButtons.count();

    if (projectCount === 0) {
      page.once('dialog', async (dialog) => await dialog.accept('Quijote Project'));
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
        page.once('dialog', async (dialog) => await dialog.accept('Don Quijote'));
        await page.locator('button.ghost', { hasText: '+ File' }).click();
        await page.waitForTimeout(500);
      }
    }
  }

  const editor = await getEditor(page);
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

// Helper: set editor content via ProseMirror (faster than typing)
async function setEditorContent(page, editor, text) {
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);
  // Type character by character is too slow for long text, use clipboard
  await page.evaluate(async (t) => {
    // Use execCommand insertText to avoid clipboard permission issues
    document.execCommand('insertText', false, t);
  }, text);
  await page.waitForTimeout(500);
}

// Helper: select a specific substring in the ProseMirror editor using mouse drag.
// Handles text that spans across multiple DOM nodes (e.g. when highlights split text).
async function selectText(page, substring) {
  // Collect all text nodes and build a cross-node Range for the target text
  const rects = await page.evaluate((text) => {
    const pm = document.querySelector('.ProseMirror');
    // Collect all text nodes in document order
    const textNodes = [];
    const walker = document.createTreeWalker(pm, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) textNodes.push(node);

    // Build concatenated text and find substring
    let fullText = '';
    const nodeStarts = [];
    for (const n of textNodes) {
      nodeStarts.push(fullText.length);
      fullText += n.textContent;
    }
    const idx = fullText.indexOf(text);
    if (idx < 0) return null;
    const endIdx = idx + text.length;

    // Map to start/end DOM nodes + offsets
    let startNode, startOffset, endNode, endOffset;
    for (let i = 0; i < textNodes.length; i++) {
      const ns = nodeStarts[i];
      const ne = ns + textNodes[i].textContent.length;
      if (startNode == null && idx < ne) {
        startNode = textNodes[i];
        startOffset = idx - ns;
      }
      if (endIdx <= ne) {
        endNode = textNodes[i];
        endOffset = endIdx - nodeStarts[i];
        break;
      }
    }
    if (!startNode || !endNode) return null;

    // Get the start and end bounding rects (for mouse drag positions)
    const startRange = document.createRange();
    startRange.setStart(startNode, startOffset);
    startRange.setEnd(startNode, Math.min(startOffset + 1, startNode.textContent.length));
    const sr = startRange.getBoundingClientRect();

    const endRange = document.createRange();
    endRange.setStart(endNode, Math.max(0, endOffset - 1));
    endRange.setEnd(endNode, endOffset);
    const er = endRange.getBoundingClientRect();

    return {
      startX: sr.x,
      startY: sr.y + sr.height / 2,
      endX: er.x + er.width,
      endY: er.y + er.height / 2,
    };
  }, substring);

  if (!rects) throw new Error(`Text "${substring}" not found in editor`);

  // Click at start position, then drag to end position
  await page.mouse.click(rects.startX, rects.startY);
  await page.waitForTimeout(100);
  await page.mouse.move(rects.startX, rects.startY);
  await page.mouse.down();
  await page.mouse.move(rects.endX, rects.endY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600); // Wait for tooltip debounce (200ms) + rendering
}

// Helper: add an inline comment on currently selected text
async function addInlineComment(page, commentBody) {
  const toolbar = page.locator('.selection-toolbar-btn');
  await expect(toolbar).toBeVisible({ timeout: 5000 });

  await toolbar.dispatchEvent('mousedown');
  await page.waitForTimeout(500);

  const commentInput = page.locator('.comment-input-float');
  await expect(commentInput).toBeVisible({ timeout: 3000 });

  await commentInput.locator('textarea').fill(commentBody);
  await commentInput.locator('button.primary').click();
  await page.waitForTimeout(1000);

  // Verify input closes
  await expect(commentInput).not.toBeVisible({ timeout: 3000 });
}

test.describe('Don Quijote Inline Comments', () => {

  test('write Don Quijote intro and add inline comments to specific passages', async ({ page }) => {
    const editor = await navigateToEditor(page);

    // Set the Don Quijote text
    await setEditorContent(page, editor, QUIJOTE_TEXT);
    await expect(editor).toContainText('En un lugar de la Mancha');

    // --- Comment 1: select "la Mancha" ---
    await selectText(page, 'la Mancha');
    await addInlineComment(page, 'Referencia geográfica intencionalmente vaga');

    // Verify highlight exists
    const highlights = editor.locator('.comment-highlight');
    await expect(highlights.first()).toBeVisible({ timeout: 5000 });

    // Verify comment in the tab
    const inlineComments = page.locator('.comment-list .comment-inline');
    await expect(inlineComments.last()).toBeVisible({ timeout: 3000 });
    const quoted1 = inlineComments.last().locator('.comment-quoted');
    await expect(quoted1).toContainText('la Mancha');
    const body1 = inlineComments.last().locator('.comment-body');
    await expect(body1).toHaveText('Referencia geográfica intencionalmente vaga');

    // --- Comment 2: select "un hidalgo" ---
    await selectText(page, 'un hidalgo');
    await addInlineComment(page, 'Pequeña nobleza rural, sin grandes recursos');

    // Should now have 2 highlights
    const highlightCount = await highlights.count();
    expect(highlightCount).toBeGreaterThanOrEqual(2);

    // Verify second comment in tab
    const lastComment = inlineComments.last();
    const quoted2 = lastComment.locator('.comment-quoted');
    await expect(quoted2).toContainText('un hidalgo');
    const body2 = lastComment.locator('.comment-body');
    await expect(body2).toHaveText('Pequeña nobleza rural, sin grandes recursos');

    // --- Comment 3: select a longer passage ---
    await selectText(page, 'adarga antigua, rocín flaco y galgo corredor');
    await addInlineComment(page, 'Los tres atributos del hidalgo empobrecido');

    // Should now have 3+ highlights
    const finalHighlightCount = await highlights.count();
    expect(finalHighlightCount).toBeGreaterThanOrEqual(3);
  });

  test('clicking highlights shows popover for each comment', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await setEditorContent(page, editor, QUIJOTE_TEXT);

    // Create a comment on "cuyo nombre"
    await selectText(page, 'cuyo nombre');
    await addInlineComment(page, 'Narrador que finge olvidar');

    // Click on the highlight — find the one containing "cuyo nombre"
    const highlight = editor.locator('.comment-highlight', { hasText: 'cuyo nombre' }).first();
    await expect(highlight).toBeVisible({ timeout: 5000 });
    await highlight.click();
    await page.waitForTimeout(500);

    // Popover should appear and contain our comment somewhere
    const popover = page.locator('.comment-popover');
    await expect(popover).toBeVisible({ timeout: 3000 });
    await expect(popover).toContainText('Narrador que finge olvidar');

    // Click outside to dismiss the popover
    await editor.click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(500);
    await expect(popover).not.toBeVisible({ timeout: 3000 });
  });

  test('comments tab shows quoted text and clicking navigates', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await setEditorContent(page, editor, QUIJOTE_TEXT);

    // Create a comment
    await selectText(page, 'galgo corredor');
    await addInlineComment(page, 'Perro de caza, símbolo de hidalguía');

    // Verify the Comments tab shows inline comment
    const inlineComment = page.locator('.comment-list .comment-inline').last();
    await expect(inlineComment).toBeVisible({ timeout: 3000 });

    // Quoted text should be visible
    const quoted = inlineComment.locator('.comment-quoted');
    await expect(quoted).toContainText('galgo corredor');

    // Click elsewhere to remove focus from editor
    await page.locator('.comment-input textarea').click();
    await page.waitForTimeout(200);

    // Click the comment in the tab → should navigate to the text
    await inlineComment.click();
    await page.waitForTimeout(500);

    // Editor should now be focused
    const editorFocused = await editor.evaluate(
      (el) => el === document.activeElement || el.contains(document.activeElement)
    );
    expect(editorFocused).toBe(true);
  });

  test('both inline and document-level comments coexist', async ({ page }) => {
    const editor = await navigateToEditor(page);
    await setEditorContent(page, editor, QUIJOTE_TEXT);

    // Create an inline comment
    await selectText(page, 'salpicón las más noches');
    await addInlineComment(page, 'Cena habitual modesta');

    // Also create a document-level comment
    const generalTextarea = page.locator('.comment-input textarea');
    await generalTextarea.fill('Gran obra de la literatura universal');
    await page.locator('.comment-input button.primary').click();
    await page.waitForTimeout(500);

    // The comments tab should have both types
    const allComments = page.locator('.comment-list .comment');
    const count = await allComments.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Last one should be document-level (no .comment-inline class, no quoted text)
    const lastComment = allComments.last();
    const hasInlineClass = await lastComment.evaluate(el => el.classList.contains('comment-inline'));
    expect(hasInlineClass).toBe(false);
    const lastBody = lastComment.locator('.comment-body');
    await expect(lastBody).toHaveText('Gran obra de la literatura universal');
  });
});

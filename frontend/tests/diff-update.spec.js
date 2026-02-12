import { test, expect } from '@playwright/test';

async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

async function navigateToEditor(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  const editorVisible = await page
    .locator('.editor-shell .ProseMirror[contenteditable="true"]')
    .isVisible()
    .catch(() => false);

  if (!editorVisible) {
    const fileButtons = page.locator('.tree-button');
    const fileCount = await fileButtons.count();
    if (fileCount > 0) {
      await fileButtons.last().click();
      await page.waitForTimeout(500);
    } else {
      page.once('dialog', async (dialog) => {
        await dialog.accept('Diff Test File');
      });
      await page.locator('button', { hasText: '+ File' }).click();
      await page.waitForTimeout(800);
    }
  }

  const editor = await getEditor(page);
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

function buildSSE(deltas) {
  let body = '';
  for (const delta of deltas) {
    body += `data: ${JSON.stringify({ delta })}\n\n`;
  }
  body += 'data: [DONE]\n\n';
  return body;
}

async function mockAgentResolve(page) {
  await page.route('**/api/agent-configs/resolve/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        config: { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.7, system_prompt: '' },
        agent_id: null, agent_name: null, inherited: false,
      }),
    });
  });
}

async function openAssistant(page) {
  const pane = page.locator('.assistant-pane');
  const isVisible = await pane.isVisible().catch(() => false);
  if (!isVisible) {
    await page.locator('button[aria-label="Toggle assistant"]').click();
    await expect(pane).toBeVisible({ timeout: 3000 });
  }
  return pane;
}

async function sendMessage(page, message) {
  const textarea = page.locator('.assistant-pane-composer textarea');
  await textarea.fill(message);
  await page.locator('.assistant-pane-send').click();
}

async function setupMocks(page, deltas) {
  await mockAgentResolve(page);
  await page.route('**/api/ai/stream', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: buildSSE(deltas),
    });
  });
  await page.route('**/api/nodes/*/', (route) => {
    if (route.request().method() === 'PATCH') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, content_md: '' }),
      });
    } else {
      route.continue();
    }
  });
}

// Type 3 paragraphs into the editor (with Enter+Enter between them)
async function type3Paragraphs(page, editor, texts) {
  await editor.click();
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(100);

  for (let i = 0; i < texts.length; i++) {
    await page.keyboard.type(texts[i], { delay: 10 });
    if (i < texts.length - 1) {
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
    }
  }
  await page.waitForTimeout(500);
}

test.describe('Streaming diagnostic', () => {

  test('trace node.eq() during realistic streaming states', async ({ page }) => {
    const editor = await navigateToEditor(page);

    await type3Paragraphs(page, editor, [
      'First paragraph stays the same.',
      'Second paragraph stays the same.',
      'Third paragraph will change.',
    ]);

    // Enable diff logging
    await page.evaluate(() => { window.__diffLog = []; });

    // Tag DOM nodes before streaming
    const tagsBefore = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      const paras = Array.from(pm.querySelectorAll(':scope > p'));
      paras.forEach((p, i) => { p.__testId = `p-${i}`; });
      return paras.map(p => ({ text: p.textContent, id: p.__testId }));
    });
    console.log('BEFORE:', JSON.stringify(tagsBefore, null, 2));

    // Simulate streaming: call replaceContentDiff with each intermediate state
    // State 1: only first paragraph generated
    await page.evaluate(() => {
      window.__editorRef.replaceContentDiff(
        'First paragraph stays the same.',
        { streaming: true }
      );
    });
    await page.waitForTimeout(50);

    const state1 = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(
        p => ({ text: p.textContent, id: p.__testId || null })
      );
    });
    console.log('STATE 1 (after 1st para):', JSON.stringify(state1, null, 2));

    // State 2: first + second paragraph generated
    await page.evaluate(() => {
      window.__editorRef.replaceContentDiff(
        'First paragraph stays the same.\n\nSecond paragraph stays the same.',
        { streaming: true }
      );
    });
    await page.waitForTimeout(50);

    const state2 = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(
        p => ({ text: p.textContent, id: p.__testId || null })
      );
    });
    console.log('STATE 2 (after 2nd para):', JSON.stringify(state2, null, 2));

    // State 3: all three paragraphs, third one modified
    await page.evaluate(() => {
      window.__editorRef.replaceContentDiff(
        'First paragraph stays the same.\n\nSecond paragraph stays the same.\n\nMODIFIED third paragraph here.',
        { streaming: true }
      );
    });
    await page.waitForTimeout(50);

    const state3 = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(
        p => ({ text: p.textContent, id: p.__testId || null })
      );
    });
    console.log('STATE 3 (all 3 paras, 3rd changed):', JSON.stringify(state3, null, 2));

    // Final: apply without streaming flag (like finalize)
    await page.evaluate(() => {
      window.__editorRef.replaceContentDiff(
        'First paragraph stays the same.\n\nSecond paragraph stays the same.\n\nMODIFIED third paragraph here.'
      );
    });
    await page.waitForTimeout(50);

    const stateFinal = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(
        p => ({ text: p.textContent, id: p.__testId || null })
      );
    });
    console.log('FINAL:', JSON.stringify(stateFinal, null, 2));

    // Print the diff log
    const diffLog = await page.evaluate(() => window.__diffLog);
    console.log('DIFF LOG:', JSON.stringify(diffLog, null, 2));

    // Assertions: first two paragraphs should be preserved throughout
    const first = stateFinal.find(p => p.text.includes('First'));
    const second = stateFinal.find(p => p.text.includes('Second'));
    expect(first?.id).toBe('p-0');
    expect(second?.id).not.toBeNull();
  });

  test('partial paragraph tokens overwrite existing content (the bug)', async ({ page }) => {
    const editor = await navigateToEditor(page);

    await type3Paragraphs(page, editor, [
      'First paragraph stays the same.',
      'Second paragraph stays the same.',
      'Third paragraph will change.',
    ]);

    await page.evaluate(() => { window.__diffLog = []; });

    // Tag DOM nodes
    await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      Array.from(pm.querySelectorAll(':scope > p')).forEach((p, i) => {
        p.__testId = `p-${i}`;
      });
    });

    // Simulate realistic token-by-token streaming with PARTIAL paragraphs
    const intermediateStates = [
      'First paragraph stays the same.\n\nSec',                           // partial 2nd
      'First paragraph stays the same.\n\nSecond paragraph stays',         // partial 2nd
      'First paragraph stays the same.\n\nSecond paragraph stays the same.', // complete 2nd
      'First paragraph stays the same.\n\nSecond paragraph stays the same.\n\nMODIFIED', // partial 3rd
      'First paragraph stays the same.\n\nSecond paragraph stays the same.\n\nMODIFIED third paragraph here.', // complete
    ];

    const snapshots = [];
    for (const md of intermediateStates) {
      await page.evaluate((content) => {
        window.__editorRef.replaceContentDiff(content, { streaming: true });
      }, md);
      await page.waitForTimeout(30);

      const snapshot = await page.evaluate(() => {
        const pm = document.querySelector('.editor-shell .ProseMirror');
        return Array.from(pm.querySelectorAll(':scope > p')).map(
          p => ({ text: p.textContent, id: p.__testId || null })
        );
      });
      snapshots.push({ md: md.slice(-30), paras: snapshot });
    }

    for (const s of snapshots) {
      console.log(`After "...${s.md}":`);
      for (const p of s.paras) {
        const preserved = p.id ? `[${p.id}]` : '[NEW]';
        console.log(`  ${preserved} "${p.text}"`);
      }
    }

    const diffLog = await page.evaluate(() => window.__diffLog);
    console.log('\nDIFF LOG:');
    for (const entry of diffLog) {
      console.log(`  streaming=${entry.streaming}, old=${entry.oldContentCount}, new=${entry.newContentCount}`);
      for (const eq of entry.eqResults) {
        console.log(`    [${eq.idx}] eq=${eq.eq} old="${eq.oldText}" new="${eq.newText}"`);
      }
    }

    // After streaming, the second paragraph should NOT have been overwritten
    // with partial content. Check if it's preserved:
    const lastSnapshot = snapshots[snapshots.length - 1];
    const secondPara = lastSnapshot.paras.find(p => p.text.includes('Second'));
    console.log('\nSecond paragraph preserved?', secondPara?.id);
    // This SHOULD be preserved but currently might not be
  });
});

test.describe('Diff-based document updates', () => {

  test('change third paragraph: first two stay untouched', async ({ page }) => {
    const editor = await navigateToEditor(page);

    await type3Paragraphs(page, editor, [
      'First paragraph stays the same.',
      'Second paragraph stays the same.',
      'Third paragraph will change.',
    ]);

    // Tag DOM nodes to track identity
    const tagsBefore = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      const paras = Array.from(pm.querySelectorAll(':scope > p'));
      paras.forEach((p, i) => { p.__testId = `p-${i}`; });
      return paras.map(p => ({ text: p.textContent, id: p.__testId }));
    });
    console.log('Before:', JSON.stringify(tagsBefore));

    await openAssistant(page);

    // AI streams the complete document but only changes the third paragraph.
    // Crucially: streams paragraph-by-paragraph like a real LLM would.
    await setupMocks(page, [
      '<document>\n',
      'First paragraph stays the same.\n\n',   // chunk 1: first para
      'Second paragraph stays the same.\n\n',  // chunk 2: second para
      'MODIFIED third paragraph here.\n',       // chunk 3: changed para
      '</document>\n\n',
      '<message>\nDone!\n</message>',
    ]);

    await sendMessage(page, 'Change the third paragraph');
    await page.waitForTimeout(2500);

    // Verify final content
    await expect(editor).toContainText('First paragraph stays the same');
    await expect(editor).toContainText('Second paragraph stays the same');
    await expect(editor).toContainText('MODIFIED third paragraph here');
    await expect(editor).not.toContainText('Third paragraph will change');

    // Check DOM identity — first two paragraphs should be the same DOM nodes
    const tagsAfter = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(
        p => ({ text: p.textContent, id: p.__testId || null })
      );
    });
    console.log('After:', JSON.stringify(tagsAfter));

    const first = tagsAfter.find(p => p.text.includes('First'));
    const second = tagsAfter.find(p => p.text.includes('Second'));
    const third = tagsAfter.find(p => p.text.includes('MODIFIED'));

    console.log('First preserved:', first?.id);
    console.log('Second preserved:', second?.id);
    console.log('Third:', third?.id);

    // KEY: first and second paragraph DOM nodes must be preserved
    expect(first?.id).toBe('p-0');
    // p-1 was the empty para between first and second; p-2 was second
    // Accept either — what matters is it's NOT null (DOM was reused)
    expect(second?.id).not.toBeNull();
  });

  test('no duplicate paragraphs during streaming', async ({ page }) => {
    const editor = await navigateToEditor(page);

    await type3Paragraphs(page, editor, [
      'Alpha one.',
      'Beta two.',
      'Gamma three.',
    ]);

    await openAssistant(page);

    // AI streams document chunk by chunk (simulating real LLM streaming)
    await setupMocks(page, [
      '<document>\n',
      'Alpha one.\n\n',
      'Beta two.\n\n',
      'NEW Gamma three.\n',
      '</document>\n\n',
      '<message>\nUpdated!\n</message>',
    ]);

    await sendMessage(page, 'Change the third paragraph');
    await page.waitForTimeout(2500);

    // There should be exactly 3 content paragraphs (no duplicates)
    const paras = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p'))
        .map(p => p.textContent)
        .filter(t => t.trim() !== '');
    });
    console.log('Final paragraphs:', JSON.stringify(paras));

    expect(paras).toHaveLength(3);
    expect(paras[0]).toContain('Alpha one');
    expect(paras[1]).toContain('Beta two');
    expect(paras[2]).toContain('NEW Gamma three');
  });

  test('slow streaming: simulate intermediate states via mocked SSE', async ({ page }) => {
    const editor = await navigateToEditor(page);

    await type3Paragraphs(page, editor, [
      'Para uno.',
      'Para dos.',
      'Para tres.',
    ]);

    // Tag DOM nodes to track if paragraphs get duplicated
    await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      Array.from(pm.querySelectorAll(':scope > p')).forEach((p, i) => {
        p.__tag = `orig-${i}`;
      });
    });

    await openAssistant(page);

    // Simulate slow streaming by using many small SSE chunks
    // The 200ms throttle in App.jsx means each chunk triggers a diff update
    await mockAgentResolve(page);
    await page.route('**/api/nodes/*/', (route) => {
      if (route.request().method() === 'PATCH') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, content_md: '' }),
        });
      } else {
        route.continue();
      }
    });

    // Create a streaming response with artificial delays via chunked SSE
    // Each data event is a separate chunk
    await page.route('**/api/ai/stream', (route) => {
      const body = [
        'data: {"delta":"<document>\\n"}\n\n',
        'data: {"delta":"Para uno.\\n\\n"}\n\n',
        'data: {"delta":"Para dos.\\n\\n"}\n\n',
        'data: {"delta":"NUEVO Para tres.\\n"}\n\n',
        'data: {"delta":"</document>\\n\\n"}\n\n',
        'data: {"delta":"<message>\\nListo!\\n</message>"}\n\n',
        'data: [DONE]\n\n',
      ].join('');
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    });

    await sendMessage(page, 'Change the third paragraph');
    await page.waitForTimeout(2500);

    // After everything settles, check for duplicates
    const finalState = await page.evaluate(() => {
      const pm = document.querySelector('.editor-shell .ProseMirror');
      return Array.from(pm.querySelectorAll(':scope > p')).map(p => ({
        text: p.textContent,
        tag: p.__tag || null,
      }));
    });
    console.log('Final state:', JSON.stringify(finalState));

    const content = finalState.filter(p => p.text.trim() !== '');
    console.log('Content paragraphs:', JSON.stringify(content));

    // No duplicates — exactly 3 content paragraphs
    expect(content).toHaveLength(3);
    expect(content[0].text).toBe('Para uno.');
    expect(content[1].text).toBe('Para dos.');
    expect(content[2].text).toBe('NUEVO Para tres.');

    // Original first and second paragraphs should be preserved
    expect(content[0].tag).toBe('orig-0');
    // orig-2 was the second content paragraph (orig-1 was an empty spacer)
    expect(content[1].tag).toBe('orig-2');
  });
});

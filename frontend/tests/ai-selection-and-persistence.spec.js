import { test, expect } from "@playwright/test";

// ── Auth & API Mocking ──────────────────────────────────────────

const FAKE_TOKENS = {
  access: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjo5OTk5OTk5OTk5LCJ1c2VyX2lkIjoxfQ.fake",
  refresh: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6OTk5OTk5OTk5OSwidXNlcl9pZCI6MX0.fake",
};

const FAKE_PROJECT = {
  id: 1,
  name: "Test Project",
  brief: "",
  created_at: "2026-01-01T00:00:00Z",
};

const FAKE_NODE_A = {
  id: 10,
  project: 1,
  title: "Test File A",
  type: "file",
  parent: null,
  position: 0,
  created_at: "2026-01-01T00:00:00Z",
};

const FAKE_NODE_B = {
  id: 11,
  project: 1,
  title: "Test File B",
  type: "file",
  parent: null,
  position: 1,
  created_at: "2026-01-01T00:00:00Z",
};

const FAKE_VERSION_A = {
  id: 100,
  node: 10,
  content: "The quick brown fox jumps over the lazy dog. This is a test paragraph for AI selection.",
  version_number: 1,
  created_at: "2026-01-01T00:00:00Z",
};

const FAKE_VERSION_B = {
  id: 101,
  node: 11,
  content: "Content of file B for testing.",
  version_number: 1,
  created_at: "2026-01-01T00:00:00Z",
};

async function mockAllAPIs(page) {
  // Auth — requests go to localhost:8000 (the API_BASE in the frontend)
  await page.route("**/api/auth/me/", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, name: "Test", email: "test@test.com" }),
    })
  );

  // Projects
  await page.route("**/api/projects/", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([FAKE_PROJECT]),
      });
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(FAKE_PROJECT) });
  });

  // Nodes
  await page.route("**/api/nodes/?project=*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([FAKE_NODE_A, FAKE_NODE_B]),
    })
  );
  await page.route("**/api/nodes/*", (route) => {
    if (route.request().method() === "PATCH" || route.request().method() === "PUT") {
      return route.fulfill({ status: 200, contentType: "application/json", body: route.request().postData() || "{}" });
    }
    return route.continue();
  });

  // Versions
  await page.route("**/api/versions/?node=10*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([FAKE_VERSION_A]),
    })
  );
  await page.route("**/api/versions/?node=11*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([FAKE_VERSION_B]),
    })
  );
  await page.route("**/api/versions/*", (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({ status: 200, contentType: "application/json", body: route.request().postData() || "{}" });
    }
    return route.continue();
  });

  // Comments
  await page.route("**/api/comments/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Agents
  await page.route("**/api/agents/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Agent config resolve
  await page.route("**/api/agent-configs/resolve/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        config: { provider: "deepseek", model: "deepseek-chat", temperature: 0.7, system_prompt: "" },
        agent_id: null,
        agent_name: null,
        inherited: false,
      }),
    })
  );

  // Conversations & messages
  await page.route("**/api/conversations/*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, node: 10, created_at: "2026-01-01T00:00:00Z" }),
    });
  });
  await page.route("**/api/messages/*", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, role: "user", content: "test" }),
    });
  });

  // Memories
  await page.route("**/api/memories/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  // Catch-all for any other API calls
  await page.route("**/api/**", (route) => {
    if (route.request().resourceType() === "fetch" || route.request().resourceType() === "xhr") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.continue();
  });
}

async function setupAuthAndNavigate(page) {
  // Mock all APIs BEFORE any navigation
  await mockAllAPIs(page);

  // Navigate to set localStorage (this will show landing since no auth yet)
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // Set tokens in localStorage
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("mive:access_token", access);
    localStorage.setItem("mive:refresh_token", refresh);
    localStorage.setItem("mive:walkthrough-seen", "true");
  }, FAKE_TOKENS);

  // Navigate to /app — the protected route that shows the editor
  await page.goto("/app");
  await page.waitForLoadState("networkidle");
}

// ── Helpers ──────────────────────────────────────────────────────

async function getEditor(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

async function waitForEditor(page) {
  const editor = await getEditor(page);
  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

function buildSSE(deltas) {
  let body = "";
  for (const delta of deltas) {
    body += `data: ${JSON.stringify({ delta })}\n\n`;
  }
  body += "data: [DONE]\n\n";
  return body;
}

async function ensureAssistantOpen(page) {
  const panel = page.locator(".assistant-panel");
  const isVisible = await panel.isVisible().catch(() => false);
  if (!isVisible) {
    const chatTab = page.locator("button", { hasText: "Chat" }).first();
    if (await chatTab.isVisible().catch(() => false)) {
      await chatTab.click();
    }
    await expect(panel).toBeVisible({ timeout: 5000 });
  }
  return panel;
}

// ── Test 1: AI menu appears when selecting text ──────────────────

test.describe("AI Selection Menu", () => {
  test("selection toolbar shows Ask AI button and opens chat with context", async ({
    page,
  }) => {
    await setupAuthAndNavigate(page);

    // Wait for the app shell and editor
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    const editor = await waitForEditor(page);
    await page.waitForTimeout(500);

    // Click in the editor and type some text
    await editor.click();
    await page.keyboard.type(
      "The quick brown fox jumps over the lazy dog. This is a test paragraph.",
      { delay: 10 }
    );
    await page.waitForTimeout(300);

    // Select text using keyboard (Home + Shift+Right 20 times)
    await page.keyboard.press("Home");
    await page.keyboard.down("Shift");
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("ArrowRight");
    }
    await page.keyboard.up("Shift");
    await page.waitForTimeout(500);

    // The selection toolbar should appear
    const toolbar = page.locator(".selection-toolbar");
    await expect(toolbar).toBeVisible({ timeout: 3000 });

    // It should have the Ask AI button
    const aiButton = toolbar.locator(".fmt-btn-ai");
    await expect(aiButton).toBeVisible();
    await expect(aiButton).toContainText("Ask AI");

    // It should also have formatting buttons
    await expect(toolbar.locator('button[title="Bold (⌘B)"]')).toBeVisible();
    await expect(toolbar.locator('button[title="Italic (⌘I)"]')).toBeVisible();
    await expect(toolbar.locator('button[title="Comment"]')).toBeVisible();

    // Click Ask AI using mousedown (same as the real button handler)
    await aiButton.dispatchEvent("mousedown");
    await page.waitForTimeout(500);

    // The assistant panel should open with context
    const composer = page.locator(".agent-composer");
    await expect(composer).toBeVisible({ timeout: 3000 });

    // Should show context block with the selected text
    const contextBlock = page.locator(".agent-context-block");
    await expect(contextBlock).toBeVisible({ timeout: 3000 });
    const contextText = await contextBlock
      .locator(".agent-context-text")
      .textContent();
    expect(contextText.length).toBeGreaterThan(0);

    // The textarea placeholder should indicate selection context
    const textarea = composer.locator("textarea");
    const placeholder = await textarea.getAttribute("placeholder");
    expect(placeholder).toContain("selection");
  });

  test("Ask AI context can be dismissed", async ({ page }) => {
    await setupAuthAndNavigate(page);
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    const editor = await waitForEditor(page);
    await page.waitForTimeout(500);

    // Trigger Ask AI via custom event (more reliable than UI interaction)
    await editor.evaluate((el) => {
      el.dispatchEvent(
        new CustomEvent("ai-selection-request", {
          detail: { from: 10, to: 30, text: "text to select for" },
          bubbles: true,
        })
      );
    });
    await page.waitForTimeout(500);

    // Context block should be visible
    const contextBlock = page.locator(".agent-context-block");
    await expect(contextBlock).toBeVisible({ timeout: 3000 });

    // Click dismiss button
    const dismissBtn = page.locator(".agent-context-dismiss");
    await dismissBtn.click();
    await page.waitForTimeout(300);

    // Context block should be gone
    await expect(contextBlock).not.toBeVisible();

    // Placeholder should revert to default
    const textarea = page.locator(".agent-composer textarea");
    const placeholder = await textarea.getAttribute("placeholder");
    expect(placeholder).toContain("Ask anything");
  });
});

// ── Test 2: AI persists across file navigation ───────────────────

test.describe("AI Persistence Across Files", () => {
  test("AI writes to document and content persists after navigation", async ({
    page,
  }) => {
    await setupAuthAndNavigate(page);
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    const editor = await waitForEditor(page);
    await page.waitForTimeout(500);

    await ensureAssistantOpen(page);

    // Mock the AI stream with document edit
    await page.route("**/api/ai/stream", (route) => {
      const body =
        'data: {"delta":"<document>\\n"}\n\n' +
        'data: {"delta":"# AI Generated Content\\n\\n"}\n\n' +
        'data: {"delta":"This is paragraph one of the AI response.\\n\\n"}\n\n' +
        'data: {"delta":"This is paragraph two with more details.\\n\\n"}\n\n' +
        'data: {"delta":"This is paragraph three concluding the thought.\\n"}\n\n' +
        'data: {"delta":"\\n</document>\\n\\n"}\n\n' +
        'data: {"delta":"<message>\\n"}\n\n' +
        'data: {"delta":"Done! I wrote three paragraphs."}\n\n' +
        'data: {"delta":"\\n</message>"}\n\n' +
        "data: [DONE]\n\n";

      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body,
      });
    });

    // Send a message in the assistant
    const textarea = page.locator(".agent-composer textarea");
    await textarea.fill("Write three paragraphs about AI");
    await page.locator(".agent-composer-send").click();

    // Wait for streaming to complete
    await page.waitForTimeout(2000);

    // The editor should contain the AI-generated content
    const editorText = await editor.textContent();
    expect(editorText).toContain("AI Generated Content");
    expect(editorText).toContain("paragraph one");
    expect(editorText).toContain("paragraph two");
    expect(editorText).toContain("paragraph three");

    // The chat should show the completion message
    const chatMessages = page.locator(".chat-thread .chat-assistant .chat-content");
    const lastMsg = chatMessages.last();
    await expect(lastMsg).toContainText("Done! I wrote three paragraphs");

    // Now navigate to the second file
    const secondFile = page.locator(".tree-item.file .tree-button").last();
    if (await secondFile.isVisible().catch(() => false)) {
      await secondFile.click();
      await page.waitForTimeout(1000);

      // Navigate back to first file
      const firstFile = page.locator(".tree-item.file .tree-button").first();
      await firstFile.click();
      await page.waitForTimeout(1000);

      // The editor should still have the AI content
      const editorAfter = await getEditor(page);
      const finalContent = await editorAfter.textContent();
      expect(finalContent).toContain("AI Generated Content");
      expect(finalContent).toContain("paragraph one");
    }
  });

  test("can chat on second file while first file has AI content", async ({
    page,
  }) => {
    await setupAuthAndNavigate(page);
    await page.waitForSelector(".app-shell", { timeout: 10000 });
    await waitForEditor(page);
    await page.waitForTimeout(500);

    await ensureAssistantOpen(page);

    // Send a message on first file with mocked response
    await page.route("**/api/ai/stream", (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: buildSSE(["Response for first file - marker ALPHA"]),
      });
    });

    const textarea = page.locator(".agent-composer textarea");
    await textarea.fill("Hello from file A");
    await page.locator(".agent-composer-send").click();
    await page.waitForTimeout(1500);

    // Verify the response appeared
    const chatThread = page.locator(".chat-thread");
    await expect(chatThread).toContainText("ALPHA");

    // Switch to second file
    const secondFile = page.locator(".tree-item.file .tree-button").last();
    const hasSecondFile = await secondFile.isVisible().catch(() => false);

    if (hasSecondFile) {
      await secondFile.click();
      await page.waitForTimeout(1000);

      // Mock a different response for file B
      await page.unroute("**/api/ai/stream");
      await page.route("**/api/ai/stream", (route) => {
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: buildSSE(["Response for second file - marker BETA"]),
        });
      });

      // Chat on second file
      const textareaB = page.locator(".agent-composer textarea");
      await textareaB.fill("Hello from file B");
      await page.locator(".agent-composer-send").click();
      await page.waitForTimeout(1500);

      // Should have BETA response
      const chatB = page.locator(".chat-thread");
      await expect(chatB).toContainText("BETA");

      // Switch back to first file
      const firstFile = page.locator(".tree-item.file .tree-button").first();
      await firstFile.click();
      await page.waitForTimeout(1000);

      // The first file's chat should still have ALPHA
      const chatBack = page.locator(".chat-thread");
      await expect(chatBack).toContainText("ALPHA");
      await expect(chatBack).toContainText("Hello from file A");
    }
  });
});

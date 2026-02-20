// @ts-check
import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const TEST_EMAIL = `flashtest_${Date.now()}@test.com`;
const TEST_PASSWORD = "TestPass123!";

async function setupAuth(page) {
  await page.evaluate(
    async ({ api, email, password }) => {
      await fetch(`${api}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "FlashTest" }),
      });
    },
    { api: API, email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  const res = await page.request.post(`${API}/api/auth/login/`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  const { tokens } = await res.json();

  await page.goto("/");
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("mive:access_token", access);
      localStorage.setItem("mive:refresh_token", refresh);
    },
    tokens
  );

  return tokens;
}

async function createProjectAndFile(page, tokens) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.access}`,
  };

  const projRes = await page.request.post(`${API}/api/projects/`, {
    headers,
    data: { name: `FlashTest ${Date.now()}` },
  });
  const project = await projRes.json();

  const fileRes = await page.request.post(`${API}/api/nodes/`, {
    headers,
    data: {
      project: project.id,
      type: "file",
      title: "Flash Test Doc",
      content_md:
        "The quick brown fox jumps over the lazy dog. This is the second sentence for testing. And here is a third sentence to make the document longer.",
    },
  });
  const file = await fileRes.json();

  return { project, file, headers };
}

async function createComment(page, headers, nodeId, quotedText, body) {
  const res = await page.request.post(`${API}/api/comments/`, {
    headers,
    data: {
      node: nodeId,
      quoted_text: quotedText,
      body,
      author_type: "assistant",
      comment_type: "review",
      status: "open",
    },
  });
  return res.json();
}

test.describe("Review card click → highlight flash", () => {
  let tokens;
  let project, file, headers;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    tokens = await setupAuth(page);
    const result = await createProjectAndFile(page, tokens);
    project = result.project;
    file = result.file;
    headers = result.headers;

    await createComment(
      page, headers, file.id,
      "quick brown fox",
      "Consider using a more descriptive phrase."
    );
    await createComment(
      page, headers, file.id,
      "second sentence",
      "This sentence could be improved."
    );

    await page.close();
  });

  test("clicking a review card scrolls to highlight and triggers flash animation", async ({
    page,
  }) => {
    // Inject auth and navigate
    await page.goto("/");
    await page.evaluate(
      ({ access, refresh }) => {
        localStorage.setItem("mive:access_token", access);
        localStorage.setItem("mive:refresh_token", refresh);
      },
      tokens
    );
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Open project switcher and select our project
    await page.locator(".project-switcher-trigger").click();
    await page.waitForTimeout(300);

    const projectItem = page.locator(".project-panel-item", {
      hasText: project.name,
    });
    await expect(projectItem).toBeVisible({ timeout: 5000 });
    await projectItem.click();
    await page.waitForTimeout(500);

    // Wait for editor to load with content (file auto-selected as it's the only one)
    const editor = page.locator(
      '.editor-shell .ProseMirror[contenteditable="true"]'
    );
    await expect(editor).toBeVisible({ timeout: 10000 });
    await expect(editor).toContainText("quick brown fox", { timeout: 5000 });

    // Wait for comment highlights to render
    const highlights = editor.locator(".comment-highlight");
    await expect(highlights.first()).toBeVisible({ timeout: 5000 });

    // Switch to review tab in assistant panel
    const reviewTab = page.locator(".agent-tab", { hasText: "Review" });
    await reviewTab.click();
    await page.waitForTimeout(500);

    // Verify review cards are visible
    const reviewCards = page.locator(".review-card");
    await expect(reviewCards.first()).toBeVisible({ timeout: 5000 });

    // Click the first review card
    await reviewCards.first().click();

    // The highlight should have both --active and --flash classes (set by decoration plugin)
    const flashingHighlight = page.locator(".comment-highlight--flash");
    await expect(flashingHighlight).toBeVisible({ timeout: 3000 });

    // The flash class should also have --active
    const activeHighlight = page.locator(".comment-highlight--active");
    await expect(activeHighlight).toBeVisible({ timeout: 2000 });

    // Flash should be removed after ~1.4s (flashId cleared by timeout)
    await expect(flashingHighlight).toHaveCount(0, { timeout: 3000 });

    // Active should persist
    await expect(activeHighlight).toBeVisible({ timeout: 2000 });

    // Click the second review card — flash should appear on a different highlight
    await reviewCards.nth(1).click();

    const flashingHighlight2 = page.locator(".comment-highlight--flash");
    await expect(flashingHighlight2).toBeVisible({ timeout: 3000 });
  });
});

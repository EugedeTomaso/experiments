// @ts-check
import { test, expect } from "@playwright/test";

const API =
  process.env.PLAYWRIGHT_API_BASE ||
  process.env.VITE_API_BASE ||
  "http://localhost:8000";
const TEST_PASSWORD = "TestPass123!";

async function setupAuth(page, email) {
  await page.request.post(`${API}/api/auth/register/`, {
    data: { email, password: TEST_PASSWORD, name: "ReviewHumanTest" },
  });

  const loginRes = await page.request.post(`${API}/api/auth/login/`, {
    data: { email, password: TEST_PASSWORD },
  });
  const { tokens } = await loginRes.json();
  return tokens;
}

async function createProjectAndFile(page, accessToken) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const projectRes = await page.request.post(`${API}/api/projects/`, {
    headers,
    data: { name: `Review Human ${Date.now()}` },
  });
  const project = await projectRes.json();

  const content = "Primer parrafo de prueba.\n\nSegundo parrafo de prueba.";
  const fileRes = await page.request.post(`${API}/api/nodes/`, {
    headers,
    data: {
      project: project.id,
      type: "file",
      title: "Review Human Comment Doc",
      content_md: content,
    },
  });
  const file = await fileRes.json();

  return { project, file, headers };
}

async function createHumanComment(page, headers, nodeId, body) {
  // Deliberately use a quoted_text shape that can drift from markdown serialization.
  const res = await page.request.post(`${API}/api/comments/`, {
    headers,
    data: {
      node: nodeId,
      body,
      author_type: "user",
      comment_type: "comment",
      status: "open",
      quoted_text: "Primer parrafo de prueba.\nSegundo parrafo de prueba.",
      position_from: 1,
      position_to: 56,
    },
  });
  return res.json();
}

async function dismissBlockingOverlays(page) {
  const exploreOwn = page.getByRole("button", { name: "or explore on your own" });
  if (await exploreOwn.isVisible().catch(() => false)) {
    await exploreOwn.click();
  }

  const closeButtons = page.getByRole("button", { name: "Close" });
  const closeCount = await closeButtons.count();
  if (closeCount > 0) {
    await closeButtons.first().click();
  }
}

test("human comments appear in Review suggestions", async ({ page }) => {
  const email = `review_human_${Date.now()}@test.com`;
  const tokens = await setupAuth(page, email);
  const { project, file, headers } = await createProjectAndFile(page, tokens.access);
  const commentBody = `Comentario humano visible ${Date.now()}`;
  await createHumanComment(page, headers, file.id, commentBody);

  await page.goto("/");
  await page.evaluate(({ access, refresh }) => {
    localStorage.setItem("mive:access_token", access);
    localStorage.setItem("mive:refresh_token", refresh);
    localStorage.setItem("mive:walkthrough-seen", "true");
  }, tokens);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".app-shell", { timeout: 10000 });
  await dismissBlockingOverlays(page);

  await page.locator(".project-switcher-trigger").click();
  const projectItem = page.locator(".project-panel-item", { hasText: project.name });
  await expect(projectItem).toBeVisible({ timeout: 5000 });
  await projectItem.click();

  const fileItem = page.locator(".tree-label", { hasText: file.title });
  if (await fileItem.isVisible().catch(() => false)) {
    await fileItem.click();
  }

  const editor = page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
  await expect(editor).toBeVisible({ timeout: 10000 });
  await expect(editor).toContainText("Primer parrafo de prueba.", { timeout: 5000 });

  const assistantPane = page.locator(".agent-pane");
  if (!(await assistantPane.isVisible().catch(() => false))) {
    await page.locator('button[aria-label="Toggle assistant"]').click();
    await expect(assistantPane).toBeVisible({ timeout: 5000 });
  }

  await page.locator(".agent-tab", { hasText: "Review" }).click();
  await page.locator(".review-sub-btn", { hasText: "Suggestions" }).click();

  const reviewCard = page.locator(".review-card", { hasText: commentBody });
  await expect(reviewCard).toBeVisible({ timeout: 5000 });
});

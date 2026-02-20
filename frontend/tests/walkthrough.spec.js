import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";

test.describe("Welcome Walkthrough", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Clear walkthrough flag
    await page.evaluate(() => {
      localStorage.removeItem("mive:walkthrough-seen");
    });
    // Delete all projects via API so the walkthrough triggers
    const projects = await page.evaluate(async (api) => {
      const res = await fetch(`${api}/api/projects/`);
      return res.json();
    }, API);
    for (const p of projects) {
      await page.evaluate(async ({ api, id }) => {
        await fetch(`${api}/api/projects/${id}/`, { method: "DELETE" });
      }, { api: API, id: p.id });
    }
    await page.reload();
    await page.waitForLoadState("networkidle");
  });

  test("shows all 5 pages with correct content and navigation", async ({ page }) => {
    // Page 1 — The Hook
    await expect(page.locator(".welcome")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".welcome-heading")).toContainText("A writing room, not a text editor.");
    await expect(page.locator(".welcome-brand-mark")).toBeVisible();
    await expect(page.locator(".welcome-skip")).toBeVisible();
    await page.screenshot({ path: "test-results/walkthrough-page-1.png" });

    // Navigate to page 2
    await page.locator(".welcome-nav-btn").last().click();
    await expect(page.locator(".welcome-heading")).toContainText("Every project has a shape.");
    await expect(page.locator(".welcome-tree-card")).toBeVisible();
    await page.waitForTimeout(300); // wait for animation
    await page.screenshot({ path: "test-results/walkthrough-page-2.png" });

    // Navigate to page 3
    await page.locator(".welcome-nav-btn").last().click();
    await expect(page.locator(".welcome-heading")).toContainText("AI that reads the whole project.");
    await expect(page.locator(".welcome-context-card")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/walkthrough-page-3.png" });

    // Navigate to page 4
    await page.locator(".welcome-nav-btn").last().click();
    await expect(page.locator(".welcome-heading")).toContainText("The right voice for the moment.");
    await expect(page.locator(".welcome-agents-row")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/walkthrough-page-4.png" });

    // Navigate to page 5
    await page.locator(".welcome-nav-btn").last().click();
    await expect(page.locator(".welcome-heading")).toContainText("Start your first project.");
    await expect(page.locator(".welcome-cta")).toBeVisible();
    await expect(page.locator(".welcome-alt")).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/walkthrough-page-5.png" });

    // Test back navigation
    await page.locator(".welcome-nav-btn").first().click();
    await expect(page.locator(".welcome-heading")).toContainText("The right voice for the moment.");

    // Test CTA — should open wizard
    await page.locator(".welcome-nav-btn").last().click();
    await page.locator(".welcome-cta").click();
    await expect(page.locator(".wizard")).toBeVisible();
  });

  test("skip dismisses walkthrough and persists", async ({ page }) => {
    await expect(page.locator(".welcome")).toBeVisible({ timeout: 10000 });
    await page.locator(".welcome-skip").click();
    await expect(page.locator(".welcome")).not.toBeVisible();

    // Verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".welcome")).not.toBeVisible();
  });
});

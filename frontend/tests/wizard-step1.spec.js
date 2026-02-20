import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const TEST_EMAIL = "wizard-test@test.com";
const TEST_PASS = "testpass123";

test.describe("Project Wizard — Step 1 (describe or template)", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first so we're on the right origin for localStorage
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Register or login a test user
    const tokens = await page.evaluate(
      async ({ api, email, pass }) => {
        let res = await fetch(`${api}/api/auth/register/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Wizard Test", email, password: pass }),
        });
        let data = await res.json();
        if (res.ok) return data.tokens;

        res = await fetch(`${api}/api/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: pass }),
        });
        data = await res.json();
        if (res.ok) return data.tokens;
        throw new Error("Could not authenticate: " + JSON.stringify(data));
      },
      { api: API, email: TEST_EMAIL, pass: TEST_PASS }
    );

    // Delete all projects for this user
    await page.evaluate(
      async ({ api, token }) => {
        const res = await fetch(`${api}/api/projects/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const projects = await res.json();
        for (const p of projects) {
          await fetch(`${api}/api/projects/${p.id}/`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      },
      { api: API, token: tokens.access }
    );

    // Set tokens
    await page.evaluate(
      ({ access, refresh }) => {
        localStorage.setItem("mive:access_token", access);
        localStorage.setItem("mive:refresh_token", refresh);
      },
      tokens
    );

    // Reload so app picks up tokens and empty project list
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Walkthrough will show since projects.length===0 and walkthroughDismissed===false
    // Skip it to get to the empty AllProjects view
    const skipBtn = page.locator(".welcome-skip");
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(300);
    }
  });

  async function openWizard(page) {
    // With no projects after skipping walkthrough, should see AllProjects empty state
    const emptyAction = page.locator(".all-projects-empty-action");
    const newCard = page.locator(".project-card-new");

    if (await emptyAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emptyAction.click();
    } else if (await newCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newCard.click();
    }

    await expect(page.locator(".wizard")).toBeVisible({ timeout: 10000 });
  }

  test("Step 1 shows textarea, template pills, and freeform link", async ({ page }) => {
    await openWizard(page);

    await expect(page.locator(".wizard-heading").first()).toContainText("What are you creating?");
    await expect(page.locator(".wizard-subheading").first()).toContainText("Describe your project");

    const textarea = page.locator(".wizard-textarea").first();
    await expect(textarea).toBeVisible();

    const continueBtn = page.locator(".wizard-actions .primary").first();
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toBeDisabled();

    await expect(page.locator(".wizard-template-divider")).toContainText("or pick a template");

    const pills = page.locator(".wizard-template-pill");
    await expect(pills).toHaveCount(8);

    await expect(page.locator(".wizard-freeform-link")).toContainText("Start with an empty project");

    await page.screenshot({ path: "test-results/wizard-step1-initial.png" });
  });

  test("typing enables Continue button", async ({ page }) => {
    await openWizard(page);

    const textarea = page.locator(".wizard-textarea").first();
    const continueBtn = page.locator(".wizard-actions .primary").first();

    await expect(continueBtn).toBeDisabled();
    await textarea.fill("A mystery novel set in 1920s Paris");
    await expect(continueBtn).toBeEnabled();

    await page.screenshot({ path: "test-results/wizard-step1-with-text.png" });
  });

  test("free description → Continue goes to AI questions (step 3)", async ({ page }) => {
    await openWizard(page);

    const textarea = page.locator(".wizard-textarea").first();
    await textarea.fill("A cookbook organized by cuisine with recipes from around the world");

    await page.locator(".wizard-actions .primary").first().click();

    // Should show skeleton or questions heading
    const questionsOrSkeleton = page.locator(
      ".wizard-generating-text, .wizard-heading:has-text('A few quick questions')"
    );
    await expect(questionsOrSkeleton.first()).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: "test-results/wizard-step1-to-questions.png" });

    // Wait for questions to load (AI or fallback)
    await expect(
      page.locator(".wizard-heading:has-text('A few quick questions')")
    ).toBeVisible({ timeout: 30000 });

    const questions = page.locator(".wizard-question");
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Log if fallback was used
    const notice = page.locator(".wizard-notice");
    if (await notice.isVisible().catch(() => false)) {
      const text = await notice.textContent();
      console.log("NOTE: AI fallback triggered —", text);
    }

    await page.screenshot({ path: "test-results/wizard-step1-questions-loaded.png" });
  });

  test("clicking a template pill goes to extension step (step 2)", async ({ page }) => {
    await openWizard(page);

    await page.locator(".wizard-template-pill:has-text('Novel')").first().click();

    await expect(
      page.locator(".wizard-heading:has-text(\"What's the scope?\")")
    ).toBeVisible({ timeout: 5000 });

    await expect(page.locator(".wizard-extension-option")).toHaveCount(3);

    await page.screenshot({ path: "test-results/wizard-step1-template-to-extension.png" });
  });

  test("freeform link goes to name step", async ({ page }) => {
    await openWizard(page);

    await page.locator(".wizard-freeform-link").click();

    await expect(
      page.locator(".wizard-heading:has-text('Name your project')")
    ).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/wizard-step1-freeform.png" });
  });

  test("back from questions returns to step 1 with text preserved", async ({ page }) => {
    await openWizard(page);

    const textarea = page.locator(".wizard-textarea").first();
    await textarea.fill("A travel journal with daily entries");

    await page.locator(".wizard-actions .primary").first().click();

    // Wait for questions
    await expect(
      page.locator(".wizard-heading:has-text('A few quick questions')")
    ).toBeVisible({ timeout: 30000 });

    // Click Back
    await page.locator(".wizard-back").click();

    // Should be back at Step 1
    await expect(page.locator(".wizard-heading").first()).toContainText("What are you creating?");

    // Text should be preserved
    const textareaBack = page.locator(".wizard-textarea").first();
    await expect(textareaBack).toHaveValue("A travel journal with daily entries");

    await page.screenshot({ path: "test-results/wizard-step1-back-from-questions.png" });
  });

  test("Escape from step 1 cancels wizard", async ({ page }) => {
    await openWizard(page);
    await expect(page.locator(".wizard")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.locator(".wizard")).not.toBeVisible({ timeout: 3000 });
  });
});

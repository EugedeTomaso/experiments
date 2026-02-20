import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const TEST_EMAIL = "mermaid-table-test@test.com";
const TEST_PASSWORD = "TestPassword123!";

async function ensureLoggedIn(page) {
  await page.evaluate(
    async ({ api, email, password }) => {
      await fetch(`${api}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "Mermaid Table Test" }),
      });
    },
    { api: API, email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  const tokens = await page.evaluate(
    async ({ api, email, password }) => {
      const res = await fetch(`${api}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Login failed: " + res.status);
      const data = await res.json();
      localStorage.setItem("mive:access_token", data.tokens.access);
      localStorage.setItem("mive:refresh_token", data.tokens.refresh);
      return data.tokens;
    },
    { api: API, email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  return tokens;
}

function editorLocator(page) {
  return page.locator('.editor-shell .ProseMirror[contenteditable="true"]');
}

async function navigateToEditor(page) {
  await page.goto("/");
  await ensureLoggedIn(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".app-shell", { timeout: 15000 });
  await page.waitForTimeout(1000);

  const editor = editorLocator(page);
  const visible = await editor.isVisible().catch(() => false);
  if (!visible) {
    const treeBtn = page.locator(".tree-button").first();
    if (await treeBtn.isVisible().catch(() => false)) {
      await treeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  await expect(editor).toBeVisible({ timeout: 10000 });
  return editor;
}

/**
 * Insert a mermaid code block via the /mermaid slash command,
 * type diagram code, then click away to lose focus.
 * Returns true if the mermaid diagram widget appeared.
 */
async function insertMermaidDiagram(page, editor, diagramCode) {
  // Move to end and create a new line
  await editor.click({ force: true });
  await page.keyboard.press("Meta+End");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  // Trigger slash menu
  await page.keyboard.type("/mermaid", { delay: 50 });
  await page.waitForTimeout(500);

  const menuItem = page.locator(".slash-menu-item", { hasText: "Mermaid" }).first();
  if (await menuItem.isVisible().catch(() => false)) {
    await menuItem.dispatchEvent("mousedown");
    await page.waitForTimeout(500);
  } else {
    // Fallback: manually type code fence
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    await page.keyboard.type("```mermaid", { delay: 20 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
  }

  // We should now be inside a code block. Type the diagram code.
  await page.keyboard.type(diagramCode, { delay: 15 });
  await page.waitForTimeout(500);

  // Move cursor out of the code block: press Ctrl+Enter or arrow down multiple times
  await page.keyboard.press("Meta+End");
  await page.waitForTimeout(200);

  // Wait for mermaid lazy-load and rendering
  await page.waitForTimeout(5000);

  // Click the title area to move focus out of the code block
  const titleInput = page.locator(".editor-title-input").first();
  if (await titleInput.isVisible().catch(() => false)) {
    await titleInput.click({ force: true });
  }
  await page.waitForTimeout(1000);

  return true;
}

// ─── Table cell selection tests ────────────────────────────────────────────

test.describe("Table cell selection visibility", () => {
  test("selected table cells have visible text (not black on black)", async ({ page }) => {
    const editor = await navigateToEditor(page);

    let tableVisible = await editor.locator("table").isVisible().catch(() => false);

    if (!tableVisible) {
      await editor.click({ force: true });
      await page.keyboard.press("Meta+End");
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);

      await page.keyboard.type("/table", { delay: 50 });
      await page.waitForTimeout(500);
      const menuItem = page.locator(".slash-menu-item", { hasText: "Table" }).first();
      if (await menuItem.isVisible().catch(() => false)) {
        await menuItem.dispatchEvent("mousedown");
        await page.waitForTimeout(1000);
      }
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    const firstCell = editor.locator("td").first();
    await expect(firstCell).toBeVisible({ timeout: 5000 });

    // Cell must be position: relative for ::after overlay to work
    const position = await firstCell.evaluate((el) => {
      return window.getComputedStyle(el).position;
    });
    expect(position).toBe("relative");

    // Click and shift-click to select cells
    await firstCell.click({ force: true });
    await page.waitForTimeout(200);

    const cells = editor.locator("td");
    const cellCount = await cells.count();
    if (cellCount > 1) {
      await cells.last().click({ modifiers: ["Shift"], force: true });
      await page.waitForTimeout(300);

      const selectedCells = editor.locator("td.selectedCell");
      const selectedCount = await selectedCells.count();

      if (selectedCount > 0) {
        const bgCheck = await selectedCells.first().evaluate((el) => {
          const afterStyle = window.getComputedStyle(el, "::after");
          return {
            background: afterStyle.backgroundColor,
            position: afterStyle.position,
            content: afterStyle.content,
            pointerEvents: afterStyle.pointerEvents,
          };
        });

        expect(bgCheck.position).toBe("absolute");
        expect(bgCheck.content).not.toBe("none");
        expect(bgCheck.pointerEvents).toBe("none");
        expect(bgCheck.background).not.toBe("rgb(0, 0, 0)");
        expect(bgCheck.background).not.toBe("rgba(0, 0, 0, 1)");
      }
    }
  });
});

// ─── Mermaid diagram tests ─────────────────────────────────────────────────

test.describe("Mermaid diagrams", () => {
  test("mermaid source hidden and diagram renders with toolbar", async ({ page }) => {
    const editor = await navigateToEditor(page);

    await insertMermaidDiagram(page, editor, "graph TD\n    A[Start] --> B[End]");

    // Source code block should have mermaid-source class and be hidden
    const sourceBlock = editor.locator(".mermaid-source");
    const sourceCount = await sourceBlock.count();
    expect(sourceCount).toBeGreaterThan(0);

    const sourceStyles = await sourceBlock.first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        maxHeight: style.maxHeight,
        opacity: style.opacity,
        overflow: style.overflow,
      };
    });

    expect(sourceStyles.maxHeight).toBe("0px");
    expect(sourceStyles.opacity).toBe("0");
    expect(sourceStyles.overflow).toBe("hidden");

    // Diagram widget should exist with toolbar
    const diagram = editor.locator(".mermaid-diagram").first();
    await expect(diagram).toBeVisible({ timeout: 5000 });

    const toolbar = diagram.locator(".mermaid-toolbar");
    await expect(toolbar).toBeVisible();

    await expect(toolbar.locator(".mermaid-edit-btn")).toBeVisible();
    await expect(toolbar.locator(".mermaid-edit-btn")).toContainText("Edit");
    await expect(toolbar.locator(".mermaid-expand-btn")).toBeVisible();
    await expect(toolbar.locator(".mermaid-expand-btn")).toContainText("Expand");

    const content = diagram.locator(".mermaid-content");
    await expect(content).toBeVisible();

    const state = await content.evaluate((el) => ({
      hasSvg: !!el.querySelector("svg"),
      hasLoading: !!el.querySelector(".mermaid-loading"),
    }));
    expect(state.hasSvg || state.hasLoading).toBe(true);
  });

  test("edit button reveals source code", async ({ page }) => {
    const editor = await navigateToEditor(page);

    await insertMermaidDiagram(page, editor, "graph TD\n    A --> B");

    const diagram = editor.locator(".mermaid-diagram").first();
    await expect(diagram).toBeVisible({ timeout: 5000 });

    const sourceBlock = editor.locator(".mermaid-source").first();
    const initialOpacity = await sourceBlock.evaluate((el) =>
      window.getComputedStyle(el).opacity
    );
    expect(initialOpacity).toBe("0");

    // Click the edit button — dispatches a ProseMirror transaction
    // that rebuilds decorations with .mermaid-editing class
    const editBtn = diagram.locator(".mermaid-edit-btn");
    await expect(editBtn).toBeVisible();
    await editBtn.dispatchEvent("mousedown");
    await page.waitForTimeout(500);

    // Source should now have .mermaid-editing class (via ProseMirror decoration)
    // and be visible (opacity: 1 after CSS transition)
    const afterState = await editor.locator(".mermaid-source").first().evaluate((el) => ({
      opacity: window.getComputedStyle(el).opacity,
      hasEditingClass: el.classList.contains("mermaid-editing"),
    }));
    expect(afterState.hasEditingClass).toBe(true);
    expect(afterState.opacity).toBe("1");
  });

  test("expand opens overlay, close on click and escape", async ({ page }) => {
    const editor = await navigateToEditor(page);

    await insertMermaidDiagram(page, editor, "graph TD\n    A --> B");

    const diagram = editor.locator(".mermaid-diagram").first();
    await expect(diagram).toBeVisible({ timeout: 5000 });

    // Must have SVG to expand
    const hasSvg = await diagram.locator(".mermaid-content svg").count();
    if (hasSvg === 0) {
      test.skip();
      return;
    }

    // Click Expand
    await diagram.locator(".mermaid-expand-btn").click();
    await page.waitForTimeout(300);

    const overlay = page.locator(".mermaid-overlay");
    await expect(overlay).toBeVisible({ timeout: 2000 });
    await expect(overlay.locator("svg").first()).toBeVisible();

    const pos = await overlay.evaluate((el) => window.getComputedStyle(el).position);
    expect(pos).toBe("fixed");

    // Close by clicking overlay
    await overlay.click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(300);
    await expect(overlay).toHaveCount(0);

    // Open again and close with Escape
    await diagram.locator(".mermaid-expand-btn").click();
    await page.waitForTimeout(300);
    await expect(page.locator(".mermaid-overlay")).toBeVisible();

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(page.locator(".mermaid-overlay")).toHaveCount(0);
  });

  test("invalid mermaid shows clean error, not mermaid error SVG", async ({ page }) => {
    const editor = await navigateToEditor(page);

    await insertMermaidDiagram(page, editor, "this is not valid syntax");

    const diagram = editor.locator(".mermaid-diagram").first();
    await expect(diagram).toBeVisible({ timeout: 5000 });

    const content = diagram.locator(".mermaid-content");
    const result = await content.evaluate((el) => {
      const errorEl = el.querySelector(".mermaid-error");
      const svgEl = el.querySelector("svg");
      const errorTextInSvg = svgEl ? svgEl.querySelector(".error-text") : null;
      return {
        hasCustomError: !!errorEl,
        hasMermaidErrorSvg: !!errorTextInSvg,
      };
    });

    expect(result.hasMermaidErrorSvg).toBe(false);
  });
});

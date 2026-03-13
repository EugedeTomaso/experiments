import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:8000";

function json(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test("switching between files does not replay the document open animation", async ({ page }) => {
  const now = new Date().toISOString();
  const project = {
    id: 101,
    name: "Navigation Animation",
    project_type: "freeform",
    project_extension: "",
    updated_at: now,
    current_user_role: "owner",
  };
  const nodes = [
    {
      id: 201,
      project: project.id,
      parent: null,
      type: "file",
      title: "File A",
      content_md: "Alpha content",
      summary: "Alpha content",
      updated_at: now,
      order: 0,
    },
    {
      id: 202,
      project: project.id,
      parent: null,
      type: "file",
      title: "File B",
      content_md: "Beta content",
      summary: "Beta content",
      updated_at: now,
      order: 1,
    },
  ];

  await page.addInitScript(() => {
    localStorage.setItem("mive:access_token", "test-access");
    localStorage.setItem("mive:refresh_token", "test-refresh");
    localStorage.setItem("mive:walkthrough-seen", "true");
  });

  await page.route(`${API_BASE}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;

    if (pathname === "/api/auth/me/") {
      await route.fulfill(json({ id: 1, email: "nav@test.com", username: "nav", name: "Nav Test" }));
      return;
    }

    if (pathname === "/api/projects/") {
      await route.fulfill(json([project]));
      return;
    }

    if (pathname === "/api/nodes/" && searchParams.get("project") === String(project.id)) {
      await route.fulfill(json(nodes));
      return;
    }

    if (pathname === "/api/provider-keys/") {
      await route.fulfill(json([]));
      return;
    }

    if (pathname === "/api/agents/" || pathname === "/api/memories/" || pathname === "/api/invitations/") {
      await route.fulfill(json([]));
      return;
    }

    if (pathname === "/api/memories/resolve/") {
      await route.fulfill(json(null));
      return;
    }

    if (pathname === "/api/agent-configs/") {
      await route.fulfill(json([]));
      return;
    }

    if (pathname === "/api/agent-configs/resolve/") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
      return;
    }

    if (
      pathname === "/api/comments/" ||
      pathname === "/api/versions/" ||
      pathname === "/api/critiques/" ||
      pathname === "/api/conversations/"
    ) {
      await route.fulfill(json([]));
      return;
    }

    await route.fulfill(json([]));
  });

  await page.goto("/app");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(".app-shell", { timeout: 10000 });
  await page.waitForSelector(".tree-button", { timeout: 5000 });

  const fileBButton = page.locator(".tree-button", { hasText: "File B" });
  const editorContent = page.locator("main .editor-content").first();
  const title = page.locator(".editable-title");

  await expect(title).toContainText("File A");
  await expect(editorContent).not.toHaveClass(/doc-entering/, { timeout: 1000 });

  await page.evaluate(() => {
    const target = document.querySelector("main .editor-content");
    window.__docEnteringLog = target ? [target.className] : [];
    if (!target) return;

    const observer = new MutationObserver(() => {
      window.__docEnteringLog.push(target.className);
    });
    observer.observe(target, { attributes: true, attributeFilter: ["class"] });
    window.__docEnteringObserver = observer;
  });

  await fileBButton.dispatchEvent("click");
  await expect(title).toContainText("File B");
  await page.waitForTimeout(150);

  const classLog = await page.evaluate(() => {
    window.__docEnteringObserver?.disconnect();
    return window.__docEnteringLog || [];
  });

  expect(classLog).not.toContain("editor-content doc-entering");
});

import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";
const TEST_EMAIL = "export-test@test.com";
const TEST_PASSWORD = "TestPassword123!";

/**
 * Register (if needed) and log in, storing JWT tokens in localStorage.
 * Returns the tokens object.
 */
async function ensureLoggedIn(page) {
  // Try registering — ignore if already exists
  await page.evaluate(
    async ({ api, email, password }) => {
      await fetch(`${api}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: "Export Test" }),
      });
    },
    { api: API, email: TEST_EMAIL, password: TEST_PASSWORD }
  );

  // Log in and store tokens
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

/**
 * Create a project + file node with content via API.
 */
async function createTestProject(tokens, projectType = "article") {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.access}`,
  };

  const projRes = await fetch(`${API}/api/projects/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Export Test Project",
      project_type: projectType,
    }),
  });
  const project = await projRes.json();

  const nodeRes = await fetch(`${API}/api/nodes/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      project: project.id,
      type: "file",
      title: "Test Document",
      content_md:
        "# Hello World\n\nThis is a **test document** for export.\n\n## Section Two\n\nSome *italic text* and `inline code`.\n\n- Bullet one\n- Bullet two\n- Bullet three\n",
      order: 0,
    }),
  });
  const node = await nodeRes.json();

  return { project, node };
}

async function deleteProject(tokens, projectId) {
  await fetch(`${API}/api/projects/${projectId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
}

// ─── API-level export tests ─────────────────────────────────────────────────

test.describe("Export API", () => {
  let tokens;
  let projectData;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    tokens = await ensureLoggedIn(page);
    projectData = await createTestProject(tokens, "article");
    await page.close();
  });

  test.afterAll(async () => {
    if (projectData?.project?.id) {
      await deleteProject(tokens, projectData.project.id);
    }
  });

  test("exports document as Markdown — content matches", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "md" }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");

    const body = await res.text();
    expect(body).toContain("# Hello World");
    expect(body).toContain("**test document**");
    expect(body).toContain("## Section Two");
  });

  test("exports document as HTML — valid HTML with template", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "html" }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toContain("text/html");

    const body = await res.text();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain("<title>Test Document</title>");
    expect(body).toContain("Hello World");
    expect(body).toContain("<strong>test document</strong>");
    expect(body).toContain("<em>italic text</em>");
  });

  test("exports document as PDF — binary response", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "pdf" }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toContain("application/pdf");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    // PDF magic bytes: %PDF
    const header = new Uint8Array(buf.slice(0, 4));
    expect(String.fromCharCode(...header)).toBe("%PDF");
  });

  test("exports document as DOCX — binary response", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "docx" }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toContain("officedocument");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
    // DOCX is a zip — magic bytes: PK
    const header = new Uint8Array(buf.slice(0, 2));
    expect(String.fromCharCode(...header)).toBe("PK");
  });

  test("exports full project — combines all nodes", async () => {
    // Add a second node
    await fetch(`${API}/api/nodes/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({
        project: projectData.project.id,
        type: "file",
        title: "Second Document",
        content_md: "Content of the second document.",
        order: 1,
      }),
    });

    const res = await fetch(
      `${API}/api/export/project/${projectData.project.id}/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({ format: "md" }),
      }
    );

    expect(res.ok).toBe(true);
    const body = await res.text();
    expect(body).toContain("Hello World");
    expect(body).toContain("Content of the second document");
  });

  test("formats endpoint returns correct formats per project type", async () => {
    const articleRes = await fetch(
      `${API}/api/export/formats/?type=article`,
      { headers: { Authorization: `Bearer ${tokens.access}` } }
    );
    const articleData = await articleRes.json();
    expect(articleData.formats).toContain("html");
    expect(articleData.formats).toContain("pdf");
    expect(articleData.formats).toContain("md");
    expect(articleData.formats).not.toContain("epub");

    const novelRes = await fetch(
      `${API}/api/export/formats/?type=novel`,
      { headers: { Authorization: `Bearer ${tokens.access}` } }
    );
    const novelData = await novelRes.json();
    expect(novelData.formats).toContain("epub");
    expect(novelData.formats).toContain("pdf");
    expect(novelData.formats).toContain("docx");
  });

  test("rejects invalid format with 400", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "invalid_format" }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("rejects missing format with 400", async () => {
    const res = await fetch(`${API}/api/export/node/${projectData.node.id}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("returns 404 for non-existent node", async () => {
    const res = await fetch(`${API}/api/export/node/99999/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "md" }),
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });
});

// ─── EPUB export (novel project with chapters) ─────────────────────────────

test.describe("EPUB export", () => {
  let tokens;
  let projectId;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    tokens = await ensureLoggedIn(page);

    // Create novel project with folder/file hierarchy
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.access}`,
    };

    const projRes = await fetch(`${API}/api/projects/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Test Novel", project_type: "novel" }),
    });
    const project = await projRes.json();
    projectId = project.id;

    const chRes = await fetch(`${API}/api/nodes/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project: project.id,
        type: "folder",
        title: "Chapter One",
        order: 0,
      }),
    });
    const chapter = await chRes.json();

    await fetch(`${API}/api/nodes/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project: project.id,
        parent: chapter.id,
        type: "file",
        title: "Scene 1",
        content_md: "The rain fell softly on the old cobblestones.",
        order: 0,
      }),
    });

    await page.close();
  });

  test.afterAll(async () => {
    if (projectId) await deleteProject(tokens, projectId);
  });

  test("exports novel as EPUB with correct content type", async () => {
    const res = await fetch(`${API}/api/export/project/${projectId}/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access}`,
      },
      body: JSON.stringify({ format: "epub" }),
    });

    expect(res.ok).toBe(true);
    expect(res.headers.get("Content-Type")).toContain("epub");

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(500);
    // EPUB is also a zip
    const header = new Uint8Array(buf.slice(0, 2));
    expect(String.fromCharCode(...header)).toBe("PK");
  });
});

// ─── Publish endpoints ──────────────────────────────────────────────────────

test.describe("Publish API", () => {
  let tokens;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    tokens = await ensureLoggedIn(page);
    await page.close();
  });

  test("connections list returns empty array initially", async () => {
    const res = await fetch(`${API}/api/publish/connections/`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("publish history returns empty array initially", async () => {
    const res = await fetch(`${API}/api/publish/history/`, {
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("twitter preview splits content into tweets", async () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokens.access}`,
    };

    // Create temp project + node
    const projRes = await fetch(`${API}/api/projects/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Tweet Test", project_type: "article" }),
    });
    const project = await projRes.json();

    const nodeRes = await fetch(`${API}/api/nodes/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project: project.id,
        type: "file",
        title: "Thread Test",
        content_md:
          "This is the first sentence of a tweet thread. It should be split into multiple tweets if the content is long enough. Here is another sentence to add more content. And yet another one to make it even longer. The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.",
        order: 0,
      }),
    });
    const node = await nodeRes.json();

    const res = await fetch(`${API}/api/publish/preview/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        platform: "twitter",
        node_id: node.id,
        options: { add_numbering: true },
      }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.platform).toBe("twitter");
    expect(Array.isArray(data.tweets)).toBe(true);
    expect(data.tweets.length).toBeGreaterThan(0);

    for (const tweet of data.tweets) {
      expect(tweet).toHaveProperty("text");
      expect(tweet).toHaveProperty("char_count");
      expect(tweet.char_count).toBeLessThanOrEqual(280);
    }

    // Cleanup
    await deleteProject(tokens, project.id);
  });
});

// ─── UI test: Export menu visible in editor ─────────────────────────────────

test.describe("Export menu UI", () => {
  let tokens;
  let projectData;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    tokens = await ensureLoggedIn(page);
    projectData = await createTestProject(tokens, "article");
    await page.close();
  });

  test.afterAll(async () => {
    if (projectData?.project?.id) {
      await deleteProject(tokens, projectData.project.id);
    }
  });

  test("export button appears in document meta row", async ({ page }) => {
    // Navigate and authenticate
    await page.goto("/");
    await ensureLoggedIn(page);
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Wait for app shell to load (auth passed)
    await page.waitForSelector(".app-shell", { timeout: 10000 });

    // Select the right project via project switcher
    const projectSwitcher = page.locator(".project-switcher-trigger");
    if (await projectSwitcher.isVisible()) {
      await projectSwitcher.click();
      await page.waitForTimeout(300);
      const projectItem = page.locator(".project-item").filter({ hasText: "Export Test Project" });
      if (await projectItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await projectItem.click();
        await page.waitForTimeout(500);
      } else {
        // Close switcher if project not found
        await page.keyboard.press("Escape");
      }
    }

    // Click on file node
    const treeFile = page.locator(".tree-button").filter({ hasText: "Test Document" });
    if (await treeFile.isVisible({ timeout: 5000 }).catch(() => false)) {
      await treeFile.click();
      await page.waitForTimeout(500);
    }

    // Verify export trigger is visible
    const exportTrigger = page.locator(".export-trigger");
    await expect(exportTrigger).toBeVisible({ timeout: 10000 });

    // Open dropdown
    await exportTrigger.click();
    await page.waitForTimeout(200);

    const dropdown = page.locator(".export-dropdown");
    await expect(dropdown).toBeVisible();

    // Should have export section labels
    await expect(dropdown.locator(".export-section-label").first()).toBeVisible();

    // Should have export items
    const items = dropdown.locator(".export-item");
    expect(await items.count()).toBeGreaterThan(0);

    // Should have publish section
    await expect(
      dropdown.locator(".export-section-label").filter({ hasText: "Publish" })
    ).toBeVisible();

    await page.screenshot({ path: "test-results/export-menu-open.png" });
  });
});

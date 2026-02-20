import { test, expect } from "@playwright/test";

const API = "http://localhost:8000";

// Unique emails for this test suite
const USER_A_EMAIL = "sharing-owner@test.com";
const USER_A_PASSWORD = "TestPassword123!";
const USER_A_NAME = "Owner Alice";

const USER_B_EMAIL = "sharing-collab@test.com";
const USER_B_PASSWORD = "TestPassword123!";
const USER_B_NAME = "Collaborator Bob";

// Shared state across serial tests
let userATokens;
let userBTokens;
let projectId;
let userBId;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureUser(page, { email, password, name }) {
  return page.evaluate(
    async ({ api, email, password, name }) => {
      // Try register
      let res = await fetch(`${api}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      let data = await res.json();
      if (res.ok) return { tokens: data.tokens, userId: data.user.id };

      // Already exists — login
      res = await fetch(`${api}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      data = await res.json();
      if (!res.ok) throw new Error("Auth failed: " + JSON.stringify(data));

      // Get user ID via /me
      const meRes = await fetch(`${api}/api/auth/me/`, {
        headers: { Authorization: `Bearer ${data.tokens.access}` },
      });
      const me = await meRes.json();
      return { tokens: data.tokens, userId: me.id };
    },
    { api: API, email, password, name }
  );
}

async function loginAs(page, tokens) {
  await page.evaluate(
    ({ access, refresh }) => {
      localStorage.setItem("mive:access_token", access);
      localStorage.setItem("mive:refresh_token", refresh);
    },
    tokens
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
}

async function waitForApp(page) {
  await page.waitForSelector(".app-shell", { timeout: 10000 });
}

async function dismissWalkthrough(page) {
  const skipBtn = page.locator(".welcome-skip");
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(300);
  }
}

async function openProjectSwitcher(page) {
  const trigger = page.locator(".project-switcher-trigger");
  await expect(trigger).toBeVisible({ timeout: 5000 });
  await trigger.click();
  await page.waitForTimeout(300);
  await expect(page.locator(".project-panel")).toBeVisible({ timeout: 3000 });
}

async function selectProject(page, projectName) {
  await openProjectSwitcher(page);
  const item = page.locator(".project-panel-item-name").filter({ hasText: projectName });
  await expect(item).toBeVisible({ timeout: 5000 });
  await item.click();
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle");
}

async function openFileNode(page, nodeTitle) {
  const treeItem = page.locator(".tree-button").filter({ hasText: nodeTitle });
  await expect(treeItem).toBeVisible({ timeout: 5000 });
  await treeItem.click();
  await page.waitForTimeout(500);
}

function getEditor(page) {
  return page.locator(".editor-shell .ProseMirror");
}

async function createProjectWithContent(tokens, name, nodeTitle, content) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokens.access}`,
  };

  const projRes = await fetch(`${API}/api/projects/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, project_type: "article" }),
  });
  const project = await projRes.json();

  await fetch(`${API}/api/nodes/`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      project: project.id,
      type: "file",
      title: nodeTitle,
      content_md: content,
      order: 0,
    }),
  });

  return project;
}

async function deleteProject(tokens, projId) {
  await fetch(`${API}/api/projects/${projId}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${tokens.access}` },
  });
}

// =============================================================================
// Suite 1: Full UI sharing flow (serial)
// =============================================================================

test.describe.serial("Project Sharing & Collaboration", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");

    // Create User A (owner)
    const userA = await ensureUser(page, {
      email: USER_A_EMAIL,
      password: USER_A_PASSWORD,
      name: USER_A_NAME,
    });
    userATokens = userA.tokens;

    // Create User B (collaborator)
    const userB = await ensureUser(page, {
      email: USER_B_EMAIL,
      password: USER_B_PASSWORD,
      name: USER_B_NAME,
    });
    userBTokens = userB.tokens;
    userBId = userB.userId;

    // Create project as User A with content
    const project = await createProjectWithContent(
      userATokens,
      "Shared Test Project",
      "Chapter One",
      "# The Beginning\n\nOnce upon a time in a land far away, there lived a writer who loved collaboration.\n\n## Characters\n\n- Alice the Owner\n- Bob the Collaborator\n"
    );
    projectId = project.id;

    await page.close();
  });

  test.afterAll(async () => {
    if (projectId) {
      await deleteProject(userATokens, projectId);
    }
  });

  // ─── Test 1: Owner invites collaborator via ShareDialog ────────────────

  test("owner can open ShareDialog and invite a collaborator", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userATokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    await selectProject(page, "Shared Test Project");
    await openFileNode(page, "Chapter One");

    // Share button should be visible for owner
    const shareBtn = page.locator('.topbar-icon-btn[title="Share"]');
    await expect(shareBtn).toBeVisible({ timeout: 5000 });

    // Open ShareDialog
    await shareBtn.click();
    await page.waitForTimeout(300);

    const dialog = page.locator(".share-dialog");
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Owner should appear in members list
    await expect(dialog.locator(".share-owner-badge")).toBeVisible({ timeout: 3000 });

    // Fill invite form
    const emailInput = dialog.locator('.share-invite-input[placeholder="Email address"]');
    await emailInput.fill(USER_B_EMAIL);

    const roleSelect = dialog.locator(".share-role-select").first();
    await roleSelect.selectOption("editor");

    // Click Invite
    await dialog.locator(".share-invite-btn").click();
    await page.waitForTimeout(1000);

    // Email input should clear after successful invite
    await expect(emailInput).toHaveValue("");

    await page.screenshot({ path: "test-results/sharing-invite-sent.png" });

    // Close dialog
    await dialog.locator(".share-close").click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  // ─── Test 2: Collaborator sees invitation and accepts ──────────────────

  test("collaborator sees invitation banner and can accept", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    // Invitation banner should be visible
    const banner = page.locator(".invitation-banner");
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Expand the banner
    const toggle = page.locator(".invitation-banner-toggle");
    await expect(toggle).toContainText("pending invitation");
    await toggle.click();
    await page.waitForTimeout(300);

    // Should show the project name and role
    const invItem = page.locator(".invitation-item").filter({
      hasText: "Shared Test Project",
    });
    await expect(invItem).toBeVisible({ timeout: 3000 });
    await expect(invItem.locator(".invitation-meta")).toContainText("editor");

    // Accept the invitation
    await invItem.locator(".invitation-accept").click();
    await page.waitForTimeout(1000);

    // The item should disappear
    await expect(invItem).not.toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: "test-results/sharing-invitation-accepted.png" });
  });

  // ─── Test 3: Collaborator sees project in "Shared with me" ─────────────

  test("collaborator sees shared project with role badge", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    await openProjectSwitcher(page);

    // Should have "Shared with me" group label
    const sharedLabel = page.locator(".project-group-label").filter({
      hasText: "Shared with me",
    });
    await expect(sharedLabel).toBeVisible({ timeout: 5000 });

    // The shared project should show with an "Editor" role badge
    const projectItem = page.locator(".project-panel-item").filter({
      hasText: "Shared Test Project",
    });
    await expect(projectItem).toBeVisible({ timeout: 3000 });

    const roleBadge = projectItem.locator(".role-badge");
    await expect(roleBadge).toBeVisible();
    await expect(roleBadge).toContainText("Editor");

    await page.screenshot({ path: "test-results/sharing-switcher-shared-section.png" });
  });

  // ─── Test 4: Collaborator sees owner's content ─────────────────────────

  test("collaborator can open shared project and see content", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    await selectProject(page, "Shared Test Project");
    await openFileNode(page, "Chapter One");

    const editor = getEditor(page);
    await expect(editor).toBeVisible({ timeout: 10000 });

    const editorText = await editor.textContent();
    expect(editorText).toContain("The Beginning");
    expect(editorText).toContain("Once upon a time");
    expect(editorText).toContain("Alice the Owner");
    expect(editorText).toContain("Bob the Collaborator");

    await page.screenshot({ path: "test-results/sharing-collaborator-sees-content.png" });
  });

  // ─── Test 5: Editor can edit the document ──────────────────────────────

  test("editor role can edit the document", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    await selectProject(page, "Shared Test Project");
    await openFileNode(page, "Chapter One");

    const editor = getEditor(page);
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Editor should be editable
    const isEditable = await editor.getAttribute("contenteditable");
    expect(isEditable).toBe("true");

    // No readonly class
    const editorShell = page.locator(".editor-shell");
    await expect(editorShell).not.toHaveClass(/editor-readonly/);

    // Type some content
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Bob was here!", { delay: 30 });
    await page.waitForTimeout(500);

    const updatedText = await editor.textContent();
    expect(updatedText).toContain("Bob was here!");

    // Share button should NOT be visible for editors
    const shareBtn = page.locator('.topbar-icon-btn[title="Share"]');
    await expect(shareBtn).not.toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: "test-results/sharing-editor-can-edit.png" });
  });

  // ─── Test 6: Owner changes collaborator role to viewer ─────────────────

  test("owner can change collaborator role to viewer", async () => {
    const res = await fetch(
      `${API}/api/projects/${projectId}/members/${userBId}/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userATokens.access}`,
        },
        body: JSON.stringify({ role: "viewer" }),
      }
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.role).toBe("viewer");
  });

  // ─── Test 7: Viewer cannot edit the document ───────────────────────────

  test("viewer role cannot edit the document", async ({ page }) => {
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    await selectProject(page, "Shared Test Project");
    await openFileNode(page, "Chapter One");

    const editor = getEditor(page);
    await expect(editor).toBeVisible({ timeout: 10000 });

    // Editor should be non-editable
    const isEditable = await editor.getAttribute("contenteditable");
    expect(isEditable).toBe("false");

    // Should have readonly class
    const editorShell = page.locator(".editor-shell");
    await expect(editorShell).toHaveClass(/editor-readonly/);

    // Assistant toggle should be hidden for viewers
    const assistantBtn = page.locator('button[aria-label="Toggle assistant"]');
    await expect(assistantBtn).not.toBeVisible({ timeout: 2000 });

    // Verify role badge now shows "Viewer"
    await openProjectSwitcher(page);
    const projectItem = page.locator(".project-panel-item").filter({
      hasText: "Shared Test Project",
    });
    const roleBadge = projectItem.locator(".role-badge");
    await expect(roleBadge).toContainText("Viewer");

    await page.screenshot({ path: "test-results/sharing-viewer-readonly.png" });
  });

  // ─── Test 8: Declining an invitation ───────────────────────────────────

  test("user can decline an invitation", async ({ page }) => {
    // Create a second project and invite User B
    const project2 = await createProjectWithContent(
      userATokens,
      "Decline Test Project",
      "Some Doc",
      "Content here."
    );

    await fetch(`${API}/api/projects/${project2.id}/invite/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userATokens.access}`,
      },
      body: JSON.stringify({ email: USER_B_EMAIL, role: "editor" }),
    });

    // Login as User B
    await page.goto("/");
    await loginAs(page, userBTokens);
    await waitForApp(page);
    await dismissWalkthrough(page);

    // Invitation banner should show
    const banner = page.locator(".invitation-banner");
    await expect(banner).toBeVisible({ timeout: 5000 });

    // Expand
    await page.locator(".invitation-banner-toggle").click();
    await page.waitForTimeout(300);

    // Find and decline
    const invItem = page.locator(".invitation-item").filter({
      hasText: "Decline Test Project",
    });
    await expect(invItem).toBeVisible({ timeout: 3000 });
    await invItem.locator(".invitation-decline").click();
    await page.waitForTimeout(1000);

    // Should disappear
    await expect(invItem).not.toBeVisible({ timeout: 5000 });

    // Project should NOT appear in switcher
    await openProjectSwitcher(page);
    const declinedProject = page.locator(".project-panel-item-name").filter({
      hasText: "Decline Test Project",
    });
    await expect(declinedProject).not.toBeVisible({ timeout: 2000 });

    await page.screenshot({ path: "test-results/sharing-invitation-declined.png" });

    // Cleanup
    await deleteProject(userATokens, project2.id);
  });
});

// =============================================================================
// Suite 2: Sharing API tests (independent)
// =============================================================================

test.describe("Sharing API", () => {
  const API_OWNER_EMAIL = "sharing-api-owner@test.com";
  const API_COLLAB_EMAIL = "sharing-api-collab@test.com";
  const PASSWORD = "TestPassword123!";

  let ownerTokens;
  let collabTokens;
  let collabUserId;
  let testProjectId;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");

    const owner = await ensureUser(page, {
      email: API_OWNER_EMAIL,
      password: PASSWORD,
      name: "API Owner",
    });
    ownerTokens = owner.tokens;

    const collab = await ensureUser(page, {
      email: API_COLLAB_EMAIL,
      password: PASSWORD,
      name: "API Collab",
    });
    collabTokens = collab.tokens;
    collabUserId = collab.userId;

    // Create test project
    const projRes = await fetch(`${API}/api/projects/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokens.access}`,
      },
      body: JSON.stringify({ name: "API Share Test", project_type: "article" }),
    });
    const proj = await projRes.json();
    testProjectId = proj.id;

    await page.close();
  });

  test.afterAll(async () => {
    if (testProjectId) {
      await deleteProject(ownerTokens, testProjectId);
    }
  });

  test("invite returns 201", async () => {
    const res = await fetch(`${API}/api/projects/${testProjectId}/invite/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokens.access}`,
      },
      body: JSON.stringify({ email: API_COLLAB_EMAIL, role: "editor" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.role).toBe("editor");
    expect(data.project).toBe(testProjectId);
  });

  test("duplicate invite returns 400", async () => {
    const res = await fetch(`${API}/api/projects/${testProjectId}/invite/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ownerTokens.access}`,
      },
      body: JSON.stringify({ email: API_COLLAB_EMAIL, role: "editor" }),
    });
    expect(res.status).toBe(400);
  });

  test("non-admin cannot invite", async () => {
    const res = await fetch(`${API}/api/projects/${testProjectId}/invite/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${collabTokens.access}`,
      },
      body: JSON.stringify({ email: "someone@test.com", role: "viewer" }),
    });
    expect(res.status).toBe(403);
  });

  test("invitation list returns pending invitations", async () => {
    const res = await fetch(`${API}/api/invitations/`, {
      headers: { Authorization: `Bearer ${collabTokens.access}` },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    const inv = data.find((i) => i.project === testProjectId);
    expect(inv).toBeTruthy();
    expect(inv.role).toBe("editor");
    expect(inv.project_name).toBe("API Share Test");
  });

  test("accept invitation succeeds", async () => {
    const listRes = await fetch(`${API}/api/invitations/`, {
      headers: { Authorization: `Bearer ${collabTokens.access}` },
    });
    const invitations = await listRes.json();
    const inv = invitations.find((i) => i.project === testProjectId);

    const res = await fetch(`${API}/api/invitations/${inv.id}/accept/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${collabTokens.access}` },
    });
    expect(res.ok).toBe(true);
  });

  test("members list includes owner and accepted member", async () => {
    const res = await fetch(`${API}/api/projects/${testProjectId}/members/`, {
      headers: { Authorization: `Bearer ${ownerTokens.access}` },
    });
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.length).toBe(2);
    expect(data.find((m) => m.role === "owner")).toBeTruthy();
    expect(data.find((m) => m.role === "editor")).toBeTruthy();
  });

  test("owner can update member role", async () => {
    const res = await fetch(
      `${API}/api/projects/${testProjectId}/members/${collabUserId}/`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ownerTokens.access}`,
        },
        body: JSON.stringify({ role: "viewer" }),
      }
    );
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.role).toBe("viewer");
  });

  test("owner can remove a member", async () => {
    const res = await fetch(
      `${API}/api/projects/${testProjectId}/members/${collabUserId}/`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerTokens.access}` },
      }
    );
    expect(res.status).toBe(204);

    // Verify only owner remains
    const membersRes = await fetch(
      `${API}/api/projects/${testProjectId}/members/`,
      { headers: { Authorization: `Bearer ${ownerTokens.access}` } }
    );
    const members = await membersRes.json();
    expect(members.length).toBe(1);
  });
});

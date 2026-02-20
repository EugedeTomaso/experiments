# ProjectHome Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign ProjectHome into two visual zones — an "At a Glance" overview zone and a receded "Settings" zone — to separate project status from configuration.

**Architecture:** Restructure the existing `ProjectHome.jsx` component into two wrapper divs (`.project-home-overview` and `.project-home-settings`). Add a "Recent Documents" section. Update CSS to remove old section-divider patterns and add zone-based styling. Wire new `onSelectNode` prop from App.jsx.

**Tech Stack:** React 18.2, CSS custom properties (existing design system in `index.css`), no new dependencies.

---

### Task 1: Restructure JSX into Two Zones

**Files:**
- Modify: `frontend/src/components/ProjectHome.jsx`

**Step 1: Add `onSelectNode` prop and recent docs logic**

Add to the destructured props:

```jsx
export function ProjectHome({ project, nodes = [], agents = [], onUpdate, onDelete, onEditAgent, onCreateAgent, memories = [], onCreateMemory, onDeleteMemory, onUpdateMemory, onSelectNode }) {
```

Add the `recentDocs` memo after the existing `stats` memo:

```jsx
const recentDocs = useMemo(() => {
  return nodes
    .filter((n) => n.type === "file")
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);
}, [nodes]);
```

**Step 2: Restructure JSX into two zones**

Replace the entire `return (...)` block. The structure becomes:

```jsx
return (
  <div className="project-home">
    {/* Zone 1: At a Glance */}
    <div className="project-home-overview">
      <h1
        ref={titleRef}
        className="project-home-title"
        contentEditable
        suppressContentEditableWarning
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        spellCheck={false}
      >
        {project.name}
      </h1>
      {(fullType || project.created_at) && (
        <div className="project-home-meta">
          {fullType && <span>{fullType}</span>}
          {fullType && project.created_at && <span className="project-home-meta-dot">·</span>}
          {project.created_at && (
            <span>Created {new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          )}
        </div>
      )}

      <p
        className="project-home-brief"
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => {
          const value = e.target.textContent.trim();
          if (value !== (project.brief || "").trim()) {
            onUpdate({ brief: value });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.target.textContent = project.brief || "";
            e.target.blur();
          }
        }}
        data-placeholder="Describe what this project is about..."
      >
        {project.brief || ""}
      </p>

      <div className="project-home-stats">
        <div className="project-home-stat">
          <span className="project-home-stat-value">{stats.docCount}</span>
          <span className="project-home-stat-label">Documents</span>
        </div>
        <div className="project-home-stat">
          <span className="project-home-stat-value">{stats.totalWords.toLocaleString()}</span>
          <span className="project-home-stat-label">Words</span>
        </div>
        {stats.lastUpdated && (
          <div className="project-home-stat">
            <span className="project-home-stat-value">{timeAgo(stats.lastUpdated)}</span>
            <span className="project-home-stat-label">Last edit</span>
          </div>
        )}
      </div>

      {recentDocs.length > 0 && (
        <div className="project-home-recent">
          <div className="project-home-recent-header">Recent</div>
          <div className="project-home-recent-list">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                className="project-home-recent-row"
                onClick={() => onSelectNode?.(String(doc.id))}
              >
                <span className="project-home-recent-name">{doc.title || "Untitled"}</span>
                <span className="project-home-recent-time">{timeAgo(doc.updated_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Zone 2: Settings */}
    <div className="project-home-settings">
      <div className="project-home-settings-header">Settings</div>

      <div className="project-home-settings-section">
        <div className="settings-label">Reference</div>
        <ContextFilePicker
          pinnedIds={project.context_nodes || []}
          nodes={nodes}
          onChange={(newIds) => onUpdate({ context_nodes: newIds })}
        />
      </div>

      <div className="project-home-settings-section">
        <div className="settings-label">Behavior</div>
        <div className="toggle-row">
          <button
            className={`toggle-track${autoContext ? " on" : ""}`}
            onClick={toggleAutoContext}
            role="switch"
            aria-checked={autoContext}
          >
            <span className="toggle-thumb" />
          </button>
          <span className="toggle-label">Auto-include siblings</span>
        </div>
        <p className="toggle-hint">
          When no files are pinned to a folder, documents in the same folder are included automatically.
        </p>
      </div>

      <div className="project-home-settings-section">
        <div className="settings-label">Memory</div>
        <p className="project-home-memory-hint">
          Preferences the AI remembers for this project.
        </p>
        <div className="project-home-memory-list">
          {projectMemories.map((mem) => (
            <div key={mem.id} className="project-home-memory-item">
              {editingMemoryId === mem.id ? (
                <input
                  className="project-home-memory-edit-input"
                  value={editingMemoryText}
                  onChange={(e) => setEditingMemoryText(e.target.value)}
                  maxLength={200}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onUpdateMemory(mem.id, { content: editingMemoryText });
                      setEditingMemoryId(null);
                    }
                    if (e.key === "Escape") setEditingMemoryId(null);
                  }}
                  onBlur={() => {
                    if (editingMemoryText.trim() && editingMemoryText !== mem.content) {
                      onUpdateMemory(mem.id, { content: editingMemoryText });
                    }
                    setEditingMemoryId(null);
                  }}
                />
              ) : (
                <span
                  className="project-home-memory-text"
                  onClick={() => {
                    setEditingMemoryId(mem.id);
                    setEditingMemoryText(mem.content);
                  }}
                >
                  {mem.content}
                </span>
              )}
              {mem.source === "ai_suggested" && (
                <span className="project-home-memory-source">AI</span>
              )}
              <button
                className="project-home-memory-delete"
                onClick={() => onDeleteMemory(mem.id)}
                aria-label="Delete"
              >
                <svg viewBox="0 0 8 8" width="8" height="8" aria-hidden="true">
                  <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          {projectMemories.length === 0 && (
            <div className="project-home-memory-empty">No project memories yet.</div>
          )}
        </div>
        <div className="project-home-memory-add">
          <input
            type="text"
            placeholder="e.g., Never use cliches. Prefer active voice."
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
            maxLength={200}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newMemoryText.trim()) {
                onCreateMemory(newMemoryText.trim(), "project");
                setNewMemoryText("");
              }
            }}
          />
          <button
            className="project-home-memory-add-btn"
            onClick={() => {
              if (!newMemoryText.trim()) return;
              onCreateMemory(newMemoryText.trim(), "project");
              setNewMemoryText("");
            }}
            disabled={!newMemoryText.trim()}
          >
            Add
          </button>
        </div>
      </div>

      <div className="project-home-settings-section">
        <div className="settings-label">Assistants</div>
        <div className="project-home-agents">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <div key={agent.id} className="project-home-agent-row">
                <div className="project-home-agent-info">
                  <span className="project-home-agent-name">{agent.name}</span>
                  <span className="project-home-agent-model">{agent.config?.model || "default"}</span>
                </div>
                <button
                  className="project-home-agent-edit"
                  onClick={() => onEditAgent?.(agent)}
                  aria-label={`Edit ${agent.name}`}
                >
                  Edit
                </button>
              </div>
            ))
          ) : (
            <p className="project-home-agents-empty">No assistants yet.</p>
          )}
          <button
            className="project-home-add-agent"
            onClick={onCreateAgent}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            Add assistant
          </button>
        </div>
      </div>

      <div className="project-home-settings-footer">
        {isConfirmingDelete ? (
          <div className="project-home-confirm">
            <span className="project-home-confirm-text">
              This will permanently delete <strong>{project.name}</strong> and all its documents. This cannot be undone.
            </span>
            <div className="project-home-confirm-actions">
              <button
                className="project-home-confirm-cancel"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </button>
              <button
                className="project-home-confirm-delete"
                onClick={onDelete}
              >
                Delete permanently
              </button>
            </div>
          </div>
        ) : (
          <button
            className="project-home-delete-btn"
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete this project
          </button>
        )}
      </div>
    </div>
  </div>
);
```

**Step 3: Remove unused state and refs**

Remove the `brief` state, `setBrief`, `saveBrief`, `handleBriefChange`, and `debounceRef` since the brief is now contentEditable (saves on blur, no debounce needed).

Keep: `autoContext`, `isConfirmingDelete`, `newMemoryText`, `editingMemoryId`, `editingMemoryText`, `titleRef`.

**Step 4: Commit**

```bash
git add frontend/src/components/ProjectHome.jsx
git commit -m "refactor: restructure ProjectHome into two-zone layout"
```

---

### Task 2: Wire `onSelectNode` Prop in App.jsx

**Files:**
- Modify: `frontend/src/App.jsx:2873-2891`

**Step 1: Add `onSelectNode` prop to ProjectHome**

In `App.jsx`, find the `<ProjectHome` usage (around line 2873) and add the prop:

```jsx
<ProjectHome
  project={projects.find((p) => p.id === activeProjectId)}
  nodes={nodes}
  agents={agents}
  onSelectNode={(nodeId) => setActiveNodeId(nodeId)}
  onUpdate={(updates) => {
```

Only one line added: `onSelectNode={(nodeId) => setActiveNodeId(nodeId)}` after the `agents` prop.

**Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire onSelectNode for ProjectHome recent docs"
```

---

### Task 3: Update CSS — Zone 1 Styles

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Replace `.project-home` and header styles**

Find and replace the existing `.project-home` block (line ~4468) and its header styles through `.project-home-date` (line ~4504). Replace with:

```css
.project-home {
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 48px 32px 64px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.project-home-overview {
  display: flex;
  flex-direction: column;
}

.project-home-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
  color: var(--text-1);
  outline: none;
  padding: 0;
}

.project-home-title:focus {
  outline: none;
}

.project-home-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-3);
}

.project-home-meta-dot {
  color: var(--text-4);
}
```

**Step 2: Replace `.project-home-brief` styles**

Find and replace the `.project-home-brief` block (line ~4829). Replace with:

```css
.project-home-brief {
  margin-top: 16px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-2);
  outline: none;
  min-height: 24px;
  border-bottom: 2px solid transparent;
  transition: border-color var(--duration-fast) var(--ease);
}

.project-home-brief:focus {
  border-bottom-color: var(--border-subtle);
}

.project-home-brief:empty::before {
  content: attr(data-placeholder);
  color: var(--text-4);
  font-style: italic;
  pointer-events: none;
}
```

**Step 3: Replace `.project-home-stats` and `.project-home-stat` styles**

Find and replace the stats block (lines ~4507-4535). Replace with:

```css
.project-home-stats {
  display: flex;
  gap: 32px;
  margin-top: 24px;
}

.project-home-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-home-stat-value {
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text-1);
}

.project-home-stat-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-4);
}
```

**Step 4: Add new `.project-home-recent` styles**

Add after the stat styles:

```css
/* Recent documents */
.project-home-recent {
  margin-top: 32px;
}

.project-home-recent-header {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-4);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.project-home-recent-list {
  display: flex;
  flex-direction: column;
}

.project-home-recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border: none;
  background: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  font-family: inherit;
  border-bottom: 1px solid var(--border-subtle);
  transition: color var(--duration-fast) var(--ease);
}

.project-home-recent-row:last-child {
  border-bottom: none;
}

.project-home-recent-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.project-home-recent-row:hover .project-home-recent-name {
  color: var(--accent);
}

.project-home-recent-time {
  font-size: 12px;
  color: var(--text-4);
  flex-shrink: 0;
  margin-left: 16px;
}
```

**Step 5: Commit**

```bash
git add frontend/src/App.css
git commit -m "style: update Zone 1 styles — header, brief, stats, recent docs"
```

---

### Task 4: Update CSS — Zone 2 Styles

**Files:**
- Modify: `frontend/src/App.css`

**Step 1: Add settings zone container styles**

Add after the recent docs styles:

```css
/* Zone 2: Settings */
.project-home-settings {
  background: var(--surface-inset);
  border-radius: var(--radius-md);
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.project-home-settings-header {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-3);
}

.project-home-settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 4px;
}

.project-home-settings-footer {
  border-top: 1px solid var(--border-subtle);
  padding-top: 20px;
}
```

**Step 2: Update memory input backgrounds for contrast**

Find `.project-home-memory-add input` (line ~4617) and change `background: var(--control-bg)` to:

```css
background: var(--surface);
```

Find `.project-home-memory-edit-input` (line ~4570) and change `background: var(--control-bg)` to:

```css
background: var(--surface);
```

**Step 3: Remove old `.section-divider` styles**

Delete the `.section-divider`, `.section-divider::before`, `.section-divider::after` rules (lines ~4854-4871). They are no longer used.

Also remove `.project-home-type-label` and `.project-home-date` rules (lines ~4494-4504) — replaced by `.project-home-meta`.

Also remove `.project-home-danger` rule (line ~4750-4754) — replaced by `.project-home-settings-footer`.

**Step 4: Commit**

```bash
git add frontend/src/App.css
git commit -m "style: add Zone 2 settings styles, remove old section dividers"
```

---

### Task 5: Visual Verification

**Step 1: Start dev server**

```bash
cd frontend && npm run dev
```

**Step 2: Open browser and verify**

Navigate to `http://localhost:5174`, open a project, click "Overview" in the sidebar.

Verify:
- [ ] Title shows at 32px, editable on click
- [ ] Type + date on one line with `·` separator
- [ ] Brief shows as inline text, click to edit, placeholder when empty
- [ ] Stats show without card borders, clean typography
- [ ] Recent documents list shows last 5 edited docs with timestamps
- [ ] Clicking a recent doc navigates to it
- [ ] Settings zone has inset background, visually receded
- [ ] Reference, Behavior, Memory, Assistants sections have simple labels
- [ ] Delete button at bottom with thin top border, no "Danger Zone" label
- [ ] Memory inputs have white background for contrast
- [ ] No old section dividers visible

**Step 3: Fix any visual issues found during verification**

**Step 4: Commit any fixes**

```bash
git add frontend/src/App.css frontend/src/components/ProjectHome.jsx
git commit -m "fix: visual polish for ProjectHome redesign"
```

---

### Task 6: Final Commit

**Step 1: Run linter**

```bash
cd frontend && npm run lint
```

Fix any issues found.

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: redesign ProjectHome with two-zone layout

Split into 'At a Glance' overview zone (title, brief, stats, recent docs)
and 'Settings' zone (reference, behavior, memory, assistants, delete).
Brief is now inline editable text. Stats use pure typography without card
borders. Recent documents section provides quick navigation to last 5
edited files."
```

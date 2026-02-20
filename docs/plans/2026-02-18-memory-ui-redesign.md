# Memory UI Redesign

## Problem
The memory strip in AssistantPanel is too prominent — it takes up fixed visual space and treats "memory" as a first-class feature when it should be support infrastructure.

## Design

### 1. Remove memory strip from AssistantPanel
Delete the collapsible `.memory-strip` / `.memory-strip-expanded` block entirely. No fixed bar of memories in the chat.

### 2. Memory icon in composer footer
In `agent-composer-footer`, next to the agent name (left side), add a small lightbulb icon. On click, opens a **popover floating upward** with:
- Grouped list: "This project" / "All projects"
- Delete (x) on hover per memory
- Input + scope selector at bottom to add new
- Empty state: "No memories yet"
- Closes on click outside

### 3. Project memories in ProjectHome
New `"Memory"` section (using existing `section-divider` pattern) between "Behavior" and "Assistants":
- Inline-editable memory list (click to edit)
- Delete on hover
- Input to add new
- This is the canonical place for project memory management

### 4. User memories stay in Settings
Simplify SettingsModal memory section to only show user-scope memories (remove the user/project toggle). This is the place for global preferences.

### 5. Keep suggestion + toast
The AI suggestion nudge and save toast remain unchanged — already subtle.

## Files to change
- `AssistantPanel.jsx` — remove strip, add composer icon + popover
- `ProjectHome.jsx` — add Memory section
- `SettingsModal.jsx` — simplify to user-scope only
- `App.jsx` — pass memory props to ProjectHome
- `App.css` — remove strip styles, add popover styles, add ProjectHome memory styles

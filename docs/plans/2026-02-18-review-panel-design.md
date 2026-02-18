# Review Panel UX Design

## Summary

Transform the AssistantPanel into a tabbed interface (Chat | Review | Verify) where users can review AI comments, approve/dismiss suggestions, and verify facts — all from a single panel that replaces the current floating comment thread popups as the primary review workflow.

## Architecture

### Tab Bar

The AssistantPanel header gains a tab bar with 3 tabs:

- **Chat** — existing conversation functionality (messages, composer, @mentions, agent picker).
- **Review** — scrollable list of AI review comments (grammar, clarity, style). Also includes user-created inline comments.
- **Verify** — scrollable list of fact-check results with verdict badges and sources.

Each tab shows a **badge counter** with the number of pending (unresolved) items. The composer input only appears in the Chat tab — Review and Verify use inline reply per card.

### Behavior

- Launching a review auto-opens the panel on the Review tab.
- Launching a fact-check auto-opens the panel on the Verify tab.
- User can switch tabs freely at any time.
- Clicking a card in Review/Verify scrolls the editor to the corresponding highlight and marks it active.

## Review Tab

### Card Layout

Each review comment renders as a card in a scrollable list, ordered by document position (top to bottom):

**AI comment card:**
- Header: sparkle icon + "Assistant" + timestamp
- Quoted text (gray, truncated) — the anchored passage
- Comment body — the AI's feedback
- Suggestion diff (if `suggested_text` exists) — before/after inline diff
- Actions: `Accept` | `Dismiss` | `Reply`

**User comment card:**
- Header: person icon + "You" + timestamp
- Quoted text
- Comment body
- Actions: `Resolve` | `Delete` (no Accept — user comments have no suggestion)
- Subtle visual distinction from AI cards (different icon, possibly lighter border)

### Card Interactions

- **Click card** → scroll editor to highlight, mark highlight as active (`.comment-highlight--active`).
- **Accept** (AI with suggestion) → apply `suggested_text` to editor via ProseMirror, card transitions to accepted state (green tint, fades out after 1.5s), highlight transitions to `.comment-highlight--approved`.
- **Dismiss** → mark as rejected, card fades out, highlight removed.
- **Reply** → thread expands inline below the card. Shows reply history + input. AI responds within thread. If AI proposes new suggestion, the card's diff updates.
- **Resolve** (user comments) → mark as resolved, card fades out.
- **Delete** (user comments) → remove entirely.

## Verify Tab

### Card Layout

Each fact-check renders as a card:

- Header: magnifying glass icon + "Fact-Check"
- Claim text (the quoted passage)
- **Verdict badge**: Verified (green) | Dubious (amber) | False (red)
- Explanation body
- Sources (collapsible list of links with titles)
- Suggestion diff (if exists, for dubious/false claims)
- Actions:
  - Verified claims: `Dismiss` only (text is correct, just remove highlight)
  - Dubious/False with suggestion: `Accept` | `Dismiss`

### Differences from Review

- No Reply action (verdict is based on sources, not conversational).
- Verdict badge is the primary visual element.
- Sources section is unique to Verify.

## Entry Points

### Topbar — Review Button

A "Review" button in the topbar opens a dropdown menu:

- Review All
- Grammar
- Clarity
- Style
- (separator)
- Fact-Check

Selecting an option launches the corresponding analysis and opens the panel on the right tab.

### Slash Commands

- `/review` → launches Review All, opens panel on Review tab.
- `/fact-check` → launches Fact-Check, opens panel on Verify tab.

### Selection Toolbar (existing)

- "Comment" button → creates user comment (appears in Review tab).
- "Fact-Check" button → launches scoped fact-check on selection (opens Verify tab).
- "Ask AI" button → opens Chat tab with selection as context.

## Loading State

When a review or fact-check is in progress:

- Tab shows a progress indicator: "Analyzing your document..." with a progress bar (N/M for fact-checks).
- Cards appear incrementally as the AI generates them.
- For fact-check (SSE stream): cards animate in one by one as claims are verified.

## Review Complete State

When all items in a tab are resolved:

- Summary card: "All comments resolved" with counters ("5 accepted, 2 dismissed").
- "Run another review" button (opens the focus dropdown).
- Tab badge changes to checkmark or counter disappears.

## Empty State

When a tab has never had items:

- Friendly message: "No review comments yet."
- Description: "Run a review to get AI feedback on your writing."
- Quick-launch buttons: `Review All` | `Grammar` | `Style` (for Review tab) or `Run Fact-Check` (for Verify tab).

## Data Model

No backend changes needed. The existing `Comment` model already supports:

- `comment_type`: "comment" | "review" | "fact_check" — used to route to correct tab.
- `status`: "open" | "approved" | "rejected" | "resolved" — drives card state.
- `verdict`: "verified" | "dubious" | "false" — for fact-check cards.
- `suggested_text` — for diff display and Accept action.
- `sources` — JSON array for Verify tab sources.
- `parent` FK — for threaded replies.

## Frontend Changes Required

1. **AssistantPanel.jsx** — add tab bar, route content to Chat/Review/Verify views.
2. **New: ReviewTab.jsx** — review card list component.
3. **New: VerifyTab.jsx** — fact-check card list component.
4. **New: ReviewCard.jsx** — individual review comment card.
5. **New: VerifyCard.jsx** — individual fact-check card.
6. **App.jsx** — wire tab state, pass comment data to AssistantPanel, handle tab auto-switching on review/fact-check launch.
7. **App.css** — styles for tabs, cards, badges, verdict colors, transitions.
8. **SlashMenu.jsx** — add `/review` and `/fact-check` commands.
9. **useComments.js** — expose filtered lists by `comment_type` for each tab, expose pending counts.

## Design Tokens

Follow existing design system (`system.md`):

- Cards: no border, `--surface-inset` background, `border-radius: 8px`.
- Active card: subtle `--accent` left border.
- Accept button: `--accent` color.
- Dismiss button: `--text-3` color (muted).
- Verdict badges: `--green-*`, `--amber-*`, `--red-*` tokens (extend palette if needed).
- Tab bar: muted underline style, active tab uses `--text-1`, inactive `--text-3`.
- Transitions: 300ms ease for card fade-out.

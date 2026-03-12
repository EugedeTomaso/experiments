# Marketplace Reviewer Port Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the marketplace/reviewer experience from `main` into `development-1` while preserving Marvin branding and the recent reviewer permission fixes.

**Architecture:** Add the `UserProfile` split from `main`, port the marketplace/review backend models and endpoints, then route authenticated users to either the writer app or the reviewer app at `/app`. The writer app gains marketplace publish/review inbox UI; the reviewer app uses dedicated marketplace/review models and APIs.

**Tech Stack:** Django, Django REST Framework, React, Vite

---

### Task 1: Add backend marketplace data model

**Files:**
- Modify: `backend/core/models.py`
- Create: `backend/core/migrations/0022_userprofile.py`
- Create: `backend/core/migrations/0023_backfill_user_profiles.py`
- Create: `backend/core/migrations/0024_marketplacelisting_review_reviewcomment.py`
- Test: `backend/core/tests/test_marketplace_api.py`

**Step 1: Write the failing test**

Add tests asserting that a reviewer profile can exist and that marketplace listings/reviews can be created and queried.

**Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test core.tests.test_marketplace_api -v 2`

**Step 3: Write minimal implementation**

Port `UserProfile`, `MarketplaceListing`, `Review`, and `ReviewComment` plus migrations from `main`.

**Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test core.tests.test_marketplace_api -v 2`

**Step 5: Commit**

Commit after backend model tests are green.

### Task 2: Add auth user_type exposure

**Files:**
- Modify: `backend/core/auth_serializers.py`
- Modify: `backend/core/auth_views.py`
- Test: `backend/core/tests/test_auth_views.py`

**Step 1: Write the failing test**

Add tests asserting `/api/auth/me/` and login responses include `user_type`, and that new users default to writer.

**Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test core.tests.test_auth_views -v 2`

**Step 3: Write minimal implementation**

Expose `user_type` through auth serializers/views, creating profiles where needed.

**Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test core.tests.test_auth_views -v 2`

**Step 5: Commit**

Commit once auth tests are green.

### Task 3: Add marketplace/review API surface

**Files:**
- Create: `backend/core/marketplace_serializers.py`
- Create: `backend/core/marketplace_views.py`
- Modify: `backend/core/urls.py`
- Modify: `backend/core/llm.py`
- Test: `backend/core/tests/test_marketplace_api.py`

**Step 1: Write the failing test**

Add endpoint tests for listing browse, listing creation, review creation, review comments, and AI review endpoints authorization.

**Step 2: Run test to verify it fails**

Run: `cd backend && python manage.py test core.tests.test_marketplace_api -v 2`

**Step 3: Write minimal implementation**

Port the serializers/views from `main`, adapting imports and preserving current branch behavior where needed.

**Step 4: Run test to verify it passes**

Run: `cd backend && python manage.py test core.tests.test_marketplace_api -v 2`

**Step 5: Commit**

Commit once the marketplace API is green.

### Task 4: Route reviewer users to the reviewer app

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/AuthContext.jsx`
- Create: `frontend/src/ReviewerApp.jsx`
- Test: `frontend` smoke build

**Step 1: Write the failing test**

If lightweight app tests exist, add one for reviewer routing; otherwise use build as regression gate and add backend auth test first.

**Step 2: Run test to verify it fails**

Run available frontend test/build command showing missing reviewer app wiring.

**Step 3: Write minimal implementation**

Route `/app` to `ReviewerApp` when `user.user_type === "reviewer"`.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm run build`

**Step 5: Commit**

Commit after reviewer routing is stable.

### Task 5: Port reviewer marketplace UI

**Files:**
- Create: `frontend/src/components/MarketplaceBrowse.jsx`
- Create: `frontend/src/components/ListingCard.jsx`
- Create: `frontend/src/components/ListingDetail.jsx`
- Create: `frontend/src/components/ReaderView.jsx`
- Create: `frontend/src/components/MyReviews.jsx`
- Create: `frontend/src/components/AIToolsPanel.jsx`
- Create: `frontend/src/components/ReviewerChatPanel.jsx`
- Create: `frontend/src/components/ReportBuilder.jsx`
- Create: `frontend/src/components/ScoreBadge.jsx`
- Create: `frontend/src/components/ScoreRadar.jsx`
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/App.css`

**Step 1: Write the failing test**

Use API/backend tests as the red phase for data contracts, then port the UI against those contracts.

**Step 2: Run test to verify it fails**

Run the frontend build before the components exist.

**Step 3: Write minimal implementation**

Port the reviewer UI from `main`, replacing `Mive` with `Marvin` and keeping current code style where practical.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm run build`

**Step 5: Commit**

Commit after reviewer UI renders cleanly.

### Task 6: Port writer-side marketplace publish and received reviews

**Files:**
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/components/MarketplacePublishDialog.jsx`
- Create: `frontend/src/components/ReceivedReviews.jsx`
- Modify: `frontend/src/api.js`
- Modify: `frontend/src/App.css`

**Step 1: Write the failing test**

Use backend endpoint tests plus frontend build red phase for missing imports/wiring.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm run build`

**Step 3: Write minimal implementation**

Add topbar entry points and overlays for listing publish and received reviews.

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm run build`

**Step 5: Commit**

Commit once writer-side integrations are green.

### Task 7: Verify and deploy

**Files:**
- No code changes required unless fixes appear

**Step 1: Run backend verification**

Run: `cd backend && python manage.py test core.tests.test_marketplace_api core.tests.test_auth_views core.tests.test_views core.tests.test_permissions -v 2`

**Step 2: Run frontend verification**

Run: `cd frontend && npm run build`

**Step 3: Dogfood reviewer and writer flows**

Validate login, browse marketplace, start review, add comments, AI chat, publish listing, and received reviews.

**Step 4: Deploy if green**

Rebuild/restart the Hetzner stack and repeat smoke checks.

**Step 5: Commit**

Commit any final fixes from verification.

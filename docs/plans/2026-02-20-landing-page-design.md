# Mive Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public landing page at `/` with Hero, Features, Editor Mockup, Pricing, and Footer — plus an SVG logo — using the same visual language as the existing Mive app.

**Architecture:** Install `react-router-dom` to add client-side routing. The landing page is a standalone component at `/`. The existing editor app moves to `/app`. Auth pages get their own routes. A new `AppRouter` component handles all routing with `AuthProvider` wrapping everything.

**Tech Stack:** React 18, react-router-dom v6, CSS custom properties (existing design tokens from `index.css`), inline SVGs.

---

### Task 1: Install react-router-dom

**Step 1: Install the dependency**

Run: `cd frontend && npm install react-router-dom`

**Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add react-router-dom dependency"
```

---

### Task 2: Add routing to main.jsx

Currently `main.jsx` renders `AuthGate` which conditionally shows `AuthShell` or `App`. We need to replace this with `BrowserRouter` + route definitions.

**Files:**
- Modify: `frontend/src/main.jsx`

**Step 1: Rewrite main.jsx with router**

Replace the entire content of `frontend/src/main.jsx` with:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './auth.css'
import './landing.css'
import App from './App.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import { AuthShell } from './components/AuthShell.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Mive</div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Mive</div>
      </div>
    )
  }
  return user ? <Navigate to="/app" replace /> : children
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthRoute><AuthShell initialPage="login" /></AuthRoute>} />
            <Route path="/register" element={<AuthRoute><AuthShell initialPage="register" /></AuthRoute>} />
            <Route path="/forgot" element={<AuthRoute><AuthShell initialPage="forgot" /></AuthRoute>} />
            <Route path="/reset" element={<AuthRoute><AuthShell initialPage="reset" /></AuthRoute>} />
            <Route path="/app/*" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

**Step 2: Update AuthShell to accept initialPage prop**

Modify `frontend/src/components/AuthShell.jsx`. Change the `useState` initializer to use the `initialPage` prop:

```jsx
export function AuthShell({ initialPage = "login" }) {
  const [page, setPage] = useState(() => {
    const reset = parseResetParams();
    return reset ? "reset" : initialPage;
  });
```

Also update the `navigate` callback to use `react-router-dom`'s `useNavigate` for cross-page navigation. Import at top:

```jsx
import { useNavigate as useRouterNavigate } from "react-router-dom";
```

Inside the component, add:

```jsx
const routerNavigate = useRouterNavigate();

const navigate = useCallback((target) => {
  // For cross-page navigation (login/register/forgot), use router
  const routerPages = { login: "/login", register: "/register", forgot: "/forgot", reset: "/reset" };
  if (routerPages[target]) {
    routerNavigate(routerPages[target]);
  }
  setPage(target);
  if (target !== "reset" && window.location.search) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}, [routerNavigate]);
```

**Step 3: Update auth page links to use router navigation**

The auth pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`) call `onNavigate("register")` etc. The updated `navigate` callback in AuthShell now handles this via the router, so no changes needed to child components.

**Step 4: Delete AuthGate.jsx**

`AuthGate.jsx` is replaced by `ProtectedRoute` and `AuthRoute` in `main.jsx`. Delete `frontend/src/AuthGate.jsx`.

**Step 5: Update Vite config for SPA fallback**

The Vite dev server needs to serve `index.html` for all routes. This is default behavior for Vite, but verify by checking `vite.config.js` — no changes needed since Vite's dev server already handles SPA fallback.

**Step 6: Commit**

```bash
git add frontend/src/main.jsx frontend/src/components/AuthShell.jsx
git rm frontend/src/AuthGate.jsx
git commit -m "feat: add react-router-dom routing with protected routes"
```

---

### Task 3: Create the SVG logo

**Files:**
- Create: `frontend/src/components/MiveLogo.jsx`

**Step 1: Create the logo component**

Create `frontend/src/components/MiveLogo.jsx` — a rounded hexagon with centered dot, near-black. The component accepts `size` prop (default 24).

```jsx
export function MiveLogo({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded hexagon */}
      <path
        d="M14.27 2.33a3.5 3.5 0 0 1 3.46 0l8.04 4.6A3.5 3.5 0 0 1 27.5 10v9.2a3.5 3.5 0 0 1-1.73 3.02l-8.04 4.6a3.5 3.5 0 0 1-3.46 0l-8.04-4.6A3.5 3.5 0 0 1 4.5 19.2V10a3.5 3.5 0 0 1 1.73-3.02l8.04-4.65Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {/* Center dot */}
      <circle cx="16" cy="14.6" r="2.4" fill="currentColor" />
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/MiveLogo.jsx
git commit -m "feat: add MiveLogo SVG component"
```

---

### Task 4: Create landing.css

**Files:**
- Create: `frontend/src/landing.css`

**Step 1: Write the landing page styles**

Create `frontend/src/landing.css` with all landing-specific styles. Uses design tokens from `index.css`. All classes prefixed with `landing-`. Key specs:

- **Navbar**: fixed, 56px height, transparent bg with backdrop blur on scroll, z-index 100
- **Hero**: 640px max-width, 48px/700 heading, 18px subheading, 120px top padding (below navbar)
- **Features**: 3-column CSS grid, 960px max-width, 24px gap
- **Mockup**: 960px max-width, `--radius-lg`, `--shadow-float`, aspect-ratio mock of editor
- **Pricing**: 3-column grid, highlighted card border
- **Footer**: canvas bg, top border, 4-column links
- **Responsive**: stack to single column below 768px
- **Animations**: `.landing-visible` class applied by IntersectionObserver for fade-in

```css
/* ===========================
   Landing Page
   =========================== */

/* Navbar */
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  z-index: 100;
  transition: background var(--duration-normal) var(--ease),
              border-color var(--duration-normal) var(--ease);
}

.landing-nav.scrolled {
  background: rgba(247, 247, 245, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.landing-nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-1);
  text-decoration: none;
}

.landing-nav-links {
  display: flex;
  align-items: center;
  gap: 32px;
}

.landing-nav-link {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease);
}

.landing-nav-link:hover {
  color: var(--text-1);
}

.landing-nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.landing-btn-ghost {
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: border-color var(--duration-fast) var(--ease),
              color var(--duration-fast) var(--ease),
              background var(--duration-fast) var(--ease);
}

.landing-btn-ghost:hover {
  border-color: var(--border-strong);
  color: var(--text-1);
  background: var(--surface);
}

.landing-btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease);
}

.landing-btn-primary:hover {
  background: var(--primary-hover);
}

/* Mobile hamburger */
.landing-nav-hamburger {
  display: none;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  padding: 0;
  align-items: center;
  justify-content: center;
}

/* Sections */
.landing-page {
  background: var(--canvas);
  min-height: 100vh;
}

.landing-section {
  padding: 80px 32px;
  max-width: 1040px;
  margin: 0 auto;
}

/* Hero */
.landing-hero {
  padding-top: 160px;
  padding-bottom: 80px;
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
}

.landing-hero-heading {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--text-1);
  margin: 0 0 16px;
}

.landing-hero-sub {
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-3);
  margin: 0 0 40px;
}

.landing-hero-cta {
  padding: 12px 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  transition: background var(--duration-fast) var(--ease);
}

.landing-hero-cta:hover {
  background: var(--primary-hover);
}

/* Features */
.landing-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  padding-top: 40px;
}

.landing-feature {
  text-align: left;
}

.landing-feature-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  margin-bottom: 16px;
}

.landing-feature-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.landing-feature-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-3);
  margin: 0;
}

/* Section headings */
.landing-section-heading {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-1);
  margin: 0 0 8px;
  text-align: center;
}

.landing-section-sub {
  font-size: 16px;
  color: var(--text-3);
  margin: 0 0 48px;
  text-align: center;
}

/* Editor mockup */
.landing-mockup-wrapper {
  padding: 0 32px 80px;
  max-width: 1040px;
  margin: 0 auto;
}

.landing-mockup {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  overflow: hidden;
  aspect-ratio: 16 / 10;
  display: flex;
  flex-direction: column;
}

.landing-mockup-topbar {
  height: 40px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 8px;
}

.landing-mockup-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border-strong);
}

.landing-mockup-body {
  flex: 1;
  display: flex;
}

.landing-mockup-sidebar {
  width: 180px;
  background: var(--canvas);
  border-right: 1px solid var(--border);
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.landing-mockup-sidebar-item {
  height: 10px;
  border-radius: 4px;
  background: var(--border);
}

.landing-mockup-sidebar-item:nth-child(1) { width: 70%; }
.landing-mockup-sidebar-item:nth-child(2) { width: 85%; margin-left: 12px; }
.landing-mockup-sidebar-item:nth-child(3) { width: 60%; margin-left: 12px; }
.landing-mockup-sidebar-item:nth-child(4) { width: 90%; }
.landing-mockup-sidebar-item:nth-child(5) { width: 75%; margin-left: 12px; }

.landing-mockup-editor {
  flex: 1;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  margin: 0 auto;
}

.landing-mockup-title {
  height: 24px;
  width: 45%;
  background: var(--text-4);
  border-radius: 4px;
  opacity: 0.3;
}

.landing-mockup-line {
  height: 8px;
  border-radius: 3px;
  background: var(--border);
}

.landing-mockup-line:nth-child(2) { width: 100%; }
.landing-mockup-line:nth-child(3) { width: 92%; }
.landing-mockup-line:nth-child(4) { width: 87%; }
.landing-mockup-line:nth-child(5) { width: 0; height: 4px; }
.landing-mockup-line:nth-child(6) { width: 95%; }
.landing-mockup-line:nth-child(7) { width: 78%; }
.landing-mockup-line:nth-child(8) { width: 88%; }

.landing-mockup-assistant {
  width: 240px;
  border-left: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.landing-mockup-msg {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.landing-mockup-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.landing-mockup-avatar.user { background: var(--surface-inset); }
.landing-mockup-avatar.ai { background: var(--accent-soft); }

.landing-mockup-msg-lines {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.landing-mockup-msg-line {
  height: 6px;
  border-radius: 3px;
  background: var(--border);
}

/* Pricing */
.landing-pricing {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.landing-price-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
}

.landing-price-card.featured {
  border-color: var(--primary);
  border-width: 2px;
}

.landing-price-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 4px;
}

.landing-price-amount {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--text-1);
  margin: 0 0 4px;
}

.landing-price-amount span {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-4);
}

.landing-price-desc {
  font-size: 13px;
  color: var(--text-3);
  margin: 0 0 24px;
  line-height: 1.5;
}

.landing-price-features {
  list-style: none;
  padding: 0;
  margin: 0 0 32px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.landing-price-features li {
  font-size: 13px;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 8px;
}

.landing-price-features li::before {
  content: "";
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--success-soft);
  flex-shrink: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23059669' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6L9 17l-5-5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
}

.landing-price-cta {
  width: 100%;
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  display: block;
  transition: background var(--duration-fast) var(--ease),
              border-color var(--duration-fast) var(--ease);
}

.landing-price-cta.primary {
  border: none;
  background: var(--primary);
  color: var(--on-primary);
}

.landing-price-cta.primary:hover {
  background: var(--primary-hover);
}

.landing-price-cta.ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-2);
}

.landing-price-cta.ghost:hover {
  border-color: var(--border-strong);
  color: var(--text-1);
}

/* Footer */
.landing-footer {
  border-top: 1px solid var(--border);
  padding: 48px 32px 32px;
  max-width: 1040px;
  margin: 0 auto;
}

.landing-footer-top {
  display: flex;
  justify-content: space-between;
  gap: 48px;
  margin-bottom: 48px;
}

.landing-footer-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 8px;
}

.landing-footer-tagline {
  font-size: 13px;
  color: var(--text-4);
  margin: 0;
}

.landing-footer-columns {
  display: flex;
  gap: 64px;
}

.landing-footer-col-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-4);
  margin: 0 0 16px;
}

.landing-footer-col-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.landing-footer-col-links a {
  font-size: 13px;
  color: var(--text-3);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease);
}

.landing-footer-col-links a:hover {
  color: var(--text-1);
}

.landing-footer-bottom {
  font-size: 12px;
  color: var(--text-4);
  border-top: 1px solid var(--border);
  padding-top: 24px;
}

/* Scroll animations */
.landing-animate {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 500ms var(--ease), transform 500ms var(--ease);
}

.landing-animate.landing-visible {
  opacity: 1;
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 768px) {
  .landing-nav-links,
  .landing-nav-actions .landing-btn-ghost {
    display: none;
  }

  .landing-nav-hamburger {
    display: flex;
  }

  .landing-hero {
    padding-top: 120px;
    padding-bottom: 48px;
  }

  .landing-hero-heading {
    font-size: 32px;
  }

  .landing-hero-sub {
    font-size: 16px;
  }

  .landing-section {
    padding: 48px 20px;
  }

  .landing-features {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .landing-mockup-wrapper {
    padding: 0 20px 48px;
  }

  .landing-mockup-sidebar,
  .landing-mockup-assistant {
    display: none;
  }

  .landing-pricing {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .landing-footer-top {
    flex-direction: column;
    gap: 32px;
  }

  .landing-footer-columns {
    gap: 32px;
    flex-wrap: wrap;
  }

  .landing-section-heading {
    font-size: 24px;
  }
}
```

**Step 2: Commit**

```bash
git add frontend/src/landing.css
git commit -m "feat: add landing page styles"
```

---

### Task 5: Create LandingPage.jsx

**Files:**
- Create: `frontend/src/pages/LandingPage.jsx`

**Step 1: Create the landing page component**

Create `frontend/src/pages/LandingPage.jsx`. This is the main component rendering all sections: Navbar, Hero, Features, Mockup, Pricing, Footer. Uses `IntersectionObserver` for scroll animations and scroll listener for navbar background.

```jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MiveLogo } from "../components/MiveLogo";

/* Feature icons as small inline SVGs */
function IconTree() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconReview() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: IconTree,
    title: "Project structure",
    desc: "Organize your work into hierarchical trees. Folders, outlines, and documents — structured the way you think.",
  },
  {
    icon: IconChat,
    title: "AI assistant",
    desc: "A contextual writing partner that understands your entire project. Ask questions, brainstorm, or refine your prose.",
  },
  {
    icon: IconReview,
    title: "Inline review",
    desc: "Comments, grammar checks, and style suggestions right where you write. See diffs and track revisions effortlessly.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    desc: "For personal writing projects.",
    features: ["3 projects", "Basic AI assistant", "Community support", "Export to PDF & DOCX"],
    cta: "Get started",
    ctaStyle: "ghost",
    href: "/register",
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    desc: "For serious writers who need more.",
    features: ["Unlimited projects", "Advanced AI models", "Priority support", "Version history", "Publishing integrations"],
    cta: "Start free trial",
    ctaStyle: "primary",
    featured: true,
    href: "/register",
  },
  {
    name: "Team",
    price: "$24",
    period: "/user/mo",
    desc: "For writing teams and studios.",
    features: ["Everything in Pro", "Real-time collaboration", "Shared AI agents", "Team management", "Custom workflows"],
    cta: "Contact us",
    ctaStyle: "ghost",
    href: "/register",
  },
];

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const animateRefs = useRef([]);

  // Navbar scroll effect
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    animateRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addAnimateRef = (el) => {
    if (el && !animateRefs.current.includes(el)) {
      animateRefs.current.push(el);
    }
  };

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <Link to="/" className="landing-nav-brand">
          <MiveLogo size={22} />
          Mive
        </Link>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
          <a href="#pricing" className="landing-nav-link">Pricing</a>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-btn-ghost">Sign in</Link>
          <Link to="/register" className="landing-btn-primary">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-section landing-hero">
        <h1 className="landing-hero-heading">Your AI writing studio.</h1>
        <p className="landing-hero-sub">
          Outline, draft, and refine — with an assistant that understands your project.
        </p>
        <Link to="/register" className="landing-hero-cta">
          Start writing — it's free
        </Link>
      </section>

      {/* Editor mockup */}
      <div className="landing-mockup-wrapper landing-animate" ref={addAnimateRef}>
        <div className="landing-mockup">
          <div className="landing-mockup-topbar">
            <div className="landing-mockup-dot" />
            <div className="landing-mockup-dot" />
            <div className="landing-mockup-dot" />
          </div>
          <div className="landing-mockup-body">
            <div className="landing-mockup-sidebar">
              <div className="landing-mockup-sidebar-item" />
              <div className="landing-mockup-sidebar-item" />
              <div className="landing-mockup-sidebar-item" />
              <div className="landing-mockup-sidebar-item" />
              <div className="landing-mockup-sidebar-item" />
            </div>
            <div className="landing-mockup-editor">
              <div className="landing-mockup-title" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
              <div className="landing-mockup-line" />
            </div>
            <div className="landing-mockup-assistant">
              <div className="landing-mockup-msg">
                <div className="landing-mockup-avatar user" />
                <div className="landing-mockup-msg-lines">
                  <div className="landing-mockup-msg-line" style={{ width: "90%" }} />
                  <div className="landing-mockup-msg-line" style={{ width: "60%" }} />
                </div>
              </div>
              <div className="landing-mockup-msg">
                <div className="landing-mockup-avatar ai" />
                <div className="landing-mockup-msg-lines">
                  <div className="landing-mockup-msg-line" style={{ width: "100%" }} />
                  <div className="landing-mockup-msg-line" style={{ width: "80%" }} />
                  <div className="landing-mockup-msg-line" style={{ width: "45%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="landing-section landing-animate" ref={addAnimateRef} id="features">
        <h2 className="landing-section-heading">Everything you need to write</h2>
        <p className="landing-section-sub">A focused environment where structure, writing, and AI work together.</p>
        <div className="landing-features">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature">
              <div className="landing-feature-icon">
                <f.icon />
              </div>
              <h3 className="landing-feature-title">{f.title}</h3>
              <p className="landing-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="landing-section landing-animate" ref={addAnimateRef} id="pricing">
        <h2 className="landing-section-heading">Simple pricing</h2>
        <p className="landing-section-sub">Start free. Upgrade when you need more.</p>
        <div className="landing-pricing">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`landing-price-card${plan.featured ? " featured" : ""}`}>
              <div className="landing-price-name">{plan.name}</div>
              <div className="landing-price-amount">
                {plan.price}
                {plan.period && <span>{plan.period}</span>}
              </div>
              <p className="landing-price-desc">{plan.desc}</p>
              <ul className="landing-price-features">
                {plan.features.map((feat) => (
                  <li key={feat}>{feat}</li>
                ))}
              </ul>
              <Link to={plan.href} className={`landing-price-cta ${plan.ctaStyle}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div>
            <div className="landing-footer-brand">
              <MiveLogo size={20} />
              Mive
            </div>
            <p className="landing-footer-tagline">Your AI writing studio.</p>
          </div>
          <div className="landing-footer-columns">
            <div>
              <div className="landing-footer-col-title">Product</div>
              <ul className="landing-footer-col-links">
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#pricing">Changelog</a></li>
              </ul>
            </div>
            <div>
              <div className="landing-footer-col-title">Company</div>
              <ul className="landing-footer-col-links">
                <li><a href="#pricing">About</a></li>
                <li><a href="#pricing">Blog</a></li>
              </ul>
            </div>
            <div>
              <div className="landing-footer-col-title">Legal</div>
              <ul className="landing-footer-col-links">
                <li><a href="#pricing">Privacy</a></li>
                <li><a href="#pricing">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          &copy; {new Date().getFullYear()} Mive. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/LandingPage.jsx
git commit -m "feat: add landing page component with all sections"
```

---

### Task 6: Verify and polish

**Step 1: Run the dev server**

Run: `cd frontend && npm run dev`

Open `http://localhost:5174/` — should show the landing page.

**Step 2: Verify routes**

- `/` — Landing page
- `/login` — Login page
- `/register` — Register page
- `/app` — Redirects to `/login` if not logged in
- After login — Redirects to `/app`

**Step 3: Visual review and adjust**

Check all sections render correctly at desktop (1280px) and mobile (375px). Adjust spacing/sizing as needed.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Mive landing page with logo, routing, and responsive styles"
```

---

Plan complete and saved to `docs/plans/2026-02-20-landing-page-design.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
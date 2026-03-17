import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MarvinLogo } from "../components/MarvinLogo";
import { EditorDemo } from "../components/EditorDemo";

/* ── Inline SVG icons ── */

function IconCheck() {
  return (
    <svg className="landing-price-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconMessageCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconGitBranch() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

/* ── Data ── */

const SMALL_FEATURES = [
  {
    icon: IconMessageCircle,
    title: "Inline comments",
    desc: "Select any passage and leave feedback. Threaded replies keep discussions in context, right where they belong.",
  },
  {
    icon: IconEye,
    title: "AI-powered review",
    desc: "Run targeted reviews for grammar, clarity, tone, or structure. Each suggestion is a card you can accept, dismiss, or discuss.",
  },
  {
    icon: IconUsers,
    title: "Real-time collaboration",
    desc: "Review together with live cursors and presence indicators. See who's reading, who's editing.",
  },
  {
    icon: IconGitBranch,
    title: "Version history",
    desc: "Every save is a snapshot. Compare revisions side by side, restore any previous version with one click.",
  },
  {
    icon: IconZap,
    title: "Editorial agents",
    desc: "Configure AI personas — a strict copy editor, a fact-checker, a style guide enforcer. Switch with @mentions.",
  },
  {
    icon: IconDownload,
    title: "Export & publish",
    desc: "One-click export to PDF, DOCX, or EPUB. Publish directly to platforms when the piece is ready.",
  },
];


/* ── Component ── */

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const animateRefs = useRef([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("landing-visible");
          }
        });
      },
      { threshold: 0.08 }
    );
    animateRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRef = (el) => {
    if (el && !animateRefs.current.includes(el)) {
      animateRefs.current.push(el);
    }
  };

  return (
    <div className="landing-page">
      {/* ── Navbar ── */}
      <nav className={`landing-nav${scrolled ? " scrolled" : ""}`}>
        <Link to="/" className="landing-nav-brand">
          <MarvinLogo size={22} />
          Marvin
        </Link>
        <div className="landing-nav-links">
          <a href="#features" className="landing-nav-link">Features</a>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="landing-btn-ghost">Sign in</Link>
          <Link to="/register" className="landing-btn-primary">Get started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-eyebrow">
          <span className="landing-hero-eyebrow-dot" />
          An editorial studio
        </div>
        <h1 className="landing-hero-heading">
          Where every word<br />gets sharper.
        </h1>
        <p className="landing-hero-sub">
          Marvin is the editorial workspace where reviewers catch what humans miss,
          editors shape raw drafts into polished pieces, and writers
          get the feedback they actually need.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="landing-hero-cta">
            Start reviewing free
            <IconArrowRight />
          </Link>
          <a href="#features" className="landing-hero-cta-secondary">
            See how it works
          </a>
        </div>
      </section>

      {/* ── Interactive demo ── */}
      <div className="landing-hero-screenshot landing-animate" ref={addRef}>
        <EditorDemo />
      </div>

      {/* ── Social proof strip ── */}
      <div className="landing-proof-strip landing-animate" ref={addRef}>
        <div className="landing-proof-stat">
          <span className="landing-proof-number">12k+</span>
          <span className="landing-proof-label">reviews completed</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <span className="landing-proof-number">3.2k</span>
          <span className="landing-proof-label">editorial teams</span>
        </div>
        <div className="landing-proof-divider" />
        <div className="landing-proof-stat">
          <span className="landing-proof-number">94%</span>
          <span className="landing-proof-label">faster review cycles</span>
        </div>
      </div>

      {/* ── Showcase 1: Review & Critique (Editorial — lead) ── */}
      <div className="landing-showcase landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">Review & Critique</div>
          <h2 className="landing-showcase-heading">
            Feedback that makes writers better.
          </h2>
          <p className="landing-showcase-desc">
            Run targeted reviews on grammar, tone, clarity, or structure.
            Each suggestion appears as a card you can accept, dismiss, or discuss.
            Click any suggestion to highlight the relevant text in context.
          </p>
          <p className="landing-showcase-detail">
            Reply to discuss alternatives with the AI. Chain multiple review passes —
            first structure, then style, then copy edits. Your draft gets sharper
            with every round.
          </p>
        </div>
        <div className="landing-showcase-media">
          <div className="landing-screenshot-frame">
            <img
              src="/screenshots/ai-review.png"
              alt="AI review interface with inline suggestions"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* ── Showcase 2: Editorial Agents ── */}
      <div className="landing-showcase reverse landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">Editorial Agents</div>
          <h2 className="landing-showcase-heading">
            Your editorial board, always on call.
          </h2>
          <p className="landing-showcase-desc">
            Build a team of AI specialists — a ruthless copy editor, a
            fact-checking researcher, a style guide enforcer, a sensitivity reader.
            Each agent has its own voice, system prompt, and model configuration.
            Switch between them with @mentions.
          </p>
          <p className="landing-showcase-detail">
            Ask your copy editor to tighten prose, then ask your fact-checker
            to verify claims — all in the same conversation. Every agent
            reads the full document context.
          </p>
        </div>
        <div className="landing-showcase-media">
          <div className="landing-screenshot-frame">
            <img
              src="/screenshots/smart-agents.png"
              alt="Agent configuration panel with editorial personas"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* ── Showcase 3: Writing Experience (Writer focus — 30%) ── */}
      <div className="landing-showcase landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">Writing Studio</div>
          <h2 className="landing-showcase-heading">
            A space writers actually love.
          </h2>
          <p className="landing-showcase-desc">
            A distraction-free editor that stays out of the way until you
            need it. Project trees, slash commands, version history — everything
            a writer needs to focus on the words, not the tool.
          </p>
          <p className="landing-showcase-detail">
            The AI assistant reads your brief, your structure, and your drafts.
            Ask it to brainstorm, rewrite, expand, or critique. Every conversation
            is saved per document.
          </p>
        </div>
        <div className="landing-showcase-media">
          <div className="landing-screenshot-frame">
            <img
              src="/screenshots/chat-assistant.png"
              alt="AI chat assistant panel alongside the editor"
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="landing-divider">
        <div className="landing-divider-line" />
      </div>

      {/* ── Small features grid ── */}
      <section className="landing-section landing-animate" ref={addRef} id="features">
        <h2 className="landing-section-heading">Built for editorial workflows.</h2>
        <p className="landing-section-sub">
          Every feature designed to move drafts from raw to ready, faster.
        </p>
        <div className="landing-features-grid">
          {SMALL_FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`landing-feature-card landing-animate landing-animate-delay-${(i % 3) + 1}`}
              ref={addRef}
            >
              <div className="landing-feature-card-icon">
                <f.icon />
              </div>
              <h3 className="landing-feature-card-title">{f.title}</h3>
              <p className="landing-feature-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <div className="landing-cta-band landing-animate" ref={addRef}>
        <h2 className="landing-cta-heading">Better editing starts here.</h2>
        <p className="landing-cta-sub">
          Join editorial teams who ship cleaner, sharper content with Marvin.
        </p>
        <Link to="/register" className="landing-hero-cta">
          Get started — it's free
          <IconArrowRight />
        </Link>
      </div>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-top">
          <div>
            <div className="landing-footer-brand">
              <MarvinLogo size={20} />
              Marvin
            </div>
            <p className="landing-footer-tagline">Where every word gets sharper.</p>
          </div>
          <div className="landing-footer-columns">
            <div>
              <div className="landing-footer-col-title">Product</div>
              <ul className="landing-footer-col-links">
                <li><a href="#features">Features</a></li>
              </ul>
            </div>
            <div>
              <div className="landing-footer-col-title">Company</div>
              <ul className="landing-footer-col-links">
                <li><a href="#features">About</a></li>
                <li><a href="#features">Blog</a></li>
              </ul>
            </div>
            <div>
              <div className="landing-footer-col-title">Legal</div>
              <ul className="landing-footer-col-links">
                <li><a href="#features">Privacy</a></li>
                <li><a href="#features">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          &copy; {new Date().getFullYear()} Marvin. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

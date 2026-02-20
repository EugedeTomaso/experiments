import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MiveLogo } from "../components/MiveLogo";

/* ── Inline SVG icons ── */

function IconCheck() {
  return (
    <svg className="landing-price-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
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

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

function IconSlash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="20" x2="17" y2="4" />
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
    icon: IconFolder,
    title: "Project structure",
    desc: "Hierarchical trees with folders, documents, and nested outlines. Drag to reorganize.",
  },
  {
    icon: IconHistory,
    title: "Version history",
    desc: "Every save is a snapshot. Browse, compare, and restore any previous version.",
  },
  {
    icon: IconDownload,
    title: "Export anywhere",
    desc: "One-click export to PDF, DOCX, or EPUB. Publish directly to platforms.",
  },
  {
    icon: IconZap,
    title: "Smart agents",
    desc: "Create custom AI personas — a strict editor, a creative partner, a researcher. Switch with @mentions.",
  },
  {
    icon: IconUsers,
    title: "Real-time collaboration",
    desc: "Write together with live cursors, presence indicators, and shared conversations.",
  },
  {
    icon: IconSlash,
    title: "Slash commands",
    desc: "Type / to insert headings, lists, code blocks, dividers — keyboard-first workflow.",
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

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-eyebrow">
          <span className="landing-hero-eyebrow-dot" />
          AI-powered writing studio
        </div>
        <h1 className="landing-hero-heading">
          Where structure meets intelligence.
        </h1>
        <p className="landing-hero-sub">
          Mive gives your writing a home — with outlines that organize your thinking,
          and an AI assistant that reads everything you've written.
        </p>
        <div className="landing-hero-actions">
          <Link to="/register" className="landing-hero-cta">
            Start writing free
            <IconArrowRight />
          </Link>
          <a href="#features" className="landing-hero-cta-secondary">
            See how it works
          </a>
        </div>
      </section>

      {/* ── Hero screenshot ── */}
      <div className="landing-hero-screenshot landing-animate" ref={addRef}>
        <div className="landing-screenshot-frame">
          <img
            src="/screenshots/editor-full.png"
            alt="Mive editor — document with sidebar outline and AI assistant panel"
            loading="eager"
          />
        </div>
      </div>

      {/* ── Showcase 1: AI Assistant ── */}
      <div className="landing-showcase landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">AI Assistant</div>
          <h2 className="landing-showcase-heading">
            A writing partner that knows your project.
          </h2>
          <p className="landing-showcase-desc">
            The assistant doesn't just see your current paragraph — it reads your brief,
            your documents, and your structure. Ask it to brainstorm, rewrite, expand,
            or critique. It understands the full picture.
          </p>
          <p className="landing-showcase-detail">
            Every conversation is saved per document. Come back tomorrow and your chat
            is still there. Start new threads for different topics.
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

      {/* ── Showcase 2: Review & Critique ── */}
      <div className="landing-showcase reverse landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">Review & Critique</div>
          <h2 className="landing-showcase-heading">
            An editor that never sleeps.
          </h2>
          <p className="landing-showcase-desc">
            Run targeted reviews on grammar, style, or clarity — or let the AI scan
            everything at once. Each suggestion appears as a card you can accept,
            dismiss, or discuss.
          </p>
          <p className="landing-showcase-detail">
            Click a suggestion to highlight the relevant text in context.
            Reply to discuss alternatives with the AI. Your draft gets sharper with
            every pass.
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

      {/* ── Showcase 3: Project overview ── */}
      <div className="landing-showcase landing-animate" ref={addRef}>
        <div className="landing-showcase-content">
          <div className="landing-showcase-eyebrow">Project Home</div>
          <h2 className="landing-showcase-heading">
            Not a blank page. A command center.
          </h2>
          <p className="landing-showcase-desc">
            Each project has its own dashboard with word counts, recent documents,
            and settings. Add reference materials, configure custom writing rules,
            and set up AI agents tailored to your project.
          </p>
          <p className="landing-showcase-detail">
            Built for novels, screenplays, articles, academic papers — anything
            worth writing well.
          </p>
        </div>
        <div className="landing-showcase-media">
          <div className="landing-screenshot-frame">
            <img
              src="/screenshots/project-home.png"
              alt="Project home with document stats and recent files"
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
        <h2 className="landing-section-heading">And everything else you need</h2>
        <p className="landing-section-sub">
          The details that make the difference between a tool and a studio.
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

      {/* ── Divider ── */}
      <div className="landing-divider">
        <div className="landing-divider-line" />
      </div>

      {/* ── Pricing ── */}
      <section className="landing-section landing-animate" ref={addRef} id="pricing">
        <h2 className="landing-section-heading">Simple pricing</h2>
        <p className="landing-section-sub">Start free. Upgrade when you need more.</p>
        <div className="landing-pricing">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`landing-price-card${plan.featured ? " featured" : ""}`}>
              {plan.featured && <div className="landing-price-badge">Popular</div>}
              <div className="landing-price-name">{plan.name}</div>
              <div className="landing-price-amount">
                {plan.price}
                {plan.period && <span>{plan.period}</span>}
              </div>
              <p className="landing-price-desc">{plan.desc}</p>
              <ul className="landing-price-features">
                {plan.features.map((feat) => (
                  <li key={feat}>
                    <IconCheck />
                    {feat}
                  </li>
                ))}
              </ul>
              <Link to={plan.href} className={`landing-price-cta ${plan.ctaStyle}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <div className="landing-cta-band landing-animate" ref={addRef}>
        <h2 className="landing-cta-heading">Ready to write something great?</h2>
        <p className="landing-cta-sub">
          Join writers who use Mive to turn ideas into finished work.
          Free forever for personal projects.
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
          &copy; {new Date().getFullYear()} Mive. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

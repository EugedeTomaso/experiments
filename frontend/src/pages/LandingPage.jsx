import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MiveLogo } from "../components/MiveLogo";

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

      <section className="landing-section landing-hero">
        <h1 className="landing-hero-heading">Your AI writing studio.</h1>
        <p className="landing-hero-sub">
          Outline, draft, and refine — with an assistant that understands your project.
        </p>
        <Link to="/register" className="landing-hero-cta">
          Start writing — it's free
        </Link>
      </section>

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

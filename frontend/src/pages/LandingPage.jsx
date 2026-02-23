import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MiveLogo } from "../components/MiveLogo";
import ConvergingLines from "../components/svg/ConvergingLines";
import ConnectorLines from "../components/svg/ConnectorLines";

/* ── Inline SVG icons ── */

function IconCheck() {
  return (
    <svg className="landing-price-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
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
  const pointsRef = useRef(null);
  const [pointsVisible, setPointsVisible] = useState(false);

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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPointsVisible(true); },
      { threshold: 0.3 }
    );
    if (pointsRef.current) observer.observe(pointsRef.current);
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
        <Link to="/login" className="landing-nav-signin">Sign in</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <ConvergingLines />
        <div className="hero-content">
          <h1 className="hero-heading">
            You think in fragments.<br />
            <span className="hero-heading-sub">
              You are the glue between your tools. You shouldn't have to be.
            </span>
          </h1>
          <p className="hero-transition">
            What if everything lived in one place — and it understood what you're writing?
          </p>
          <Link to="/register" className="hero-cta">Try Mive</Link>
        </div>
      </section>

      {/* ── Act 2: Product Reveal ── */}
      <section className="landing-product landing-animate" ref={addRef}>
        <div className="product-frame">
          <div className="product-mockup">
            {/* Sidebar — collapsed icon rail */}
            <div className="mockup-sidebar">
              <div className="mockup-sidebar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
                <span>Research</span>
              </div>
              <div className="mockup-sidebar-icon active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>Chapter 3</span>
              </div>
              <div className="mockup-sidebar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Outline</span>
              </div>
              <div className="mockup-sidebar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Notes</span>
              </div>
              <div className="mockup-sidebar-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Search</span>
              </div>
            </div>

            {/* Editor — real text content */}
            <div className="mockup-editor">
              <h3 className="mockup-editor-title">The Limits of Attention</h3>
              <div className="mockup-editor-body">
                <p>
                  We treat focus as a resource to be optimized, but the metaphor is wrong.
                  Attention is not a battery. It is a lens — and what matters is not how long
                  you hold it, but what you choose to aim it at.
                </p>
                <p>
                  The most productive writers don't write more. They decide faster what not to
                  write. They prune early, restructure often, and trust that clarity comes from
                  revision, not from first drafts.
                </p>
              </div>
            </div>

            {/* Assistant — chat bubbles */}
            <div className="mockup-assistant">
              <div className="mockup-assistant-header">Assistant</div>
              <div className="mockup-assistant-messages">
                <div className="mockup-msg mockup-msg-user">
                  Is the lens metaphor too abstract for an opening?
                </div>
                <div className="mockup-msg mockup-msg-ai">
                  It works — but ground it faster. Consider adding a concrete example
                  right after "aim it at." A reader choosing between two tabs, a writer
                  staring at an outline. Something physical.
                </div>
                <div className="mockup-msg mockup-msg-user">
                  Good call. And the second paragraph?
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="product-points" ref={pointsRef}>
          <ConnectorLines visible={pointsVisible} />
          <div className="product-point landing-animate" ref={addRef}>
            <h3>Structure</h3>
            <p>Your project isn't a single file. It's a tree of ideas, chapters, sections — all connected.</p>
          </div>
          <div className="product-point landing-animate landing-animate-delay-1" ref={addRef}>
            <h3>Context</h3>
            <p>The AI has read everything. It doesn't ask you to paste — it already knows.</p>
          </div>
          <div className="product-point landing-animate landing-animate-delay-2" ref={addRef}>
            <h3>Revision</h3>
            <p>Inline review, comments, versioning. Your thinking has a history.</p>
          </div>
        </div>
      </section>

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
        <h2 className="landing-cta-heading">Your studio is waiting.</h2>
        <p className="landing-cta-sub">
          Join writers who think deeper and write better with Mive.
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
            <p className="landing-footer-tagline">Think deeper. Write better.</p>
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

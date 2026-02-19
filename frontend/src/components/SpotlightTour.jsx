import { useState, useEffect, useRef, useCallback } from "react";

/* ── Tour step definitions ── */

const STEPS = [
  {
    selector: ".outline-rail",
    title: "Your project outline",
    text: "Every file and folder lives here. Press \u2318B to toggle it. Drag to reorder, double-click to rename.",
    align: "right",
    padding: 0,
    radius: 0,
  },
  {
    selector: ".rail-create-btn",
    title: "Add to your project",
    text: "New files and folders — build the structure that fits your work.",
    align: "bottom",
    padding: 4,
    radius: 8,
  },
  {
    selector: ".editor-section",
    title: "Your writing space",
    text: "We loaded a sample draft so you can jump right in. Select text for formatting, or press / for commands.",
    align: "left",
    padding: 12,
    radius: 12,
  },
  {
    selector: ".review-btn",
    title: "AI review",
    text: "Hit Review. Your AI reads the whole draft and leaves notes — like handing it to a trusted editor. Approve the ones you like, dismiss the rest.",
    align: "bottom",
    padding: 4,
    radius: 8,
  },
  {
    selector: '[aria-label="Toggle assistant"]',
    title: "Your AI assistant",
    text: "Press \u2318J to open. It reads your entire project and remembers what you teach it across conversations.",
    align: "bottom",
    clickTarget: true,
    padding: 6,
    radius: 8,
  },
  {
    selector: ".agent-selector-pill",
    title: "Choose your assistant",
    text: "Different assistants for different jobs — a brainstormer, a strict editor, a researcher. Pick the right one.",
    align: "bottom",
    padding: 4,
    radius: 20,
    ensureVisible: '[aria-label="Toggle assistant"]',
  },
  {
    selector: '[aria-label="Settings"]',
    title: "Settings",
    text: "API keys, editor preferences, AI defaults — all here.",
    align: "bottom",
    padding: 6,
    radius: 8,
  },
];

/* ── Helpers ── */

function getClipPath(rect) {
  if (!rect) return "none";
  const { left, top, width, height } = rect;
  const r = left + width;
  const b = top + height;
  return `polygon(
    0% 0%, 0% 100%,
    ${left}px 100%, ${left}px ${top}px,
    ${r}px ${top}px, ${r}px ${b}px,
    ${left}px ${b}px, ${left}px 100%,
    100% 100%, 100% 0%
  )`;
}

function getTooltipStyle(rect, align) {
  if (!rect) return {};
  const gap = 16;
  const w = 280;
  const margin = 16;
  const vw = window.innerWidth;

  if (align === "right") {
    const centerY = rect.top + Math.min(rect.height / 2, 80);
    const top = Math.max(margin, centerY - 80);
    const left = rect.left + rect.width + gap;
    // If it would overflow, flip to left side
    if (left + w > vw - margin) {
      return { right: vw - rect.left + gap, top, width: w };
    }
    return { left, top, width: w };
  }
  if (align === "left") {
    const centerY = rect.top + Math.min(rect.height / 2, 80);
    const top = Math.max(margin, centerY - 80);
    return { right: vw - rect.left + gap, top, width: w };
  }
  if (align === "bottom") {
    // Clamp left so the tooltip stays within the viewport
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(margin, Math.min(centerX - w / 2, vw - w - margin));
    return { left, top: rect.top + rect.height + gap, width: w };
  }
  return {};
}

/* ── Component ── */

export function SpotlightTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const [entering, setEntering] = useState(true);
  const stepRef = useRef(step);
  const retriesRef = useRef(0);
  stepRef.current = step;

  const measure = useCallback(() => {
    const s = STEPS[stepRef.current];
    if (!s) return;
    const el = document.querySelector(s.selector);

    // If element not found and we have an ensureVisible fallback, click it to reveal
    if (!el && s.ensureVisible && retriesRef.current === 0) {
      const trigger = document.querySelector(s.ensureVisible);
      if (trigger) trigger.click();
      retriesRef.current = 1;
      setTimeout(measure, 500);
      return;
    }

    if (!el) {
      // Element still not found after retry — skip this step
      if (stepRef.current < STEPS.length - 1) {
        setStep((prev) => prev + 1);
        retriesRef.current = 0;
      } else {
        onComplete();
      }
      return;
    }

    retriesRef.current = 0;
    const r = el.getBoundingClientRect();
    const pad = s.padding ?? 8;
    setRect({
      left: r.left - pad,
      top: r.top - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
      radius: s.radius ?? 8,
    });
    if (!ready) setReady(true);
  }, [ready, onComplete]);

  // Delay measurement to let the app settle
  useEffect(() => {
    retriesRef.current = 0;
    const delay = step === 0 ? 800 : 350;
    const timer = setTimeout(measure, delay);
    return () => clearTimeout(timer);
  }, [step, measure]);

  // Re-measure on resize
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Entry animation
  useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setEntering(false), 50);
      return () => clearTimeout(t);
    }
  }, [ready]);

  const advance = useCallback(() => {
    if (step < STEPS.length - 1) {
      setEntering(true);
      setStep((s) => s + 1);
      setRect(null);
      setReady(false);
    } else {
      onComplete();
    }
  }, [step, onComplete]);

  // For clickTarget steps, listen for actual clicks on the target element
  useEffect(() => {
    const s = STEPS[step];
    if (!s?.clickTarget) return;
    const el = document.querySelector(s.selector);
    if (!el) return;
    const handler = () => setTimeout(advance, 400);
    el.addEventListener("click", handler, { once: true });
    return () => el.removeEventListener("click", handler);
  }, [step, ready, advance]);

  // Keyboard: Escape to skip, right arrow / Enter to advance
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        onComplete();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        advance();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [advance, onComplete]);

  if (!rect || !ready) return null;

  const current = STEPS[step];
  const tooltipStyle = getTooltipStyle(rect, current.align);

  return (
    <div className={`spotlight-tour ${entering ? "entering" : ""}`}>
      {/* Dark backdrop with rectangular cutout via clip-path */}
      <div
        className="spotlight-backdrop"
        style={{
          clipPath: getClipPath(rect),
          pointerEvents: current.clickTarget ? "none" : undefined,
        }}
        onClick={!current.clickTarget ? advance : undefined}
      />

      {/* Pulsing ring around target */}
      <div
        className="spotlight-ring"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
        }}
      />

      {/* Tooltip */}
      <div className="spotlight-tooltip" style={tooltipStyle}>
        <div className="spotlight-tooltip-title">{current.title}</div>
        <p className="spotlight-tooltip-text">{current.text}</p>
        <div className="spotlight-tooltip-footer">
          <div className="spotlight-tooltip-dots">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`spotlight-dot${i === step ? " active" : i < step ? " completed" : ""}`}
              />
            ))}
          </div>
          {current.clickTarget ? (
            <span className="spotlight-tooltip-hint">Click to try it</span>
          ) : (
            <button className="spotlight-tooltip-btn" onClick={advance}>
              {step === STEPS.length - 1 ? "Start writing" : "Next"}
            </button>
          )}
        </div>
        <button className="spotlight-skip" onClick={onComplete}>
          Skip tour
        </button>
      </div>
    </div>
  );
}

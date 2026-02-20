import { useCallback, useEffect, useRef, useState } from "react";

/* ── Scene data ── */

const SCENES = [
  {
    tab: "Product",
    sidebar: [
      { label: "Launch Checklist", depth: 0, active: true },
      { label: "Features", depth: 0 },
      { label: "Pricing Page", depth: 1 },
      { label: "FAQ", depth: 1 },
      { label: "Brand Assets", depth: 0 },
    ],
    title: "Launch Checklist",
    paragraphs: [
      "Before going live, make sure every piece is in place. A smooth launch isn't about luck — it's preparation.",
      "Start with the core experience. Does the onboarding flow work on mobile? Have you tested payment in production?",
    ],
    chat: [
      { role: "user", text: "What am I missing for launch day?" },
      {
        role: "assistant",
        text: "Based on your docs: you haven't mentioned a rollback plan, status page, or post-launch monitoring. Want me to draft those sections?",
      },
    ],
  },
  {
    tab: "Blog",
    sidebar: [
      { label: "Why We Rebuilt Our API", depth: 0, active: true },
      { label: "Research", depth: 0 },
      { label: "Outline", depth: 1 },
      { label: "Sources", depth: 1 },
      { label: "Draft v2", depth: 0 },
    ],
    title: "Why We Rebuilt Our API",
    paragraphs: [
      "After three years of patching our REST API, we hit a wall. Every new feature meant weeks of workarounds.",
      "The decision to rewrite wasn't easy — but the alternative was slower. Here's what we learned along the way.",
    ],
    suggestion: {
      del: "After three years of patching our REST API, we hit a wall.",
      ins: "Every Friday deploy felt like defusing a bomb. Three years of patches, and our API was a house of cards.",
    },
    chat: [
      { role: "user", text: "@editor make the intro more engaging" },
      {
        role: "assistant",
        text: "I rewrote your opening to lead with the pain point. Review the suggestion above.",
      },
    ],
  },
  {
    tab: "Novel",
    sidebar: [
      { label: "Part I — Dust", depth: 0 },
      { label: "Chapter 1", depth: 1, active: true },
      { label: "Chapter 2", depth: 1 },
      { label: "Part II — Light", depth: 0 },
      { label: "Characters", depth: 0 },
    ],
    title: "Chapter 1",
    paragraphs: [
      "The library had been empty for thirty years when Maren found the door unlocked. Inside, the air tasted like paper and forgotten promises.",
      'She ran a finger along the nearest shelf. No dust — as if someone had been caring for books no one would ever read again.',
    ],
    chat: [
      { role: "user", text: "What should Maren find in the basement?" },
      {
        role: "assistant",
        text: "Given her arc about inherited memory: a reading room with journals written in her grandmother's handwriting — entries dated after she supposedly died.",
      },
    ],
  },
];

const TYPING_SPEED = 28; // ms per character
const SCENE_DURATION = 14000; // ms before auto-advancing
const CHAT_DELAY_1 = 800; // ms after typing finishes to show user msg
const CHAT_DELAY_2 = 1800; // ms after user msg to show assistant msg
const SUGGESTION_DELAY = 600; // ms after assistant msg to show suggestion card

/* ── Typing hook ── */

function useTypingEffect(text, speed, active) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed("");
      setDone(false);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(id);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);

  return { displayed, done };
}

/* ── Sub-components ── */

function DemoSidebar({ items }) {
  return (
    <div className="demo-sidebar">
      {items.map((item, i) => (
        <div
          key={i}
          className={`demo-sidebar-item${item.active ? " active" : ""}`}
          style={{ paddingLeft: item.depth * 16 + 12 }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, opacity: 0.5 }}
          >
            {item.depth === 0 ? (
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            ) : (
              <>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </>
            )}
          </svg>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DemoSuggestion({ suggestion, visible }) {
  if (!suggestion || !visible) return null;
  return (
    <div className="demo-suggestion">
      <div className="demo-suggestion-diff">
        <del className="demo-suggestion-del">{suggestion.del}</del>
        <ins className="demo-suggestion-ins">{suggestion.ins}</ins>
      </div>
      <div className="demo-suggestion-actions">
        <button className="demo-suggestion-btn accept">Accept</button>
        <button className="demo-suggestion-btn diff">Show changes</button>
        <button className="demo-suggestion-btn reject">Reject</button>
      </div>
    </div>
  );
}

function DemoChat({ messages, typingDone, onAllVisible }) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (!typingDone) return;

    const t1 = setTimeout(() => setVisibleCount(1), CHAT_DELAY_1);
    const t2 = setTimeout(() => {
      setVisibleCount(2);
      onAllVisible?.();
    }, CHAT_DELAY_1 + CHAT_DELAY_2);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [typingDone, onAllVisible]);

  return (
    <div className="demo-chat">
      <div className="demo-chat-header">Chat</div>
      <div className="demo-chat-messages">
        {messages.slice(0, visibleCount).map((msg, i) => (
          <div key={i} className={`demo-chat-msg ${msg.role}`}>
            <div className={`demo-chat-avatar ${msg.role}`} />
            <div className="demo-chat-text">
              {msg.role === "user" && msg.text.includes("@") ? (
                <>
                  <span className="demo-mention">
                    {msg.text.slice(0, msg.text.indexOf(" ", msg.text.indexOf("@")))}
                  </span>
                  {msg.text.slice(msg.text.indexOf(" ", msg.text.indexOf("@")))}
                </>
              ) : (
                msg.text
              )}
            </div>
          </div>
        ))}
        {visibleCount === 1 && (
          <div className="demo-chat-msg assistant">
            <div className="demo-chat-avatar assistant" />
            <div className="demo-typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>
      <div className="demo-chat-composer">
        <span>Ask anything...</span>
      </div>
    </div>
  );
}

/* ── Main component ── */

export function EditorDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const timerRef = useRef(null);
  const scene = SCENES[activeIndex];

  // Full text for typing
  const fullText = scene.paragraphs.join("\n\n");
  const { displayed, done: typingDone } = useTypingEffect(
    fullText,
    TYPING_SPEED,
    !isTransitioning
  );

  const handleChatAllVisible = useCallback(() => {
    if (scene.suggestion) {
      setTimeout(() => setShowSuggestion(true), SUGGESTION_DELAY);
    }
  }, [scene.suggestion]);

  const goToScene = useCallback(
    (index) => {
      if (index === activeIndex) return;
      setIsTransitioning(true);
      setShowSuggestion(false);
      setTimeout(() => {
        setActiveIndex(index);
        setIsTransitioning(false);
      }, 250);
    },
    [activeIndex]
  );

  // Auto-advance
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      goToScene((activeIndex + 1) % SCENES.length);
    }, SCENE_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [activeIndex, goToScene]);

  const handleTabClick = (index) => {
    clearTimeout(timerRef.current);
    goToScene(index);
  };

  // Split displayed text into paragraphs
  const displayedParagraphs = displayed.split("\n\n");

  return (
    <div className="demo-wrapper">
      {/* Tabs */}
      <div className="demo-tabs">
        {SCENES.map((s, i) => (
          <button
            key={s.tab}
            className={`demo-tab${i === activeIndex ? " active" : ""}`}
            onClick={() => handleTabClick(i)}
          >
            {s.tab}
          </button>
        ))}
      </div>

      {/* Editor frame */}
      <div className={`demo-frame${isTransitioning ? " fading" : ""}`}>
        {/* Topbar */}
        <div className="demo-topbar">
          <div className="demo-topbar-dots">
            <span /><span /><span />
          </div>
          <div className="demo-topbar-brand">Mive</div>
        </div>

        {/* Body */}
        <div className="demo-body">
          <DemoSidebar items={scene.sidebar} />

          {/* Editor pane */}
          <div className="demo-editor">
            <div className="demo-editor-title">{scene.title}</div>
            <div className="demo-editor-content">
              {displayedParagraphs.map((p, i) => (
                <p key={i}>
                  {p}
                  {i === displayedParagraphs.length - 1 && !typingDone && (
                    <span className="demo-cursor" />
                  )}
                </p>
              ))}
            </div>
            <DemoSuggestion
              suggestion={scene.suggestion}
              visible={showSuggestion}
            />
          </div>

          {/* Assistant pane */}
          <DemoChat
            messages={scene.chat}
            typingDone={typingDone}
            onAllVisible={handleChatAllVisible}
          />
        </div>
      </div>
    </div>
  );
}

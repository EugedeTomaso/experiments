import { useCallback, useEffect, useRef, useState } from "react";

/* ── Scene data ── */
/* Order: Review (editorial) → Editorial workflow → Writer (creative) */

const SCENES = [
  {
    tab: "Editorial",
    sidebar: [
      { label: "Q1 Product Update", depth: 0, active: true },
      { label: "Press Release", depth: 0 },
      { label: "Style Guide", depth: 1 },
      { label: "Brand Voice", depth: 1 },
      { label: "Legal Review", depth: 0 },
    ],
    title: "Q1 Product Update",
    paragraphs: [
      "We're thrilled to announce several exciting new features that our incredible team has been working tirelessly on for the past quarter.",
      "These groundbreaking innovations will revolutionize the way our customers interact with our platform going forward.",
    ],
    action: {
      type: "review",
      quote: "thrilled to announce several exciting new features",
      comment: "Corporate filler. Cut \"thrilled\", \"exciting\", \"incredible\", \"groundbreaking\", and \"revolutionize\". Lead with what changed and why it matters to the reader.",
    },
    chat: [
      { role: "user", text: "@copy-editor review for tone" },
      {
        role: "assistant",
        text: "Found 4 weak spots. Your draft relies on superlatives instead of specifics. See the review above.",
      },
    ],
  },
  {
    tab: "Review",
    sidebar: [
      { label: "API Migration Guide", depth: 0, active: true },
      { label: "Research", depth: 0 },
      { label: "Outline", depth: 1 },
      { label: "Sources", depth: 1 },
      { label: "Draft v2", depth: 0 },
    ],
    title: "API Migration Guide",
    paragraphs: [
      "After three years of patching our REST API, we hit a wall. Every new feature meant weeks of workarounds.",
      "The decision to rewrite wasn't easy — but the alternative was slower. Here's what we learned along the way.",
    ],
    action: {
      type: "suggestion",
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
    tab: "Creative",
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
    action: {
      type: "critique",
      title: "Opening atmosphere",
      score: 9,
      comment: "Strong sensory detail. The contrast between emptiness and care creates instant intrigue. Consider adding a sound element.",
    },
    chat: [
      { role: "user", text: "@critic rate this opening" },
      {
        role: "assistant",
        text: "Scored your opening across 4 dimensions. See the critique card above.",
      },
    ],
  },
];

const TYPING_SPEED = 18; // ms per character
const SCENE_DURATION = 10000; // ms before auto-advancing
const CHAT_DELAY_1 = 400; // ms after typing finishes to show user msg
const CHAT_DELAY_2 = 1000; // ms after user msg to show assistant msg
const ACTION_DELAY = 400; // ms after assistant msg to show action card

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

/* Action cards */

function DemoActionCard({ action, visible }) {
  if (!action || !visible) return null;

  if (action.type === "suggestion") {
    return (
      <div className="demo-action-card">
        <div className="demo-suggestion-diff">
          <del className="demo-suggestion-del">{action.del}</del>
          <ins className="demo-suggestion-ins">{action.ins}</ins>
        </div>
        <div className="demo-action-buttons">
          <button className="demo-action-btn accept">Accept</button>
          <button className="demo-action-btn neutral">Show changes</button>
          <button className="demo-action-btn reject">Reject</button>
        </div>
      </div>
    );
  }

  if (action.type === "review") {
    return (
      <div className="demo-action-card">
        <div className="demo-review-header">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span className="demo-review-author">Copy Editor</span>
        </div>
        <div className="demo-review-quote">&ldquo;{action.quote}&rdquo;</div>
        <div className="demo-review-body">{action.comment}</div>
        <div className="demo-action-buttons">
          <button className="demo-action-btn accept">Accept</button>
          <button className="demo-action-btn neutral">Dismiss</button>
          <button className="demo-action-btn neutral">Reply</button>
        </div>
      </div>
    );
  }

  if (action.type === "critique") {
    const scoreColor =
      action.score >= 8 ? "green" : action.score >= 5 ? "amber" : "red";
    return (
      <div className="demo-action-card">
        <div className="demo-critique-header">
          <span className="demo-critique-title">{action.title}</span>
          <span className={`demo-critique-score ${scoreColor}`}>
            {action.score}/10
          </span>
        </div>
        <div className="demo-critique-body">{action.comment}</div>
        <div className="demo-action-buttons">
          <button className="demo-action-btn neutral">Discuss</button>
        </div>
      </div>
    );
  }

  return null;
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
  const [showAction, setShowAction] = useState(false);
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
    if (scene.action) {
      setTimeout(() => setShowAction(true), ACTION_DELAY);
    }
  }, [scene.action]);

  const goToScene = useCallback(
    (index) => {
      if (index === activeIndex) return;
      setIsTransitioning(true);
      setShowAction(false);
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
          <div className="demo-topbar-brand">Marvin</div>
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
            <DemoActionCard action={scene.action} visible={showAction} />
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

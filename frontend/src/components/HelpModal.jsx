import { useState } from "react";

const SECTIONS = [
  { id: "getting-started", label: "Getting Started", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8" },
  { id: "shortcuts", label: "Shortcuts", icon: "M18 3a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h12ZM6 15h12a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Z" },
  { id: "features", label: "Features", icon: "M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" },
  { id: "faq", label: "FAQ", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Zm0-6v.01M12 8a2 2 0 0 1 1.71 3.04c-.45.7-1.71 1.04-1.71 1.96" },
  { id: "contact", label: "Contact", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Zm16 2-8 5-8-5" },
];

const SHORTCUTS = [
  { category: "Editor", items: [
    { keys: "\u2318 B", action: "Bold" },
    { keys: "\u2318 I", action: "Italic" },
    { keys: "\u2318 E", action: "Inline code" },
    { keys: "\u2318 \u21e7 X", action: "Strikethrough" },
    { keys: "/", action: "Slash commands" },
    { keys: "\u2318 Z", action: "Undo" },
    { keys: "\u2318 \u21e7 Z", action: "Redo" },
  ]},
  { category: "Navigation", items: [
    { keys: "\u2318 B", action: "Toggle sidebar" },
    { keys: "\u2318 J", action: "Toggle assistant" },
    { keys: "\u2318 ,", action: "Open settings" },
  ]},
  { category: "Actions", items: [
    { keys: "\u2318 S", action: "Save" },
    { keys: "\u2318 \u21e7 E", action: "Export" },
  ]},
];

const FEATURES = [
  { title: "Projects", desc: "Organize your writing into projects with nested files and folders. Each project has its own brief, assistants, and memory.", shortcut: null },
  { title: "Documents", desc: "Rich markdown editor with headings, lists, blockquotes, code blocks, and more. Select text for formatting or press / for slash commands.", shortcut: "/" },
  { title: "AI Review", desc: "Your AI reads the full document and leaves inline suggestions \u2014 approve, dismiss, or reply to each one. Like handing your draft to a trusted editor.", shortcut: null },
  { title: "AI Assistant", desc: "A conversational AI that reads your entire project. Ask it to brainstorm, edit, research, or critique. It remembers your preferences.", shortcut: "\u2318J" },
  { title: "Agents", desc: "Create multiple AI assistants per project \u2014 a brainstormer, a strict editor, a researcher. Each has its own personality and instructions.", shortcut: null },
  { title: "Memory", desc: "Teach your AI preferences like \u201cno cliches\u201d or \u201cuse British spelling.\u201d It remembers across files and conversations.", shortcut: null },
  { title: "Versions", desc: "Every save creates a version. Browse, compare, and restore previous versions of any document.", shortcut: null },
  { title: "Export", desc: "Export your work as PDF, DOCX, EPUB, or Markdown. Export individual documents or entire projects.", shortcut: "\u2318\u21e7E" },
];

const FAQ = [
  { q: "How does the AI read my project?", a: "When you use Review or the Assistant, the AI receives the full content of your current document plus context from sibling documents, the project brief, and any active memories. It sees the whole picture, not just a fragment." },
  { q: "Can I use my own API keys?", a: "Yes. Go to Settings \u2192 Provider Keys and add keys for OpenAI, Anthropic, DeepSeek, or any supported provider. Your keys are encrypted and stored on your server." },
  { q: "How do versions work?", a: "Every time your document saves (autosave or manual), a new version is created. Click the version icon in the document header to browse, compare, and restore any previous version." },
  { q: "Is my writing private?", a: "Your data is stored on your own server. We don\u2019t have access to your writing, API keys, or any other data. AI requests go directly from your server to the provider." },
  { q: "What AI models are supported?", a: "Any model available through OpenAI, Anthropic, OpenRouter, DeepSeek, Cerebras, or Groq. Configure your preferred provider and model in Settings \u2192 AI Defaults." },
  { q: "How does memory work?", a: "Type \u201cremember: [instruction]\u201d in the assistant chat, or add memories manually in Settings \u2192 Memory. Global memories apply everywhere; project memories apply to one project. The AI includes relevant memories in every conversation." },
  { q: "Can I export my work?", a: "Yes \u2014 as PDF, DOCX, EPUB, or Markdown. Export a single document from the document header menu, or an entire project from the project overview." },
  { q: "How do I collaborate?", a: "Click the Share button in the topbar to invite collaborators. They can view, comment, or edit depending on the role you assign. Real-time collaboration is supported." },
];

export function HelpModal({ isOpen, onClose, onReplayTour }) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [expandedFaq, setExpandedFaq] = useState(null);

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal help-modal" onClick={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          <div className="settings-nav-header">Help</div>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`settings-nav-item ${activeSection === section.id ? "active" : ""}`}
              onClick={() => setActiveSection(section.id)}
            >
              <svg className="help-nav-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={section.icon} />
              </svg>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          <div className="settings-content-header">
            <h2>{SECTIONS.find((s) => s.id === activeSection)?.label}</h2>
            <button className="settings-close" onClick={onClose} aria-label="Close help">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {activeSection === "getting-started" && (
            <div className="settings-section">
              <p className="settings-description">
                Quick guides to get the most out of Mive.
              </p>
              <div className="help-guides">
                <div className="help-guide-card">
                  <div className="help-guide-number">1</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Create a project</div>
                    <div className="help-guide-desc">
                      Click "New Project" in the sidebar, pick a type (novel, screenplay, article, etc.), and the AI will suggest a structure — files and folders tailored to your work.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">2</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Write and format</div>
                    <div className="help-guide-desc">
                      Start typing in any document. Select text to see the formatting toolbar, or press <kbd>/</kbd> for slash commands — headings, lists, blockquotes, code, and more.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">3</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Review your writing</div>
                    <div className="help-guide-desc">
                      Click the Review button in the document header. Your AI reads the entire draft and leaves inline suggestions. Approve what you like, dismiss the rest.
                    </div>
                  </div>
                </div>
                <div className="help-guide-card">
                  <div className="help-guide-number">4</div>
                  <div className="help-guide-content">
                    <div className="help-guide-title">Chat with your assistant</div>
                    <div className="help-guide-desc">
                      Press <kbd>⌘J</kbd> to open the assistant. Ask it to brainstorm, rewrite, research, or critique. It reads your whole project and remembers your preferences.
                    </div>
                  </div>
                </div>
              </div>
              <div className="help-replay-section">
                <button className="welcome-ghost-btn" onClick={onReplayTour}>
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: -2 }}>
                    <path d="M1 4v4h4" />
                    <path d="M1 8a7 7 0 1 0 2.05-4.95L1 4" />
                  </svg>
                  Replay the tour
                </button>
              </div>
            </div>
          )}

          {activeSection === "shortcuts" && (
            <div className="settings-section">
              <p className="settings-description">
                Keyboard shortcuts to move faster.
              </p>
              {SHORTCUTS.map((group) => (
                <div key={group.category} className="help-shortcut-group">
                  <div className="help-shortcut-category">{group.category}</div>
                  <div className="help-shortcut-list">
                    {group.items.map((item) => (
                      <div key={item.action} className="help-shortcut-row">
                        <span className="help-shortcut-action">{item.action}</span>
                        <kbd className="help-shortcut-keys">{item.keys}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "features" && (
            <div className="settings-section">
              <p className="settings-description">
                Everything Mive can do for your writing.
              </p>
              <div className="help-features-list">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="help-feature-item">
                    <div className="help-feature-header">
                      <span className="help-feature-name">{feature.title}</span>
                      {feature.shortcut && (
                        <kbd className="help-shortcut-keys">{feature.shortcut}</kbd>
                      )}
                    </div>
                    <div className="help-feature-desc">{feature.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "faq" && (
            <div className="settings-section">
              <p className="settings-description">
                Common questions about Mive.
              </p>
              <div className="help-faq-list">
                {FAQ.map((item, i) => (
                  <div key={i} className={`help-faq-item ${expandedFaq === i ? "expanded" : ""}`}>
                    <button
                      className="help-faq-question"
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    >
                      <span>{item.q}</span>
                      <svg className="help-faq-chevron" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                    </button>
                    {expandedFaq === i && (
                      <div className="help-faq-answer">{item.a}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="settings-section">
              <p className="settings-description">
                We're here to help.
              </p>
              <div className="help-contact-cards">
                <a href="mailto:support@mive.app?subject=Bug Report" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4m0 4h.01" />
                  </svg>
                  <div className="help-contact-title">Report a bug</div>
                  <div className="help-contact-desc">Something broken? Let us know.</div>
                </a>
                <a href="mailto:support@mive.app?subject=Feature Request" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.5 3.4L17 8l-3.5 1.6L12 13l-1.5-3.4L7 8l3.5-1.6Z" />
                    <path d="M9 17l.6 1.3 1.4.7-1.4.6L9 21l-.6-1.4-1.4-.6 1.4-.7Z" />
                  </svg>
                  <div className="help-contact-title">Request a feature</div>
                  <div className="help-contact-desc">Ideas for making Mive better.</div>
                </a>
                <a href="mailto:support@mive.app?subject=Help" className="help-contact-card">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" />
                    <polyline points="22 6 12 13 2 6" />
                  </svg>
                  <div className="help-contact-title">Get help</div>
                  <div className="help-contact-desc">Questions? Reach out anytime.</div>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

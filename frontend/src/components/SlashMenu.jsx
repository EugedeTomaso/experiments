import { editorViewCtx } from "@milkdown/kit/core";
import { slashFactory, SlashProvider } from "@milkdown/kit/plugin/slash";
import {
  createCodeBlockCommand,
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
} from "@milkdown/kit/preset/commonmark";
import { insertTableCommand } from "@milkdown/kit/preset/gfm";
import { insertCalloutCommand } from "../calloutPlugin";
import { useInstance } from "@milkdown/react";
import { callCommand } from "@milkdown/kit/utils";
import { usePluginViewContext } from "@prosemirror-adapter/react";
import { useCallback, useEffect, useRef, useState } from "react";

export const slash = slashFactory("slash-menu");

const COMMANDS = [
  {
    key: "h1",
    label: "Heading 1",
    shortcut: "# ",
    icon: "H1",
    run: (ctx) => callCommand(wrapInHeadingCommand.key, 1)(ctx),
  },
  {
    key: "h2",
    label: "Heading 2",
    shortcut: "## ",
    icon: "H2",
    run: (ctx) => callCommand(wrapInHeadingCommand.key, 2)(ctx),
  },
  {
    key: "h3",
    label: "Heading 3",
    shortcut: "### ",
    icon: "H3",
    run: (ctx) => callCommand(wrapInHeadingCommand.key, 3)(ctx),
  },
  {
    key: "bullet",
    label: "Bullet list",
    shortcut: "- ",
    icon: "UL",
    run: (ctx) => callCommand(wrapInBulletListCommand.key)(ctx),
  },
  {
    key: "ordered",
    label: "Numbered list",
    shortcut: "1. ",
    icon: "OL",
    run: (ctx) => callCommand(wrapInOrderedListCommand.key)(ctx),
  },
  {
    key: "blockquote",
    label: "Quote",
    shortcut: "> ",
    icon: "BQ",
    run: (ctx) => callCommand(wrapInBlockquoteCommand.key)(ctx),
  },
  {
    key: "code",
    label: "Code block",
    shortcut: "``` ",
    icon: "</>",
    run: (ctx) => callCommand(createCodeBlockCommand.key)(ctx),
  },
  {
    key: "hr",
    label: "Divider",
    shortcut: "---",
    icon: "HR",
    run: (ctx) => callCommand(insertHrCommand.key)(ctx),
  },
  {
    key: "table",
    label: "Table",
    shortcut: "",
    icon: "TBL",
    run: (ctx) => callCommand(insertTableCommand.key, { row: 3, col: 3 })(ctx),
  },
  {
    key: "mermaid",
    label: "Mermaid diagram",
    shortcut: "```mermaid",
    icon: "◇",
    run: (ctx) => callCommand(createCodeBlockCommand.key, "mermaid")(ctx),
  },
  {
    key: "callout-note",
    label: "Note",
    shortcut: "> [!NOTE]",
    icon: "ℹ",
    run: (ctx) => callCommand(insertCalloutCommand.key, "note")(ctx),
  },
  {
    key: "callout-tip",
    label: "Tip",
    shortcut: "> [!TIP]",
    icon: "💡",
    run: (ctx) => callCommand(insertCalloutCommand.key, "tip")(ctx),
  },
  {
    key: "callout-warning",
    label: "Warning",
    shortcut: "> [!WARNING]",
    icon: "⚠",
    run: (ctx) => callCommand(insertCalloutCommand.key, "warning")(ctx),
  },
  {
    key: "callout-caution",
    label: "Caution",
    shortcut: "> [!CAUTION]",
    icon: "⛔",
    run: (ctx) => callCommand(insertCalloutCommand.key, "caution")(ctx),
  },
  {
    key: "callout-important",
    label: "Important",
    shortcut: "> [!IMPORTANT]",
    icon: "⭐",
    run: (ctx) => callCommand(insertCalloutCommand.key, "important")(ctx),
  },
  {
    key: "toggle",
    label: "Toggle",
    shortcut: "> [!TOGGLE]",
    icon: "▶",
    run: (ctx) => callCommand(insertCalloutCommand.key, "toggle")(ctx),
  },
  {
    key: "review",
    label: "Review",
    shortcut: "",
    icon: "✏️",
    run: (ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dom.dispatchEvent(new CustomEvent("slash-review-request", { bubbles: true }));
    },
  },
  {
    key: "fact-check",
    label: "Fact-Check",
    shortcut: "",
    icon: "🔍",
    run: (ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dom.dispatchEvent(new CustomEvent("slash-factcheck-request", { bubbles: true }));
    },
  },
];

export function SlashView() {
  const ref = useRef(null);
  const slashProvider = useRef(null);
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { view, prevState } = usePluginViewContext();
  const [loading, get] = useInstance();

  const action = useCallback(
    (fn) => {
      if (loading) return;
      get().action(fn);
    },
    [loading, get]
  );

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  useEffect(() => {
    const div = ref.current;
    if (loading || !div) return;

    slashProvider.current = new SlashProvider({
      content: div,
      shouldShow(view) {
        const { state } = view;
        const { selection } = state;
        if (!selection.empty) return false;

        const { $from } = selection;
        const textBefore = $from.parent.textBetween(
          0,
          $from.parentOffset,
          undefined,
          "\ufffc"
        );

        // Match "/" at start of line or after a space, followed by optional filter text (no spaces)
        const match = textBefore.match(/(^|\s)\/([^\s]*)$/);
        if (!match) {
          setFilter("");
          return false;
        }

        setFilter(match[2]);
        return true;
      },
      debounce: 50,
    });

    return () => {
      slashProvider.current?.destroy();
    };
  }, [loading]);

  useEffect(() => {
    slashProvider.current?.update(view, prevState);
  });

  const runCommand = useCallback(
    (cmd, e) => {
      if (e) e.preventDefault();
      action((ctx) => {
        const editorView = ctx.get(editorViewCtx);
        const { dispatch, state } = editorView;
        const { tr, selection } = state;
        const { from } = selection;
        const { $from } = selection;

        const textBefore = $from.parent.textBetween(
          0,
          $from.parentOffset,
          undefined,
          "\ufffc"
        );
        const match = textBefore.match(/(^|\s)\/([^\s]*)$/);
        if (match) {
          const fullMatch = "/" + match[2];
          dispatch(tr.deleteRange(from - fullMatch.length, from));
        }

        editorView.focus();
        cmd.run(ctx);
      });
    },
    [action]
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (!filtered.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCommand(filtered[selectedIndex]);
      }
    },
    [filtered, selectedIndex, runCommand]
  );

  return (
    <div className="slash-menu-anchor" ref={ref} data-show="false">
      <div className="slash-menu" role="listbox" onKeyDown={handleKeyDown}>
        <div className="slash-menu-header">Blocks</div>
        {filtered.length === 0 && (
          <div className="slash-menu-empty">No matching commands</div>
        )}
        {filtered.map((cmd, i) => (
          <button
            key={cmd.key}
            role="option"
            aria-selected={i === selectedIndex}
            className={`slash-menu-item ${i === selectedIndex ? "selected" : ""}`}
            onMouseDown={(e) => runCommand(cmd, e)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span className="slash-menu-icon">{cmd.icon}</span>
            <span className="slash-menu-label">{cmd.label}</span>
            <span className="slash-menu-shortcut">{cmd.shortcut}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useRef, useEffect, useCallback } from "react";
import { useGhostComplete } from "../hooks/useGhostComplete";

/**
 * Textarea with inline ghost text autocomplete.
 * Shows gray completion text after the user's input.
 * TAB accepts, Esc or typing dismisses.
 */
export function GhostTextarea({ value, onChange, context, className = "", ...props }) {
  const textareaRef = useRef(null);

  const setValue = useCallback((updater) => {
    const next = typeof updater === "function" ? updater(value) : updater;
    onChange(next);
  }, [value, onChange]);

  const { ghostText, acceptGhost, dismissGhost, onInput } = useGhostComplete({
    value,
    setValue,
    context,
  });

  // Trigger autocomplete when value changes (from user typing)
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      onInput();
    }
  }, [value, onInput]);

  const handleKeyDown = (e) => {
    if (e.key === "Tab" && ghostText) {
      e.preventDefault();
      acceptGhost();
      // Move cursor to end after accepting
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.selectionStart = ta.value.length;
          ta.selectionEnd = ta.value.length;
        }
      }, 0);
    } else if (e.key === "Escape" && ghostText) {
      e.preventDefault();
      dismissGhost();
    }

    // Forward other key events
    if (props.onKeyDown) props.onKeyDown(e);
  };

  return (
    <div className="ghost-textarea-wrapper">
      <textarea
        ref={textareaRef}
        className={`ghost-textarea ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {ghostText && (
        <div className="ghost-textarea-overlay" aria-hidden="true">
          <span className="ghost-textarea-real">{value}</span>
          <span className="ghost-textarea-ghost">{ghostText}</span>
        </div>
      )}
    </div>
  );
}

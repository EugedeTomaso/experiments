import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "../api";

/**
 * Ghost text autocomplete hook for textareas.
 *
 * Returns:
 * - ghostText: the suggested completion (render as gray overlay)
 * - acceptGhost: call on TAB to accept the suggestion
 * - dismissGhost: call to clear the suggestion
 * - onInput: attach to textarea's onInput (triggers debounced fetch)
 *
 * Usage:
 *   const { ghostText, acceptGhost, dismissGhost, onInput } = useGhostComplete({
 *     value, setValue, context: "project_description"
 *   });
 */
export function useGhostComplete({ value, setValue, context = "", debounceMs = 300, minLength = 10 }) {
  const [ghostText, setGhostText] = useState("");
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const snapshotRef = useRef("");

  // Dismiss ghost text
  const dismissGhost = useCallback(() => {
    setGhostText("");
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Accept ghost text
  const acceptGhost = useCallback(() => {
    if (!ghostText) return false;
    setValue((prev) => prev + ghostText);
    setGhostText("");
    return true;
  }, [ghostText, setValue]);

  // Trigger autocomplete on input
  const onInput = useCallback(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissGhost();

    timerRef.current = setTimeout(async () => {
      const text = value;
      if (!text || text.length < minLength) return;

      // Don't autocomplete if text ends with a newline (user just pressed enter)
      if (text.endsWith("\n")) return;

      snapshotRef.current = text;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const data = await api.autocomplete(text, context);
        // Only apply if value hasn't changed since we sent the request
        if (snapshotRef.current === text && !controller.signal.aborted) {
          const completion = data.completion || "";
          if (completion) {
            setGhostText(completion);
          }
        }
      } catch {
        // Silently ignore autocomplete errors
      }
    }, debounceMs);
  }, [value, context, debounceMs, minLength, dismissGhost]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return { ghostText, acceptGhost, dismissGhost, onInput };
}

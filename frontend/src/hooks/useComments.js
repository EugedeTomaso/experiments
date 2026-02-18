import { useState, useMemo, useCallback } from "react";
import { api } from "../api";

/**
 * Centralized comment state and actions.
 *
 * `openComments` is the single source of truth for:
 *   - Which highlights to render (passed to decoration plugin)
 *   - Navigation prev/next ordering
 *   - Counter display (N/M)
 */
export function useComments({ nodeId, editorRef, editorWrapperRef }) {
  const [comments, setComments] = useState([]);
  const [activeThread, setActiveThread] = useState(null); // { comment, rect } | null
  const [focusedId, setFocusedId] = useState(null);
  const [aiThinkingId, setAiThinkingId] = useState(null);

  // --- Derived state ---

  // openComments: root comments that are actionable and have inline positions.
  // This is the ONLY list used for navigation, decorations, and counting.
  const openComments = useMemo(() => {
    return comments
      .filter(
        (c) =>
          !c.parent &&
          c.status !== "resolved" &&
          c.status !== "approved" &&
          c.status !== "rejected" &&
          c.quoted_text
      )
      .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity));
  }, [comments]);

  const navIndex = useMemo(() => {
    if (!focusedId) return -1;
    return openComments.findIndex((c) => c.id === focusedId);
  }, [focusedId, openComments]);

  const navTotal = openComments.length;

  // --- Loading ---

  const load = useCallback(
    async (nId) => {
      if (!nId) {
        setComments([]);
        return;
      }
      try {
        const list = await api.listComments(nId);
        setComments(list);
      } catch {
        setComments([]);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setComments([]);
    setActiveThread(null);
    setFocusedId(null);
    setAiThinkingId(null);
  }, []);

  // --- Navigation helpers ---

  const findHighlightElement = useCallback(
    (commentId) => {
      return editorWrapperRef.current?.querySelector(
        `[data-comment-id="${commentId}"]`
      );
    },
    [editorWrapperRef]
  );

  const navigateTo = useCallback(
    (commentId) => {
      setFocusedId(commentId);
      const el = findHighlightElement(commentId);
      if (el) {
        el.scrollIntoView({ behavior: "instant", block: "center" });
        // Wait for scroll to finish before capturing position
        requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect();
          const comment = comments.find((c) => c.id === commentId);
          if (comment) {
            setActiveThread({ comment, rect });
          }
        });
      }
    },
    [comments, findHighlightElement]
  );

  const navigatePrev = useCallback(() => {
    if (openComments.length === 0) return;
    const currentIdx = focusedId != null
      ? openComments.findIndex((c) => c.id === focusedId)
      : -1;
    const prevIdx = currentIdx <= 0 ? openComments.length - 1 : currentIdx - 1;
    navigateTo(openComments[prevIdx].id);
  }, [openComments, focusedId, navigateTo]);

  const navigateNext = useCallback(() => {
    if (openComments.length === 0) return;
    const currentIdx = focusedId != null
      ? openComments.findIndex((c) => c.id === focusedId)
      : -1;
    const nextIdx = currentIdx >= openComments.length - 1 ? 0 : currentIdx + 1;
    navigateTo(openComments[nextIdx].id);
  }, [openComments, focusedId, navigateTo]);

  // --- Thread management ---

  const openThread = useCallback((comment, rect) => {
    setActiveThread({ comment, rect });
    setFocusedId(comment.id);
  }, []);

  const closeThread = useCallback(() => {
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  // --- Actions ---

  const create = useCallback(
    async (payload) => {
      const comment = await api.createComment(payload);
      setComments((prev) => [...prev, comment]);
      return comment;
    },
    []
  );

  const approve = useCallback(
    async (commentId) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment || !comment.suggested_text) return;

      // Apply suggestion to ProseMirror document
      if (editorRef.current) {
        editorRef.current.applySuggestion(
          comment.quoted_text,
          comment.suggested_text,
          comment.position_from
        );
      }

      try {
        const updated = await api.approveComment(commentId);
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
        );
        // After 1.5s, also persist as resolved on backend.
        // The decoration plugin already excludes "approved" via openComments
        // filter, so no ghost highlight. The CSS fade-out handles the visual.
        setTimeout(async () => {
          try {
            const resolved = await api.resolveComment(commentId);
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, ...resolved } : c
              )
            );
          } catch {
            setComments((prev) =>
              prev.map((c) =>
                c.id === commentId ? { ...c, status: "resolved" } : c
              )
            );
          }
        }, 1500);
      } catch (err) {
        console.error("Approve failed:", err);
      }
      setActiveThread(null);
      setFocusedId(null);
    },
    [comments, editorRef]
  );

  const reject = useCallback(async (commentId) => {
    try {
      const updated = await api.rejectComment(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
    } catch (err) {
      console.error("Reject failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const resolve = useCallback(async (commentId) => {
    try {
      const updated = await api.resolveComment(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...updated } : c))
      );
    } catch (err) {
      console.error("Resolve failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const remove = useCallback(async (commentId) => {
    try {
      await api.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setActiveThread(null);
    setFocusedId(null);
  }, []);

  const reply = useCallback(
    async (parentId, body) => {
      if (!nodeId) return;
      const replyComment = await api.createComment({
        node: nodeId,
        parent: parentId,
        body,
        author_type: "user",
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId
            ? { ...c, replies: [...(c.replies || []), replyComment] }
            : c
        )
      );
      setActiveThread((prev) => {
        if (!prev || prev.comment.id !== parentId) return prev;
        return {
          ...prev,
          comment: {
            ...prev.comment,
            replies: [...(prev.comment.replies || []), replyComment],
          },
        };
      });
    },
    [nodeId]
  );

  const askAI = useCallback(
    async (commentId) => {
      if (!nodeId) return;
      setAiThinkingId(commentId);
      try {
        const providerSettings = JSON.parse(
          localStorage.getItem("marvin:ai-provider") || "{}"
        );
        const provider = providerSettings.provider || "deepseek";
        const model = providerSettings.model || "deepseek-chat";
        const rootComment = comments.find((c) => c.id === commentId);
        const lastUserReply = (rootComment?.replies || [])
          .filter((r) => r.author_type === "user")
          .pop();
        if (!lastUserReply) return;

        const result = await api.requestCommentReply({
          comment_id: commentId,
          user_message: lastUserReply.body,
          provider,
          model,
        });
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                ...result.root_comment,
                replies: [...(c.replies || []), result.reply],
              };
            }
            return c;
          })
        );
        setActiveThread((prev) => {
          if (!prev || prev.comment.id !== commentId) return prev;
          return {
            ...prev,
            comment: {
              ...prev.comment,
              ...result.root_comment,
              replies: [...(prev.comment.replies || []), result.reply],
            },
          };
        });
      } catch (err) {
        console.error("AI reply failed:", err);
      } finally {
        setAiThinkingId(null);
      }
    },
    [nodeId, comments]
  );

  // Add comments in bulk (used by review and fact-check flows)
  const addBulk = useCallback((newComments) => {
    setComments((prev) => [...prev, ...newComments]);
  }, []);

  // Add a single comment (used by SSE fact-check stream)
  const addOne = useCallback((comment) => {
    setComments((prev) => [...prev, comment]);
  }, []);

  // --- Review progress (derived) ---
  const reviewComments = useMemo(
    () => comments.filter((c) => c.author_type === "assistant" && !c.parent),
    [comments]
  );
  const reviewResolved = useMemo(
    () =>
      reviewComments.filter(
        (c) =>
          c.status === "approved" ||
          c.status === "rejected" ||
          c.status === "resolved"
      ).length,
    [reviewComments]
  );
  const hasReviewProgress =
    reviewComments.length > 0 && reviewResolved < reviewComments.length;

  return {
    comments,
    openComments,
    activeThread,
    focusedId,
    navIndex,
    navTotal,
    aiThinkingId,
    reviewComments,
    reviewResolved,
    hasReviewProgress,
    load,
    clear,
    navigateTo,
    navigatePrev,
    navigateNext,
    openThread,
    closeThread,
    create,
    approve,
    reject,
    resolve,
    remove,
    reply,
    askAI,
    addBulk,
    addOne,
    setComments,
  };
}

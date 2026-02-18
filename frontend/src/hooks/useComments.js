import { useState, useMemo, useCallback, useRef } from "react";
import { api } from "../api";

/**
 * Centralized comment state and actions.
 *
 * `openComments` is the single source of truth for:
 *   - Which highlights to render (passed to decoration plugin)
 *   - Navigation prev/next ordering
 *   - Counter display (N/M)
 */
export function useComments({ nodeId, editorRef, editorWrapperRef, content }) {
  const [comments, setComments] = useState([]);
  const [activeThread, setActiveThread] = useState(null); // { comment, rect } | null
  const [focusedId, setFocusedId] = useState(null);
  const [aiThinkingId, setAiThinkingId] = useState(null);

  // --- Derived state ---

  // Quick check: does the quoted_text appear in the current document content?
  // Filters out orphaned comments from previous versions of the document.
  const isAnchored = useCallback(
    (c) => !c.quoted_text || !content || content.includes(c.quoted_text),
    [content]
  );

  // openComments: root comments that are actionable and have inline positions.
  // Used for navigation and counting (excludes approved/rejected/resolved).
  const openComments = useMemo(() => {
    return comments
      .filter(
        (c) =>
          !c.parent &&
          c.status !== "resolved" &&
          c.status !== "approved" &&
          c.status !== "rejected" &&
          c.quoted_text &&
          isAnchored(c)
      )
      .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity));
  }, [comments, isAnchored]);

  // decorationComments: includes approved/rejected for CSS fade-out transitions.
  // Only excludes "resolved" so highlights can animate out before removal.
  const decorationComments = useMemo(() => {
    return comments.filter(
      (c) => !c.parent && c.status !== "resolved" && c.quoted_text
    );
  }, [comments]);

  // Tab-filtered derived state for review/verify panels
  const reviewTabComments = useMemo(() =>
    comments
      .filter(c => !c.parent && c.comment_type !== "fact_check" && c.status !== "resolved" && c.quoted_text && isAnchored(c))
      .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity)),
    [comments, content]
  );

  const verifyTabComments = useMemo(() =>
    comments
      .filter(c => !c.parent && c.comment_type === "fact_check" && c.status !== "resolved" && c.quoted_text && isAnchored(c))
      .sort((a, b) => (a.position_from ?? Infinity) - (b.position_from ?? Infinity)),
    [comments, content]
  );

  const reviewPendingCount = useMemo(() =>
    reviewTabComments.filter(c => c.status === "open").length,
    [reviewTabComments]
  );

  const verifyPendingCount = useMemo(() =>
    verifyTabComments.filter(c => c.status === "open").length,
    [verifyTabComments]
  );

  const reviewAcceptedCount = useMemo(() =>
    comments.filter(c => !c.parent && c.comment_type !== "fact_check" && (c.status === "approved" || c.status === "resolved") && c.author_type === "assistant").length,
    [comments]
  );

  const reviewDismissedCount = useMemo(() =>
    comments.filter(c => !c.parent && c.comment_type !== "fact_check" && c.status === "rejected" && c.author_type === "assistant").length,
    [comments]
  );

  const getReplies = useCallback((parentId) =>
    comments.filter(c => c.parent === parentId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [comments]
  );

  const navIndex = useMemo(() => {
    if (!focusedId) return -1;
    return openComments.findIndex((c) => c.id === focusedId);
  }, [focusedId, openComments]);

  const navTotal = openComments.length;

  // --- Loading ---

  const loadSeqRef = useRef(0);

  const load = useCallback(
    async (nId) => {
      const seq = ++loadSeqRef.current;
      if (!nId) {
        setComments([]);
        return;
      }
      try {
        const list = await api.listComments(nId);
        if (seq === loadSeqRef.current) {
          // Flatten: root comments + their nested replies into one array
          const flat = [];
          for (const c of list) {
            const { replies, ...root } = c;
            flat.push(root);
            if (replies && replies.length) {
              flat.push(...replies);
            }
          }
          setComments(flat);
        }
      } catch {
        if (seq === loadSeqRef.current) setComments([]);
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
        // Flash the highlight to draw attention
        el.classList.remove("comment-highlight--flash");
        // Force reflow so re-adding the class restarts the animation
        void el.offsetWidth;
        el.classList.add("comment-highlight--flash");
        el.addEventListener(
          "animationend",
          () => el.classList.remove("comment-highlight--flash"),
          { once: true }
        );
      }
    },
    [findHighlightElement]
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

  const focusComment = useCallback((commentId) => {
    setFocusedId(commentId);
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

  // Accept a suggestion from a reply (alternative offered in the thread)
  const approveReply = useCallback(
    async (replyId) => {
      const reply = comments.find((c) => c.id === replyId);
      if (!reply || !reply.suggested_text || !reply.parent) return;
      const rootId = reply.parent;
      const root = comments.find((c) => c.id === rootId);
      if (!root) return;

      // Apply the reply's suggestion using root's position
      if (editorRef.current) {
        editorRef.current.applySuggestion(
          root.quoted_text,
          reply.suggested_text,
          root.position_from
        );
      }

      try {
        const updated = await api.approveComment(rootId);
        setComments((prev) =>
          prev.map((c) => (c.id === rootId ? { ...c, ...updated } : c))
        );
        setTimeout(async () => {
          try {
            const resolved = await api.resolveComment(rootId);
            setComments((prev) =>
              prev.map((c) => (c.id === rootId ? { ...c, ...resolved } : c))
            );
          } catch {
            setComments((prev) =>
              prev.map((c) => (c.id === rootId ? { ...c, status: "resolved" } : c))
            );
          }
        }, 1500);
      } catch (err) {
        console.error("Approve reply failed:", err);
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
      setComments((prev) => [...prev, replyComment]);
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
        const lastUserReply = comments
          .filter((c) => c.parent === commentId && c.author_type === "user")
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .pop();
        if (!lastUserReply) return;

        const result = await api.requestCommentReply({
          comment_id: commentId,
          user_message: lastUserReply.body,
          provider,
          model,
        });
        setComments((prev) => [
          ...prev.map((c) =>
            c.id === commentId ? { ...c, ...result.root_comment } : c
          ),
          result.reply,
        ]);
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
    () => comments.filter((c) => c.author_type === "assistant" && !c.parent && isAnchored(c)),
    [comments, isAnchored]
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
    decorationComments,
    reviewTabComments,
    verifyTabComments,
    reviewPendingCount,
    verifyPendingCount,
    reviewAcceptedCount,
    reviewDismissedCount,
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
    focusComment,
    create,
    approve,
    approveReply,
    reject,
    resolve,
    remove,
    reply,
    askAI,
    addBulk,
    addOne,
    setComments,
    getReplies,
  };
}

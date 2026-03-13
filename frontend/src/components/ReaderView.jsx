import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { MarkdownEditor } from "../MarkdownEditor";
import { AIToolsPanel } from "./AIToolsPanel";
import { ReviewerChatPanel } from "./ReviewerChatPanel";
import { ReportBuilder } from "./ReportBuilder";
import { ReviewCommentPopover } from "./ReviewCommentPopover";

export function ReaderView({ review, listing, onBack }) {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeContent, setNodeContent] = useState("");
  const [nodeTitle, setNodeTitle] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("tools");

  const [popoverSelection, setPopoverSelection] = useState(null);
  const [viewingComment, setViewingComment] = useState(null);
  const editorContainerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getListingNodes(listing.id);
        if (cancelled) return;
        const nodeList = Array.isArray(data) ? data : data.results || [];
        setNodes(nodeList);
        const firstFile = nodeList.find((n) => n.type === "file");
        if (firstFile) {
          setSelectedNodeId(firstFile.id);
        }
      } catch (err) {
        console.error("Failed to load nodes:", err);
      } finally {
        if (!cancelled) setLoadingNodes(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [listing.id]);

  useEffect(() => {
    if (!selectedNodeId) return;
    setNodeLoading(true);
    let cancelled = false;
    async function loadNode() {
      try {
        const node = await api.getListingNode(listing.id, selectedNodeId);
        if (!cancelled) {
          setNodeContent(node.content_md || "");
          setNodeTitle(node.title || "");
        }
      } catch (err) {
        console.error("Failed to load node:", err);
      } finally {
        if (!cancelled) setNodeLoading(false);
      }
    }
    loadNode();
    return () => { cancelled = true; };
  }, [listing.id, selectedNodeId]);

  useEffect(() => {
    async function loadComments() {
      try {
        const data = await api.listReviewComments(review.id);
        setComments(Array.isArray(data) ? data : data.results || []);
      } catch (err) {
        console.error("Failed to load comments:", err);
      }
    }
    loadComments();
  }, [review.id]);

  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    function handleCommentRequest(e) {
      setViewingComment(null);
      setPopoverSelection(e.detail);
    }

    function handleHighlightClick(e) {
      setPopoverSelection(null);
      const { commentIds, rect } = e.detail;
      const comment = commentsRef.current.find((c) => commentIds.includes(c.id));
      if (comment) {
        setViewingComment({ comment, rect });
      }
    }

    container.addEventListener("review-comment-request", handleCommentRequest);
    container.addEventListener("comment-highlight-click", handleHighlightClick);
    return () => {
      container.removeEventListener("review-comment-request", handleCommentRequest);
      container.removeEventListener("comment-highlight-click", handleHighlightClick);
    };
  }, [loadingNodes, selectedNodeId]);

  const handleSaveComment = useCallback(async (commentData) => {
    try {
      const created = await api.createReviewComment(review.id, {
        node: selectedNodeId,
        ...commentData,
      });
      setComments((prev) => [...prev, created]);
      setPopoverSelection(null);
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  }, [review.id, selectedNodeId]);

  const handleDeleteComment = useCallback(async (commentId) => {
    try {
      await api.deleteReviewComment(review.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  }, [review.id]);

  const handleExpandToPanel = useCallback((draft) => {
    setActiveTab("report");
  }, []);

  const nodeComments = comments.filter((c) => c.node === selectedNodeId);

  const rootNodes = nodes.filter((n) => !n.parent_id);
  const childrenOf = (parentId) => nodes.filter((n) => n.parent_id === parentId).sort((a, b) => a.order - b.order);

  function renderTreeNode(node, depth = 0) {
    const isFolder = node.type === "folder";
    const isSelected = node.id === selectedNodeId;
    const children = childrenOf(node.id);

    return (
      <div key={node.id}>
        <button
          className={`reader-tree__node${isSelected ? " reader-tree__node--active" : ""}${isFolder ? " reader-tree__node--folder" : ""}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={() => {
            if (!isFolder) {
              setSelectedNodeId(node.id);
              setPopoverSelection(null);
              setViewingComment(null);
            }
          }}
        >
          <span className="reader-tree__icon">
            <ReviewerIcon
              name={isFolder ? REVIEWER_TREE_ICONS.folder : REVIEWER_TREE_ICONS.file}
              size={14}
            />
          </span>
          <span className="reader-tree__label">{node.title}</span>
          {!isFolder && (
            <span className="reader-tree__comment-count">
              {comments.filter((c) => c.node === node.id).length || ""}
            </span>
          )}
        </button>
        {isFolder && children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  }

  if (loadingNodes) {
    return <div className="reader-view__loading">Loading document...</div>;
  }

  return (
    <div className="reader-view">
      <header className="reader-view__topbar">
        <div className="reader-view__topbar-left">
          <button className="btn-text" onClick={onBack}>&larr; Back</button>
          <span className="reader-view__project-name">{listing.project_name}</span>
          {nodeTitle && <span className="reader-view__node-name">/ {nodeTitle}</span>}
        </div>
        <div className="reader-view__topbar-right">
          <span className="reader-view__comment-total">
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <div className="reader-view__body">
        <aside className="reader-view__sidebar">
          <div className="reader-tree">
            {rootNodes.sort((a, b) => a.order - b.order).map((n) => renderTreeNode(n))}
          </div>
        </aside>

        <div className="reader-view__editor" ref={editorContainerRef} style={{ position: "relative" }}>
          {selectedNodeId && !nodeLoading ? (
            <MarkdownEditor
              key={selectedNodeId}
              value={nodeContent}
              readOnly={true}
              reviewerMode={true}
              docId={`review-${selectedNodeId}`}
              onChange={() => {}}
              comments={nodeComments}
            />
          ) : selectedNodeId ? (
            <div className="reader-view__no-selection">Loading chapter...</div>
          ) : (
            <div className="reader-view__no-selection">Select a document to read</div>
          )}

          {popoverSelection && (
            <ReviewCommentPopover
              selection={popoverSelection}
              onSave={handleSaveComment}
              onCancel={() => setPopoverSelection(null)}
              onExpand={handleExpandToPanel}
              containerRef={editorContainerRef}
            />
          )}

          {viewingComment && (
            <ReviewCommentPopover
              selection={{ rect: viewingComment.rect }}
              existingComment={viewingComment.comment}
              onCancel={() => setViewingComment(null)}
              containerRef={editorContainerRef}
            />
          )}
        </div>

        <aside className="reader-view__panel">
          <div className="reader-panel__tabs">
            <button
              className={`reader-panel__tab${activeTab === "tools" ? " reader-panel__tab--active" : ""}`}
              onClick={() => setActiveTab("tools")}
            >
              AI Tools
            </button>
            <button
              className={`reader-panel__tab${activeTab === "chat" ? " reader-panel__tab--active" : ""}`}
              onClick={() => setActiveTab("chat")}
            >
              Chat
            </button>
            <button
              className={`reader-panel__tab${activeTab === "report" ? " reader-panel__tab--active" : ""}`}
              onClick={() => setActiveTab("report")}
            >
              Report ({comments.length})
            </button>
          </div>
          <div className="reader-panel__content">
            <div key={activeTab} className="reader-panel__content-view">
            {activeTab === "tools" && (
              <AIToolsPanel reviewId={review.id} nodeId={selectedNodeId} />
            )}
            {activeTab === "chat" && (
              <ReviewerChatPanel
                reviewId={review.id}
                nodeId={selectedNodeId}
                nodeTitle={nodeTitle}
              />
            )}
            {activeTab === "report" && (
              <ReportBuilder
                review={review}
                comments={comments}
                onCommentDelete={handleDeleteComment}
                onSubmitted={() => onBack()}
              />
            )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

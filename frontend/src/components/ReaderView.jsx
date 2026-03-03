import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { MarkdownEditor } from "../MarkdownEditor";
import { AIToolsPanel } from "./AIToolsPanel";
import { ReviewerChatPanel } from "./ReviewerChatPanel";
import { ReportBuilder } from "./ReportBuilder";

export function ReaderView({ review, listing, onBack }) {
  const [nodes, setNodes] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeContent, setNodeContent] = useState("");
  const [nodeTitle, setNodeTitle] = useState("");
  const [comments, setComments] = useState([]);
  const [loadingNodes, setLoadingNodes] = useState(true);
  const [activeTab, setActiveTab] = useState("tools");

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

  const handleAddComment = useCallback(async (commentData) => {
    try {
      const created = await api.createReviewComment(review.id, {
        node: selectedNodeId,
        ...commentData,
      });
      setComments((prev) => [...prev, created]);
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
          onClick={() => !isFolder && setSelectedNodeId(node.id)}
        >
          <span className="reader-tree__icon">{isFolder ? "\u{1F4C1}" : "\u{1F4C4}"}</span>
          <span className="reader-tree__label">{node.title}</span>
        </button>
        {isFolder && children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  }

  const nodeComments = comments.filter((c) => c.node === selectedNodeId);

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
      </header>

      <div className="reader-view__body">
        <aside className="reader-view__sidebar">
          <div className="reader-tree">
            {rootNodes.sort((a, b) => a.order - b.order).map((n) => renderTreeNode(n))}
          </div>
        </aside>

        <div className="reader-view__editor">
          {selectedNodeId ? (
            <MarkdownEditor
              key={selectedNodeId}
              value={nodeContent}
              readOnly={true}
              docId={`review-${selectedNodeId}`}
              onChange={() => {}}
            />
          ) : (
            <div className="reader-view__no-selection">Select a document to read</div>
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
              Report
            </button>
          </div>
          <div className="reader-panel__content">
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
        </aside>
      </div>
    </div>
  );
}

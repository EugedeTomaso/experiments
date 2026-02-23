import { useState } from "react";

function wordCount(text) {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1Z" />
      <polyline points="9 1 9 5 13 5" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v8Z" />
    </svg>
  );
}

export default function CreateFileCard({ block, onCreateFile, onCreateFolder }) {
  const [status, setStatus] = useState("pending"); // pending | creating | created

  const handleCreate = async () => {
    setStatus("creating");
    try {
      if (block.type === "folder") {
        await onCreateFolder(block);
      } else {
        await onCreateFile(block);
      }
      setStatus("created");
    } catch (e) {
      console.error("Failed to create:", e);
      setStatus("pending");
    }
  };

  if (block.type === "folder") {
    return (
      <div className="create-file-card">
        <div className="create-file-card-header">
          <FolderIcon />
          <span className="create-file-card-title">{block.title}</span>
        </div>
        {block.files.length > 0 && (
          <div className="create-file-card-filelist">
            {block.files.map((f, i) => (
              <div key={i} className="create-file-card-filelist-item">
                <FileIcon />
                <span>{f.title}</span>
                <span className="create-file-card-meta">{wordCount(f.content)} words</span>
              </div>
            ))}
          </div>
        )}
        <div className="create-file-card-actions">
          {status === "pending" && (
            <button className="create-file-card-btn" onClick={handleCreate}>
              Create all
            </button>
          )}
          {status === "creating" && (
            <span className="create-file-card-status">Creating...</span>
          )}
          {status === "created" && (
            <span className="create-file-card-status create-file-card-done">Created</span>
          )}
        </div>
      </div>
    );
  }

  // Single file
  const words = wordCount(block.content);
  return (
    <div className="create-file-card">
      <div className="create-file-card-header">
        <FileIcon />
        <span className="create-file-card-title">{block.title}</span>
      </div>
      {block.folder && (
        <div className="create-file-card-location">in {block.folder}/</div>
      )}
      <div className="create-file-card-meta">{words} words</div>
      <div className="create-file-card-actions">
        {status === "pending" && (
          <button className="create-file-card-btn" onClick={handleCreate}>
            Create & open
          </button>
        )}
        {status === "creating" && (
          <span className="create-file-card-status">Creating...</span>
        )}
        {status === "created" && (
          <span className="create-file-card-status create-file-card-done">Created</span>
        )}
      </div>
    </div>
  );
}

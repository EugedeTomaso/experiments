import { timeAgo } from "../utils";

const FileIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M4.5 1.5h4.586a1 1 0 0 1 .707.293l2.914 2.914a1 1 0 0 1 .293.707V13.5a1 1 0 0 1-1 1h-7.5a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
    <path
      d="M9 1.5v3a1 1 0 0 0 1 1h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const FolderIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d="M1.5 3.5a1 1 0 0 1 1-1h3.586a1 1 0 0 1 .707.293L8.5 4.5h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

export function SearchResultItem({ result, onSelect }) {
  return (
    <div
      className="search-result-item"
      onClick={() => onSelect({ id: result.id, type: result.type })}
    >
      <div className="search-result-header">
        <span className="search-result-icon">
          {result.type === "folder" ? <FolderIcon /> : <FileIcon />}
        </span>
        <span className="search-result-title">{result.title}</span>
      </div>
      {result.headline && (
        <div
          className="search-result-headline"
          dangerouslySetInnerHTML={{ __html: result.headline }}
        />
      )}
      <div className="search-result-meta">
        {timeAgo(result.updated_at)}
        {result.word_count > 0 && <> &middot; {result.word_count}w</>}
      </div>
    </div>
  );
}

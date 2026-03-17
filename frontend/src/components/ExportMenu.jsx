import { useState, useRef, useEffect } from "react";
import { api, getAuthHeader } from "../api";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const FORMATS_BY_TYPE = {
  novel: ["epub", "pdf", "docx", "md"],
  "short-story": ["epub", "pdf", "docx", "md"],
  screenplay: ["screenplay_pdf"],
  "tv-series": ["screenplay_pdf"],
  youtube: ["pdf", "docx"],
  article: ["html", "pdf", "md"],
  academic: ["pdf", "docx"],
  product: ["pdf", "docx"],
  freeform: ["md", "pdf"],
  custom: ["md", "pdf"],
};

const FORMAT_LABELS = {
  md: "Markdown",
  html: "HTML",
  pdf: "PDF",
  docx: "Word (DOCX)",
  epub: "EPUB",
  screenplay_pdf: "Screenplay PDF",
};

const PLATFORM_LABELS = {
  medium: "Medium",
  linkedin: "LinkedIn",
  twitter: "Twitter / X",
};

async function downloadExport(url, format, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `export.${format === "screenplay_pdf" ? "pdf" : format}`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ExportMenu({ node, project, nodes, onPublish }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [connections, setConnections] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  // Load connections when opened
  useEffect(() => {
    if (!isOpen) return;
    api.listConnections().then(setConnections).catch(() => {});
  }, [isOpen]);

  // Listen for OAuth success
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === "oauth-success") {
        api.listConnections().then(setConnections).catch(() => {});
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const projectType = project?.project_type || "freeform";
  const formats = FORMATS_BY_TYPE[projectType] || FORMATS_BY_TYPE.freeform;

  async function handleExportNode(fmt) {
    if (!node) return;
    setExporting(fmt);
    try {
      await downloadExport(
        `${API_BASE}/api/export/node/${node.id}/`,
        fmt,
        { format: fmt }
      );
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  }

  async function handleExportProject(fmt) {
    if (!project) return;
    setExporting(`project-${fmt}`);
    try {
      await downloadExport(
        `${API_BASE}/api/export/project/${project.id}/`,
        fmt,
        { format: fmt }
      );
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(null);
    }
  }

  function handlePlatformClick(platform) {
    const conn = connections.find((c) => c.platform === platform);
    if (conn) {
      // Already connected → open publish dialog
      setIsOpen(false);
      onPublish?.(platform, conn);
    } else {
      // Not connected → start OAuth
      api.initiateOAuth(platform).then((data) => {
        if (data?.auth_url) {
          window.open(data.auth_url, "_blank", "width=600,height=700");
        }
      }).catch(console.error);
    }
  }

  return (
    <div className="export-menu" ref={ref}>
      <button
        className="export-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Export</span>
      </button>
      {isOpen && (
        <div className="export-dropdown">
          {/* Document export */}
          {node && (
            <>
              <div className="export-section-label">Export document</div>
              {formats.map((fmt) => (
                <button
                  key={fmt}
                  className="export-item"
                  disabled={exporting === fmt}
                  onClick={() => handleExportNode(fmt)}
                >
                  <span>{FORMAT_LABELS[fmt] || fmt.toUpperCase()}</span>
                  {exporting === fmt && <span className="export-spinner" />}
                </button>
              ))}
            </>
          )}

          {/* Project export */}
          {project && nodes && nodes.length > 0 && (
            <>
              <div className="export-section-divider" />
              <div className="export-section-label">Export project</div>
              {formats.map((fmt) => (
                <button
                  key={`project-${fmt}`}
                  className="export-item"
                  disabled={exporting === `project-${fmt}`}
                  onClick={() => handleExportProject(fmt)}
                >
                  <span>{FORMAT_LABELS[fmt] || fmt.toUpperCase()}</span>
                  {exporting === `project-${fmt}` && <span className="export-spinner" />}
                </button>
              ))}
            </>
          )}

          {/* Publish */}
          <div className="export-section-divider" />
          <div className="export-section-label">Publish to...</div>
          {Object.entries(PLATFORM_LABELS).map(([platform, label]) => {
            const conn = connections.find((c) => c.platform === platform);
            return (
              <button
                key={platform}
                className="export-item"
                onClick={() => handlePlatformClick(platform)}
              >
                <span>{label}</span>
                <span className={`export-platform-status${conn ? " connected" : ""}`}>
                  {conn ? conn.platform_username || "Connected" : "Connect"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

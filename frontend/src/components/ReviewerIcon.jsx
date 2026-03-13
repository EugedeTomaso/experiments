const ICONS = {
  structure: (
    <>
      <path d="M4 5.5h6" />
      <path d="M4 10.5h10" />
      <path d="M4 15.5h7" />
      <path d="M12.5 4v3" />
      <path d="M9.5 9v3" />
    </>
  ),
  prose: (
    <>
      <path d="M5 15.5c2.2-1.6 3.6-4.2 4-7.4l.3-2.1 3.7 3.7-2.1.3c-3.2.4-5.8 1.8-7.4 4Z" />
      <path d="M10 6.5 12.8 3.7a1.8 1.8 0 1 1 2.5 2.5L12.5 9" />
    </>
  ),
  inconsistencies: (
    <>
      <circle cx="7.5" cy="7.5" r="3.75" />
      <path d="m10.4 10.4 3.1 3.1" />
      <path d="M7.5 5.9v2.1" />
      <path d="M7.5 10.2h.01" />
    </>
  ),
  summaries: (
    <>
      <rect x="3.5" y="4" width="9" height="10" rx="1.5" />
      <path d="M6 7h4" />
      <path d="M6 9.75h4" />
      <path d="M6 12.5h2.5" />
      <path d="M12.5 6.5h1.8" />
      <path d="M12.5 9.5h1.8" />
      <path d="M12.5 12.5h1.8" />
    </>
  ),
  characters: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="11.5" cy="7" r="1.8" />
      <path d="M3.8 12.8a3.2 3.2 0 0 1 4.4 0" />
      <path d="M9.2 13.2a2.8 2.8 0 0 1 4.1 0" />
      <path d="M8.8 8.3 9.9 8.7" />
    </>
  ),
  genre: (
    <>
      <path d="M4.5 13.5V9.5" />
      <path d="M8 13.5V6.5" />
      <path d="M11.5 13.5V8" />
      <path d="M3 13.5h10" />
      <path d="M4.5 9.5 8 6.5 11.5 8 13 5.5" />
    </>
  ),
  folder: (
    <>
      <path d="M2.75 5.25A1.25 1.25 0 0 1 4 4h2.2l1.15 1.15H12A1.25 1.25 0 0 1 13.25 6.4v4.85A1.25 1.25 0 0 1 12 12.5H4A1.25 1.25 0 0 1 2.75 11.25Z" />
    </>
  ),
  file: (
    <>
      <path d="M4.5 2.75h4.2l2.8 2.8v7.7A1.25 1.25 0 0 1 10.25 14.5h-5.5A1.25 1.25 0 0 1 3.5 13.25v-9.25A1.25 1.25 0 0 1 4.75 2.75Z" />
      <path d="M8.5 2.75v2.5a.75.75 0 0 0 .75.75h2.25" />
    </>
  ),
};

export function ReviewerIcon({ name, className = "", size = 18, strokeWidth = 1.6 }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name] || ICONS.file}
    </svg>
  );
}

export function MiveLogo({ size = 24, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M14.27 2.33a3.5 3.5 0 0 1 3.46 0l8.04 4.6A3.5 3.5 0 0 1 27.5 10v9.2a3.5 3.5 0 0 1-1.73 3.02l-8.04 4.6a3.5 3.5 0 0 1-3.46 0l-8.04-4.6A3.5 3.5 0 0 1 4.5 19.2V10a3.5 3.5 0 0 1 1.73-3.02l8.04-4.65Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="16" cy="14.6" r="2.4" fill="currentColor" />
    </svg>
  );
}

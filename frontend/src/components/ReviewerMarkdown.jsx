import ReactMarkdown from "react-markdown";

export function ReviewerMarkdown({ content, className = "", compact = false }) {
  return (
    <div className={`reviewer-markdown${compact ? " reviewer-markdown--compact" : ""}${className ? ` ${className}` : ""}`}>
      <ReactMarkdown
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          code: ({ inline, className: codeClassName, children, ...props }) => {
            if (inline) {
              return (
                <code className={`reviewer-markdown__inline-code${codeClassName ? ` ${codeClassName}` : ""}`} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <pre className="reviewer-markdown__code-block">
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

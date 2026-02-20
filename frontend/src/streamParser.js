const DOC_OPEN = "<document>";
const DOC_CLOSE = "</document>";
const MSG_OPEN = "<message>";
const MSG_CLOSE = "</message>";
const MEM_OPEN = "<memory_suggestion>";
const MEM_CLOSE = "</memory_suggestion>";

function parseMemorySuggestion(text) {
  const openIdx = text.indexOf(MEM_OPEN);
  if (openIdx === -1) return null;
  const closeIdx = text.indexOf(MEM_CLOSE, openIdx);
  if (closeIdx === -1) return null;
  const inner = text.slice(openIdx + MEM_OPEN.length, closeIdx).trim();
  const contentMatch = inner.match(/content:\s*(.+)/);
  const scopeMatch = inner.match(/scope:\s*(user|project)/);
  if (!contentMatch) return null;
  return {
    content: contentMatch[1].trim(),
    scope: scopeMatch ? scopeMatch[1] : "user",
  };
}

function stripMemoryTag(text) {
  const openIdx = text.indexOf(MEM_OPEN);
  if (openIdx === -1) return text;
  const closeIdx = text.indexOf(MEM_CLOSE);
  if (closeIdx === -1) return text.slice(0, openIdx).trimEnd();
  return (text.slice(0, openIdx) + text.slice(closeIdx + MEM_CLOSE.length)).trim();
}

export function createStreamParser() {
  let fullText = "";

  return {
    push(delta) {
      fullText += delta;
      return this.getState();
    },

    getState() {
      const docOpenIdx = fullText.indexOf(DOC_OPEN);
      const memorySuggestion = parseMemorySuggestion(fullText);

      // No <document> tag → normal chat response
      if (docOpenIdx === -1) {
        // Check if we might be mid-tag (e.g. "<doc" at the very end)
        const tail = fullText.slice(-DOC_OPEN.length);
        const possiblePartial = DOC_OPEN.startsWith(tail) && tail.length > 0 && tail.startsWith("<");
        const rawChat = possiblePartial ? fullText.slice(0, -tail.length) : fullText;
        return {
          mode: possiblePartial ? "pending" : "chat",
          chatContent: stripMemoryTag(rawChat),
          documentContent: null,
          isDocumentComplete: false,
          memorySuggestion,
        };
      }

      // We found <document>
      const docContentStart = docOpenIdx + DOC_OPEN.length;
      const docCloseIdx = fullText.indexOf(DOC_CLOSE, docContentStart);
      const isDocumentComplete = docCloseIdx !== -1;

      const documentContent = isDocumentComplete
        ? fullText.slice(docContentStart, docCloseIdx).trim()
        : fullText.slice(docContentStart).trim();

      // Extract message content if available
      let chatContent = "";
      const searchAfter = isDocumentComplete ? docCloseIdx + DOC_CLOSE.length : 0;
      const msgOpenIdx = fullText.indexOf(MSG_OPEN, searchAfter);
      if (msgOpenIdx !== -1) {
        const msgContentStart = msgOpenIdx + MSG_OPEN.length;
        const msgCloseIdx = fullText.indexOf(MSG_CLOSE, msgContentStart);
        chatContent = msgCloseIdx !== -1
          ? fullText.slice(msgContentStart, msgCloseIdx).trim()
          : fullText.slice(msgContentStart).trim();
      }

      return {
        mode: "document_edit",
        chatContent: stripMemoryTag(chatContent),
        documentContent,
        isDocumentComplete,
        memorySuggestion,
      };
    },

    reset() {
      fullText = "";
    },
  };
}

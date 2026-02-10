const DOC_OPEN = "<document>";
const DOC_CLOSE = "</document>";
const MSG_OPEN = "<message>";
const MSG_CLOSE = "</message>";

export function createStreamParser() {
  let fullText = "";

  return {
    push(delta) {
      fullText += delta;
      return this.getState();
    },

    getState() {
      const docOpenIdx = fullText.indexOf(DOC_OPEN);

      // No <document> tag → normal chat response
      if (docOpenIdx === -1) {
        // Check if we might be mid-tag (e.g. "<doc" at the very end)
        const tail = fullText.slice(-DOC_OPEN.length);
        const possiblePartial = DOC_OPEN.startsWith(tail) && tail.length > 0 && tail.startsWith("<");
        return {
          mode: possiblePartial ? "pending" : "chat",
          chatContent: possiblePartial ? fullText.slice(0, -tail.length) : fullText,
          documentContent: null,
          isDocumentComplete: false,
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
        chatContent,
        documentContent,
        isDocumentComplete,
      };
    },

    reset() {
      fullText = "";
    },
  };
}

const DOC_OPEN = "<document>";
const DOC_CLOSE = "</document>";
const MSG_OPEN = "<message>";
const MSG_CLOSE = "</message>";
const MEM_OPEN = "<memory_suggestion>";
const MEM_CLOSE = "</memory_suggestion>";
const FILE_OPEN = "<create-file";
const FILE_CLOSE = "</create-file>";
const FOLDER_OPEN = "<create-folder";
const FOLDER_CLOSE = "</create-folder>";

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

function parseFileTags(text) {
  const files = [];
  let searchFrom = 0;
  while (true) {
    const openIdx = text.indexOf(FILE_OPEN, searchFrom);
    if (openIdx === -1) break;
    const tagEnd = text.indexOf(">", openIdx + FILE_OPEN.length);
    if (tagEnd === -1) {
      // Incomplete opening tag — still streaming
      const titleMatch = text.slice(openIdx).match(/title="([^"]*)"/);
      files.push({
        title: titleMatch ? titleMatch[1] : "",
        content: "",
        complete: false,
      });
      break;
    }
    const attrs = text.slice(openIdx + FILE_OPEN.length, tagEnd);
    const titleMatch = attrs.match(/title="([^"]*)"/);
    const title = titleMatch ? titleMatch[1] : "";
    const contentStart = tagEnd + 1;
    const closeIdx = text.indexOf(FILE_CLOSE, contentStart);
    if (closeIdx === -1) {
      // Tag opened but not yet closed — still streaming
      files.push({ title, content: text.slice(contentStart).trim(), complete: false });
      break;
    }
    files.push({ title, content: text.slice(contentStart, closeIdx).trim(), complete: true });
    searchFrom = closeIdx + FILE_CLOSE.length;
  }
  return files;
}

function parseCreateBlocks(text) {
  const blocks = [];
  let searchFrom = 0;
  while (true) {
    const folderIdx = text.indexOf(FOLDER_OPEN, searchFrom);
    const fileIdx = text.indexOf(FILE_OPEN, searchFrom);

    // No more tags found
    if (folderIdx === -1 && fileIdx === -1) break;

    // Determine which comes first
    const nextIsFolder = folderIdx !== -1 && (fileIdx === -1 || folderIdx <= fileIdx);

    if (nextIsFolder) {
      const tagEnd = text.indexOf(">", folderIdx + FOLDER_OPEN.length);
      if (tagEnd === -1) {
        // Incomplete opening tag
        const titleMatch = text.slice(folderIdx).match(/title="([^"]*)"/);
        blocks.push({
          type: "folder",
          title: titleMatch ? titleMatch[1] : "",
          files: [],
          complete: false,
          start: folderIdx,
          end: text.length,
        });
        break;
      }
      const attrs = text.slice(folderIdx + FOLDER_OPEN.length, tagEnd);
      const titleMatch = attrs.match(/title="([^"]*)"/);
      const title = titleMatch ? titleMatch[1] : "";
      const contentStart = tagEnd + 1;
      const closeIdx = text.indexOf(FOLDER_CLOSE, contentStart);
      if (closeIdx === -1) {
        // Folder opened but not closed — still streaming
        const innerText = text.slice(contentStart);
        blocks.push({
          type: "folder",
          title,
          files: parseFileTags(innerText),
          complete: false,
          start: folderIdx,
          end: text.length,
        });
        break;
      }
      const innerText = text.slice(contentStart, closeIdx);
      blocks.push({
        type: "folder",
        title,
        files: parseFileTags(innerText),
        complete: true,
        start: folderIdx,
        end: closeIdx + FOLDER_CLOSE.length,
      });
      searchFrom = closeIdx + FOLDER_CLOSE.length;
    } else {
      // Standalone file (not inside a folder)
      // Check if this file tag is inside a folder block we already parsed
      const tagEnd = text.indexOf(">", fileIdx + FILE_OPEN.length);
      if (tagEnd === -1) {
        const titleMatch = text.slice(fileIdx).match(/title="([^"]*)"/);
        blocks.push({
          type: "file",
          title: titleMatch ? titleMatch[1] : "",
          folder: null,
          content: "",
          complete: false,
          start: fileIdx,
          end: text.length,
        });
        break;
      }
      const attrs = text.slice(fileIdx + FILE_OPEN.length, tagEnd);
      const titleMatch = attrs.match(/title="([^"]*)"/);
      const folderMatch = attrs.match(/folder="([^"]*)"/);
      const title = titleMatch ? titleMatch[1] : "";
      const folder = folderMatch ? folderMatch[1] : null;
      const contentStart = tagEnd + 1;
      const closeIdx = text.indexOf(FILE_CLOSE, contentStart);
      if (closeIdx === -1) {
        blocks.push({
          type: "file",
          title,
          folder,
          content: text.slice(contentStart).trim(),
          complete: false,
          start: fileIdx,
          end: text.length,
        });
        break;
      }
      blocks.push({
        type: "file",
        title,
        folder,
        content: text.slice(contentStart, closeIdx).trim(),
        complete: true,
        start: fileIdx,
        end: closeIdx + FILE_CLOSE.length,
      });
      searchFrom = closeIdx + FILE_CLOSE.length;
    }
  }
  return blocks;
}

function stripCreateBlocks(text) {
  // Remove all complete and incomplete create-folder and create-file blocks
  // Process folders first (they contain file tags), then standalone files
  let result = text;

  // Remove complete folder blocks
  while (true) {
    const folderIdx = result.indexOf(FOLDER_OPEN);
    if (folderIdx === -1) break;
    const closeIdx = result.indexOf(FOLDER_CLOSE, folderIdx);
    if (closeIdx === -1) {
      // Incomplete folder — strip from open tag to end
      result = result.slice(0, folderIdx).trimEnd();
      break;
    }
    result = result.slice(0, folderIdx) + result.slice(closeIdx + FOLDER_CLOSE.length);
  }

  // Remove complete and incomplete standalone file blocks
  while (true) {
    const fileIdx = result.indexOf(FILE_OPEN);
    if (fileIdx === -1) break;
    const closeIdx = result.indexOf(FILE_CLOSE, fileIdx);
    if (closeIdx === -1) {
      // Incomplete file — strip from open tag to end
      result = result.slice(0, fileIdx).trimEnd();
      break;
    }
    result = result.slice(0, fileIdx) + result.slice(closeIdx + FILE_CLOSE.length);
  }

  return result.trim();
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
        const createBlocks = parseCreateBlocks(rawChat);
        return {
          mode: possiblePartial ? "pending" : "chat",
          chatContent: stripMemoryTag(stripCreateBlocks(rawChat)),
          documentContent: null,
          isDocumentComplete: false,
          memorySuggestion,
          createBlocks,
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

      const createBlocks = parseCreateBlocks(chatContent);
      return {
        mode: "document_edit",
        chatContent: stripMemoryTag(stripCreateBlocks(chatContent)),
        documentContent,
        isDocumentComplete,
        memorySuggestion,
        createBlocks,
      };
    },

    reset() {
      fullText = "";
    },
  };
}

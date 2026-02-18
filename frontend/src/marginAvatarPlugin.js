import { Plugin } from "prosemirror-state";
import { $prose } from "@milkdown/kit/utils";

export function createMarginAvatarPlugin(awareness) {
  let container = null;

  return $prose(() => new Plugin({
    view(editorView) {
      container = document.createElement("div");
      container.className = "margin-avatar-container";
      editorView.dom.parentElement.style.position = "relative";
      editorView.dom.parentElement.appendChild(container);

      function updateAvatars() {
        if (!container) return;
        container.innerHTML = "";

        const states = awareness.getStates();
        const localId = awareness.clientID;

        states.forEach((state, clientId) => {
          if (clientId === localId) return;
          if (!state.user || !state.cursor) return;

          const { anchor } = state.cursor;
          if (anchor == null) return;

          try {
            const coords = editorView.coordsAtPos(anchor);
            const editorRect = editorView.dom.getBoundingClientRect();
            const top = coords.top - editorRect.top;

            const avatar = document.createElement("div");
            avatar.className = "margin-avatar";
            avatar.style.backgroundColor = state.user.color;
            avatar.style.top = `${top}px`;
            avatar.textContent = state.user.initials;
            avatar.title = state.user.name;
            container.appendChild(avatar);
          } catch {
            // Position may be invalid
          }
        });
      }

      awareness.on("change", updateAvatars);

      return {
        update: updateAvatars,
        destroy() {
          awareness.off("change", updateAvatars);
          container?.remove();
          container = null;
        },
      };
    },
  }));
}

import { useState, useEffect } from "react";

const MAX_VISIBLE = 3;

export default function PresenceIndicator({ awareness }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    function update() {
      const states = awareness.getStates();
      const localId = awareness.clientID;
      const remote = [];
      states.forEach((state, clientId) => {
        if (clientId !== localId && state.user) {
          remote.push(state.user);
        }
      });
      setUsers(remote);
    }

    awareness.on("change", update);
    update();
    return () => awareness.off("change", update);
  }, [awareness]);

  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="presence-indicator">
      {visible.map((u, i) => (
        <div
          key={i}
          className="presence-avatar"
          style={{ backgroundColor: u.color, zIndex: MAX_VISIBLE - i }}
          title={u.name}
        >
          {u.initials}
        </div>
      ))}
      {overflow > 0 && (
        <div className="presence-overflow" title={users.slice(MAX_VISIBLE).map(u => u.name).join(", ")}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

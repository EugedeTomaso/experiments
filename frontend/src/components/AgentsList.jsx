export function AgentsList({ agents, activeAgentId, onSelect, onCreate, style }) {
  return (
    <section className="panel" style={style}>
      <div className="panel-header">
        <h2>Assistants</h2>
        <button className="ghost" onClick={onCreate}>
          + New
        </button>
      </div>
      <div className="project-list">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className={`project-button ${
              activeAgentId === agent.id ? "active" : ""
            }`}
            onClick={() => onSelect(agent)}
          >
            <span className="agent-icon">&#9679;</span>
            <span>{agent.name}</span>
          </button>
        ))}
        {agents.length === 0 && (
          <div className="empty">No assistants yet.</div>
        )}
      </div>
    </section>
  );
}

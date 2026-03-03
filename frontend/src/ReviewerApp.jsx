import { useAuth } from "./AuthContext";
import "./App.css";

export function ReviewerApp() {
  const { user, logout } = useAuth();

  return (
    <div className="reviewer-app">
      <header className="reviewer-topbar">
        <div className="reviewer-brand">Mive</div>
        <span className="reviewer-badge">Reviewer</span>
        <div className="reviewer-topbar-right">
          <span>{user.name}</span>
          <button onClick={logout} className="btn-text">Log out</button>
        </div>
      </header>
      <main className="reviewer-main">
        <h2>Marketplace</h2>
        <p>Coming soon — this is the reviewer shell.</p>
      </main>
    </div>
  );
}

import { useAuth } from "./AuthContext";
import App from "./App.jsx";
import { ReviewerApp } from "./ReviewerApp.jsx";

export function AuthGate({ fallback }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Mive</div>
      </div>
    );
  }

  if (!user) return fallback;

  return user.user_type === "reviewer" ? <ReviewerApp /> : <App />;
}

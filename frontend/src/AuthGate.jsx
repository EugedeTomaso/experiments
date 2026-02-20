import { useAuth } from "./AuthContext";

export function AuthGate({ children, fallback }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Mive</div>
      </div>
    );
  }

  return user ? children : fallback;
}

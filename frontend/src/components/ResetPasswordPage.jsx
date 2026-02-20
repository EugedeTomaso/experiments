import { useCallback, useState } from "react";
import { useAuth } from "../AuthContext";

export function ResetPasswordPage({ uid, token, onNavigate }) {
  const { confirmPasswordReset } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setError("");
      if (password !== confirm) {
        setError("Passwords don't match.");
        return;
      }
      setSubmitting(true);
      try {
        await confirmPasswordReset(uid, token, password);
        // On success, user is logged in automatically via AuthContext
      } catch (err) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    },
    [confirmPasswordReset, uid, token, password, confirm]
  );

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">Mive</div>
        <h1 className="auth-heading">Set new password</h1>
        <p className="auth-subheading">Choose a new password for your account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <input
              type="password"
              className="auth-input"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
              minLength={8}
              required
            />
          </div>

          <div className="auth-field">
            <input
              type="password"
              className="auth-input"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={submitting}
          >
            {submitting ? "Resetting..." : "Reset password"}
          </button>
        </form>

        <p className="auth-footer">
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => onNavigate("login")}
          >
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  );
}

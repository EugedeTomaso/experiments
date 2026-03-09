import { useCallback, useState } from "react";
import { useAuth } from "../AuthContext";

export function ForgotPasswordPage({ onNavigate }) {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setSubmitting(true);
      await requestPasswordReset(email);
      setSent(true);
      setSubmitting(false);
    },
    [requestPasswordReset, email]
  );

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">Marvin</div>
        <h1 className="auth-heading">Reset your password</h1>
        <p className="auth-subheading">
          {sent
            ? "Check your email for a reset link"
            : "Enter your email and we'll send you a reset link"}
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <input
                type="email"
                className="auth-input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>
          </form>
        ) : (
          <div className="auth-success-msg">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="10" fill="var(--success-soft)" />
              <path d="M6 10l3 3 5-6" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span>If an account with that email exists, you'll receive a reset link shortly.</span>
          </div>
        )}

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

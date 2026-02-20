import { useCallback, useEffect, useState } from "react";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

function parseResetParams() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  const token = params.get("token");
  return uid && token ? { uid, token } : null;
}

export function AuthShell() {
  const [page, setPage] = useState(() => {
    const reset = parseResetParams();
    return reset ? "reset" : "login";
  });
  const [resetParams] = useState(parseResetParams);

  const navigate = useCallback((target) => {
    setPage(target);
    // Clean URL params when navigating away from reset
    if (target !== "reset" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const reset = parseResetParams();
      setPage(reset ? "reset" : "login");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  switch (page) {
    case "register":
      return <RegisterPage onNavigate={navigate} />;
    case "forgot":
      return <ForgotPasswordPage onNavigate={navigate} />;
    case "reset":
      return (
        <ResetPasswordPage
          uid={resetParams?.uid}
          token={resetParams?.token}
          onNavigate={navigate}
        />
      );
    default:
      return <LoginPage onNavigate={navigate} />;
  }
}

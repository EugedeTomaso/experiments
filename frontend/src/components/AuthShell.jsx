import { useCallback, useEffect, useState } from "react";
import { useNavigate as useRouterNavigate } from "react-router-dom";
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

export function AuthShell({ initialPage = "login" }) {
  const [page, setPage] = useState(() => {
    const reset = parseResetParams();
    return reset ? "reset" : initialPage;
  });
  const [resetParams] = useState(parseResetParams);
  const routerNavigate = useRouterNavigate();

  const navigate = useCallback((target) => {
    const routerPages = { login: "/login", register: "/register", forgot: "/forgot", reset: "/reset" };
    if (routerPages[target]) {
      routerNavigate(routerPages[target]);
    }
    setPage(target);
    if (target !== "reset" && window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [routerNavigate]);

  // Handle browser back/forward
  useEffect(() => {
    const handler = () => {
      const reset = parseResetParams();
      setPage(reset ? "reset" : initialPage);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [initialPage]);

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

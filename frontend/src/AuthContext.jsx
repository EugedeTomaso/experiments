import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const AuthContext = createContext(null);

function getStoredTokens() {
  try {
    const access = localStorage.getItem("mive:access_token");
    const refresh = localStorage.getItem("mive:refresh_token");
    return access && refresh ? { access, refresh } : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens) {
  localStorage.setItem("mive:access_token", tokens.access);
  localStorage.setItem("mive:refresh_token", tokens.refresh);
}

function clearTokens() {
  localStorage.removeItem("mive:access_token");
  localStorage.removeItem("mive:refresh_token");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (accessToken) => {
    const res = await fetch(`${API_BASE}/api/auth/me/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Unauthorized");
    return res.json();
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens?.refresh) throw new Error("No refresh token");
    const res = await fetch(`${API_BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = await res.json();
    const newTokens = {
      access: data.access,
      refresh: data.refresh || tokens.refresh,
    };
    storeTokens(newTokens);
    return newTokens.access;
  }, []);

  // Check stored tokens on mount
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const tokens = getStoredTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }
      try {
        const me = await fetchMe(tokens.access);
        if (!cancelled) setUser(me);
      } catch {
        // Access token expired, try refresh
        try {
          const newAccess = await refreshAccessToken();
          const me = await fetchMe(newAccess);
          if (!cancelled) setUser(me);
        } catch {
          clearTokens();
        }
      }
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [fetchMe, refreshAccessToken]);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API_BASE}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    storeTokens(data.tokens);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (name, email, password, userType = "writer", bio = "", specialties = []) => {
    const res = await fetch(`${API_BASE}/api/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, user_type: userType, bio, specialties }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = data.email?.[0] || data.password?.[0] || data.detail || "Registration failed";
      throw new Error(msg);
    }
    storeTokens(data.tokens);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    const res = await fetch(`${API_BASE}/api/auth/password-reset/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.json();
  }, []);

  const confirmPasswordReset = useCallback(async (uid, token, newPassword) => {
    const res = await fetch(`${API_BASE}/api/auth/password-reset/confirm/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, token, new_password: newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Reset failed");
    storeTokens(data.tokens);
    setUser(data.user);
    return data;
  }, []);

  const getAccessToken = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens) return null;
    try {
      await fetchMe(tokens.access);
      return tokens.access;
    } catch {
      try {
        return await refreshAccessToken();
      } catch {
        clearTokens();
        setUser(null);
        return null;
      }
    }
  }, [fetchMe, refreshAccessToken]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

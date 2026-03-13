import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import './auth.css'
import './landing.css'
import App from './App.jsx'
import { AuthProvider, useAuth } from './AuthContext.jsx'
import { AuthShell } from './components/AuthShell.jsx'
import { LandingPage } from './pages/LandingPage.jsx'
import { ReviewerApp } from './ReviewerApp.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Marvin</div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AuthRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-brand" style={{ opacity: 0.4 }}>Marvin</div>
      </div>
    )
  }
  return user ? <Navigate to="/app" replace /> : children
}

function AppShell() {
  const { user } = useAuth()
  return user?.user_type === "reviewer" ? <ReviewerApp /> : <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthRoute><AuthShell initialPage="login" /></AuthRoute>} />
            <Route path="/register" element={<AuthRoute><AuthShell initialPage="register" /></AuthRoute>} />
            <Route path="/forgot" element={<AuthRoute><AuthShell initialPage="forgot" /></AuthRoute>} />
            <Route path="/reset" element={<AuthRoute><AuthShell initialPage="reset" /></AuthRoute>} />
            <Route path="/app/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

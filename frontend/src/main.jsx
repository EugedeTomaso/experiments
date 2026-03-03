import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './auth.css'
import { AuthProvider } from './AuthContext.jsx'
import { AuthShell } from './components/AuthShell.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate fallback={<AuthShell />} />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)

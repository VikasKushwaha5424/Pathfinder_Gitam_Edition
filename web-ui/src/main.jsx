import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { GeolocationProvider } from './hooks/useGeolocation'

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:20px;font-family:sans-serif">App failed to mount: #root element not found.</div>';
} else {
createRoot(rootEl).render(
  <GeolocationProvider>
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  </GeolocationProvider>,
  )
}

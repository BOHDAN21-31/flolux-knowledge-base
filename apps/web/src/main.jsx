import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)

// PWA: реєструємо service worker (тільки на HTTPS або localhost)
if ('serviceWorker' in navigator) {
  const isSecure = window.location.protocol === 'https:'
    || ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isSecure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] реєстрація не вдалась:', err.message);
      });
    });
  }
}

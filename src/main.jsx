import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Apply saved typography & zoom settings immediately on app boot
try {
  const saved = localStorage.getItem('tradeontip_settings');
  if (saved) {
    const s = JSON.parse(saved);
    if (s.fontFamily) {
      let family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      if (s.fontFamily === 'soft') family = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      else if (s.fontFamily === 'modern') family = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      else if (s.fontFamily === 'classic') family = "'Lora', Georgia, serif";
      document.documentElement.style.setProperty('--font-family', family);
      document.body.style.fontFamily = family;
    }
    if (s.fontWeight) {
      document.body.style.fontWeight = s.fontWeight === 'light' ? '300' : s.fontWeight === 'medium' ? '500' : '400';
    }
    const scale = parseInt(s.scale || s.fontSize, 10);
    if (!isNaN(scale) && scale >= 50 && scale <= 150) {
      document.body.style.zoom = String(scale / 100);
    }
  }
} catch {
  // Ignore parsing errors on startup
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

import React from 'react';
import ReactDOM from 'react-dom/client';
import ReferenceApp from './ReferenceApp';
import './styles.css';
import './hardening.css';
import './reference-ui.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ReferenceApp /></React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' });
      registration.update().catch(() => undefined);
    } catch {
      // L'application reste entièrement utilisable sans service worker.
    }
  });
}

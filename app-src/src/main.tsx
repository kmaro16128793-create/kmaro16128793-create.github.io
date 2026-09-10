import React from 'react';
import ReactDOM from 'react-dom/client';
import VideoExactApp from './VideoExactApp';
import SafetyBoundary from './SafetyBoundary';
import DeliveryExperience from './DeliveryExperience';
import AudioGoldMasterExperience from './AudioGoldMasterExperience';
import './styles.css';
import './hardening.css';
import './video-exact.css';
import './delivery-experience.css';
import './audio-gold-master.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SafetyBoundary>
      <AudioGoldMasterExperience>
        <DeliveryExperience>
          <VideoExactApp />
        </DeliveryExperience>
      </AudioGoldMasterExperience>
    </SafetyBoundary>
  </React.StrictMode>
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

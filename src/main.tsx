import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Async unregister old service workers and clear cache to force update
const cleanupServiceWorkersAndCaches = async () => {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const success = await registration.unregister();
        if (success) {
          console.log('[SW] Cleaned up legacy service worker:', registration);
        }
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      if (keys.length > 0) {
        console.log('[Cache] Cleared legacy cache storages:', keys);
      }
    }
  } catch (error) {
    console.warn('[Cleanup] Failed to unregister service workers or clear cache:', error);
  }
};

cleanupServiceWorkersAndCaches();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

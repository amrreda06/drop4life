import { useEffect, useMemo, useState } from 'react';
import { shellText } from './locale.js';

function LoadingSpinner() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ marginBottom: '1rem', fontSize: '1.15rem' }}>{shellText('loadingApp')}</div>
        <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid rgba(226, 232, 240, 0.35)', borderRadius: '50%', borderTopColor: '#e2e8f0', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function LegacyDrop4Life() {
  const [appReady, setAppReady] = useState(false);
  const appUrl = useMemo(() => `${import.meta.env.BASE_URL}app.html`, []);

  useEffect(() => {
    function onMessage(event) {
      if (event?.data?.type === 'drop4life:ready') {
        setAppReady(true);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      {!appReady && <LoadingSpinner />}
      <iframe
        title="Drop4Life"
        src={appUrl}
        onLoad={() => {
          window.setTimeout(() => setAppReady((ready) => ready || true), 4000);
        }}
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
          display: 'block',
          visibility: appReady ? 'visible' : 'hidden',
        }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LegacyDrop4Life from './LegacyDrop4Life.jsx';

function LoadingScreen() {
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
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem' }}>جاري التحقق من الجلسة...</div>
        <div
          style={{
            display: 'inline-block',
            width: '48px',
            height: '48px',
            border: '4px solid rgba(226, 232, 240, 0.35)',
            borderRadius: '50%',
            borderTopColor: '#e2e8f0',
            animation: 'spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

function AppShell() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepareAuth() {
      const api = window.Drop4LifeAPI;
      if (api && typeof api.waitForAuthInit === 'function') {
        await api.waitForAuthInit();
      }
      if (!cancelled) {
        setAuthReady(true);
      }
    }

    void prepareAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!authReady) {
    return <LoadingScreen />;
  }

  return <LegacyDrop4Life />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard/*" element={<AppShell />} />
        <Route path="/app/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="/profile/*" element={<AppShell />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

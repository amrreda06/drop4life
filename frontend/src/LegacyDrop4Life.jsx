import { useMemo } from 'react';

export default function LegacyDrop4Life() {
  const appUrl = useMemo(() => `${import.meta.env.BASE_URL}app.html`, []);

  return (
    <iframe
      title="Drop4Life"
      src={appUrl}
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
        display: 'block',
      }}
    />
  );
}

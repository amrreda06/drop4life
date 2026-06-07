import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LegacyDrop4Life from './LegacyDrop4Life.jsx';

const API_TEST_URL = 'http://127.0.0.1:8000/api/test/';

export default function App() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(API_TEST_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        return response.json();
      })
      .then((data) => setMessage(data.message || ''))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <>
      <h1>{error || message || 'Loading...'}</h1>
      <Routes>
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="/app/*" element={<LegacyDrop4Life />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </>
  );
}

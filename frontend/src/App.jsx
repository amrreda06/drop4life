import { Navigate, Route, Routes } from 'react-router-dom';
import LegacyDrop4Life from './LegacyDrop4Life.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/app/*" element={<LegacyDrop4Life />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import App from './App';
import { registerOfflineSupport } from './lib/offline';
import { startTelemetry } from './lib/telemetry';

registerOfflineSupport();
startTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

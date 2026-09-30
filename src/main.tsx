import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initialLang, loadLang } from './i18n';
import './index.css';

// Fetch the starting language's strings first so the app doesn't flash in English.
loadLang(initialLang)
  .catch(() => undefined)
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );

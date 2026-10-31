import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/tokens.css';
import '../ui/global.css';
import { App } from './App';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('В index.html нет элемента #root — приложению некуда смонтироваться');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

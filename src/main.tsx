import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from '../AppWithShopping';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Mount shared family shopping navigation alongside the existing app.

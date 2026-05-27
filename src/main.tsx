import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
if (import.meta.hot) {
  import.meta.hot.on('vite:ws:disconnect', () => {
    // suppress reconnect-triggered full reloads on tab switch
  })
}
createRoot(document.getElementById("root")!).render(<App />);

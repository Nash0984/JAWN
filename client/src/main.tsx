import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SentryErrorBoundary } from "./lib/sentryClient";
import App from "./App";
import "./index.css";

// Remove loading class to reveal content after React mounts (FOUC prevention)
const revealContent = () => {
  document.body.classList.remove('loading');
  document.body.classList.add('loaded');
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SentryErrorBoundary>
      <App />
    </SentryErrorBoundary>
  </StrictMode>
);

// Reveal content after React has rendered
revealContent();

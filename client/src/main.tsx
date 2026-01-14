import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SentryErrorBoundary } from "./lib/sentryClient";
import App from "./App";
import "./index.css";

// Hide initial loader after React mounts
const hideLoader = () => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.classList.add('hidden');
    // Remove from DOM after fade-out transition
    setTimeout(() => loader.remove(), 300);
  }
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SentryErrorBoundary>
      <App />
    </SentryErrorBoundary>
  </StrictMode>
);

// Hide loader after React has rendered
hideLoader();

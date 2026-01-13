import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SentryErrorBoundary } from "./lib/sentryClient";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SentryErrorBoundary>
      <App />
    </SentryErrorBoundary>
  </StrictMode>
);

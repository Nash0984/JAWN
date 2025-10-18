// ============================================================================
// SENTRY INITIALIZATION - Must be first to capture all errors
// ============================================================================
import { SentryErrorBoundary } from "./lib/sentryClient";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config";

createRoot(document.getElementById("root")!).render(
  <SentryErrorBoundary>
    <App />
  </SentryErrorBoundary>
);

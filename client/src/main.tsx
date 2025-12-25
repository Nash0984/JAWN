// ============================================================================
// REACT MUST BE IMPORTED FIRST - Required for hooks to work correctly
// ============================================================================
import * as React from "react";
import { createRoot } from "react-dom/client";

// ============================================================================
// SENTRY INITIALIZATION - Must be after React to use hooks properly
// ============================================================================
import { SentryErrorBoundary } from "./lib/sentryClient";

import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <SentryErrorBoundary>
    <App />
  </SentryErrorBoundary>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReminders } from "./reminders";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyTheme } from "./screens/Profil";
import { getPrefs } from "./store";
import { finishGoogle, startSync } from "./sync";
import { listenForErrors, reportError, startTelemetry } from "./telemetry";
import "./styles.css";

void startTelemetry();
const stopErrorLogging = listenForErrors();
import.meta.hot?.dispose(stopErrorLogging);

applyTheme(getPrefs().theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(getPrefs().theme));
startSync();
const stopReminders = startReminders();
import.meta.hot?.dispose(stopReminders);
void finishGoogle(); // back from Google: session cookie → bearer → /me → /sync, like email Masuk

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => { console.error(error); reportError(error, "react"); },
  onCaughtError: (error) => { console.error(error); reportError(error, "react"); },
}).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

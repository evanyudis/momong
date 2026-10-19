import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installPress } from "./press";
import { startReminders } from "./reminders";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { applyTheme } from "./screens/Profil";
import { getPrefs } from "./store";
import { authIsPending, finishGoogle, onControllerChange, resumeAuthAttempt, startSync, whenAuthSettles } from "./sync";
import { listenForErrors, reportError, startTelemetry } from "./telemetry";
import "./styles.css";

void startTelemetry();
const stopErrorLogging = listenForErrors();
import.meta.hot?.dispose(stopErrorLogging);

applyTheme(getPrefs().theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(getPrefs().theme));
startSync();
const stopPress = installPress();
import.meta.hot?.dispose(stopPress);
const stopReminders = startReminders();
import.meta.hot?.dispose(stopReminders);
void finishGoogle().finally(() => { void resumeAuthAttempt(); }); // back from Google, or a sign-up interrupted by a reload

createRoot(document.getElementById("root")!, {
  onUncaughtError: (error) => { console.error(error); reportError(error, "react"); },
  onCaughtError: (error) => { console.error(error); reportError(error, "react"); },
}).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // A page already running an older bundle reloads once the new worker claims it.
    // After a wipe the cache install can claim mid sign-up and drop the response, so wait until the chain finishes.
    if (navigator.serviceWorker.controller) {
      let reloading = false;
      let defer = false;
      const claim = () => {
        if (reloading) return;
        if (onControllerChange() === "defer" || authIsPending()) { defer = true; return; }
        reloading = true;
        location.reload();
      };
      whenAuthSettles(() => { if (defer) claim(); });
      navigator.serviceWorker.addEventListener("controllerchange", claim);
    }
    void navigator.serviceWorker.register("/sw.js").then((reg) => reg.update()).catch(() => {});
  });
}

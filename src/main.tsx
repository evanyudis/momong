import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startReminders } from "./reminders";
import { App } from "./App";
import { applyTheme } from "./screens/Profil";
import { getPrefs } from "./store";
import { finishGoogle, startSync } from "./sync";
import "./styles.css";

applyTheme(getPrefs().theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(getPrefs().theme));
startSync();
startReminders();
void finishGoogle(); // back from Google: session cookie → bearer → /me → /sync, like email Masuk

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

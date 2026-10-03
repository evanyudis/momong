import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme } from "./screens/Settings";
import { getPrefs } from "./store";
import { startSync } from "./sync";
import "./styles.css";

applyTheme(getPrefs().theme);
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(getPrefs().theme));
startSync();

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js"));
}

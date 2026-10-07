// Disposable preview fixture: storage is in memory, API is mocked, names are generic.
import { createRoot } from "react-dom/client";
import "../src/styles.css";
const params = new URLSearchParams(location.search);
const memory = new Map<string, string>();
const storage = { get length() { return memory.size; }, key: (i: number) => [...memory.keys()][i] ?? null, getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) };
Object.defineProperty(window, "localStorage", { value: storage });
Object.defineProperty(window, "sessionStorage", { value: storage });
window.fetch = async () => Response.json({ error: "preview_only" }, { status: 404 });
const store = await import("../src/store");
const pregnant = params.get("mode") === "pregnant";
store.setPrefs({ guest: true, name: "Bunda", theme: params.get("theme") === "dark" ? "dark" : "light" });
store.saveSettings(pregnant ? { birthMode: "pregnant", hpl: "2026-11-12" } : { birthMode: "postpartum", babyName: "Si kecil", babyBirth: "2026-10-01" });
const { applyTheme } = await import("../src/screens/Profil");
applyTheme(store.getPrefs().theme);
const { App } = await import("../src/App");
createRoot(document.getElementById("root")!).render(<App />);

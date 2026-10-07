// Open /scripts/refinement-check.html on the Vite dev server. Isolated storage and mocked API; no real account or records touched.
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "../src/ErrorBoundary";
import "../src/styles.css";

const memory = new Map<string, string>();
let storageFails = false;
const storage = { get length() { return memory.size; }, key: (i: number) => [...memory.keys()][i] ?? null,
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { if (storageFails) throw new Error("quota"); memory.set(key, value); },
  removeItem: (key: string) => memory.delete(key) };
Object.defineProperty(window, "localStorage", { value: storage });
Object.defineProperty(window, "sessionStorage", { value: storage });
let inviteCalls = 0;
window.fetch = async () => {
  inviteCalls++;
  return inviteCalls === 1 ? Response.json({ error: "unavailable" }, { status: 503 }) : Response.json({ url: "https://example.invalid/invite" });
};
const output = document.querySelector("#results")!;
const { DeleteButton, Sheet, Toaster, toast } = await import("../src/ui");
const store = await import("../src/store");
const { Log } = await import("../src/screens/Log");
const { Partner } = await import("../src/screens/Partner");
const sync = await import("../src/sync");
const { App } = await import("../src/App");
const host = document.querySelector("#root")!;
let root = createRoot(host);
const pause = () => new Promise(resolve => setTimeout(resolve, 350));
const assert = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === text)!;
const click = async (el: HTMLElement | null) => { assert(el, "control exists"); el!.focus(); el!.click(); await pause(); };
async function mount(node: React.ReactNode) { root.unmount(); root = createRoot(host); root.render(node); await pause(); }
const results: string[] = [];
async function check(name: string, run: () => Promise<void>) { await run(); results.push(`PASS ${name}`); output.textContent = results.join("\n"); }

try {
  store.setPrefs({ guest: true, name: "Bunda" });
  store.saveSettings({ birthMode: "postpartum", babyName: "Si kecil", babyBirth: "2026-10-01" });
  await check("delete cancellation, failed persistence, retry and live region", async () => {
    const record = store.put("wishlist", { label: "Test item", at: Date.now() });
    await mount(<><DeleteButton label="Test item" onDelete={() => store.remove("wishlist", record.id)} /><Toaster /></>);
    assert(document.querySelector('[role="status"]'), "live region exists before toast");
    await click(document.querySelector('[aria-label="Hapus Test item"]'));
    assert(store.get("wishlist", record.id), "opening confirmation does not delete");
    assert(document.activeElement === button("Batal"), "safe action receives focus");
    await click(button("Batal"));
    assert(store.get("wishlist", record.id), "cancel preserves record");
    await click(document.querySelector('[aria-label="Hapus Test item"]'));
    storageFails = true;
    await click(button("Ya, hapus"));
    storageFails = false;
    assert(store.get("wishlist", record.id), "quota failure preserves record");
    assert(document.querySelector('[role="alert"]')?.textContent?.includes("Belum bisa menghapus"), "failure is announced inline");
    await click(button("Ya, hapus"));
    assert(!store.get("wishlist", record.id), "retry deletes once");
    assert(document.querySelector('[role="status"]')?.textContent?.includes("Test item dihapus"), "success updates persistent region");
  });
  await check("filtered empty history resets to existing records", async () => {
    store.put("bottle", { at: Date.now(), ml: 90, milk: "formula" });
    await mount(<Log />);
    const select = document.querySelector<HTMLSelectElement>("select")!;
    select.value = "diaper"; select.dispatchEvent(new Event("change", { bubbles: true })); await pause();
    assert(host.textContent?.includes("Tidak ada catatan yang cocok"), "filtered empty differs from first run");
    await click(button("Reset filter"));
    assert(host.textContent?.includes("90 ml"), "reset reveals retained bottle record");
  });
  await check("nested confirmations isolate focus and Escape leaves the parent open", async () => {
    await mount(<Sheet open onOpenChange={() => {}} title="Riwayat"><DeleteButton label="Kontraksi" onDelete={() => {}} /></Sheet>);
    await click(document.querySelector('[aria-label="Hapus Kontraksi"]'));
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')];
    assert(dialogs.length === 2 && dialogs[0].inert && !dialogs[1].inert, "only top dialog remains interactive");
    assert(document.activeElement === button("Batal"), "nested safe action receives focus");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await pause();
    assert(document.querySelectorAll('[role="dialog"]').length === 1, "Escape closes only the confirmation");
    assert(!document.querySelector<HTMLElement>('[role="dialog"]')!.inert, "parent is interactive again");
    assert(document.activeElement?.getAttribute("aria-label") === "Hapus Kontraksi", "focus returns to parent trigger");
  });
  await check("long toasts wrap and hidden tabs preserve feedback", async () => {
    await mount(<Toaster />);
    toast("x".repeat(120)); await pause();
    const box = document.querySelector('.toast')!.getBoundingClientRect();
    assert(box.left >= 0 && box.right <= innerWidth, "long toast fits viewport");
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    hidden = true; document.dispatchEvent(new Event("visibilitychange"));
    await new Promise(resolve => setTimeout(resolve, 3200));
    assert(document.querySelector('[role="status"]')?.textContent, "hidden toast does not expire");
    hidden = false; document.dispatchEvent(new Event("visibilitychange"));
    await new Promise(resolve => setTimeout(resolve, 3200));
    assert(!document.querySelector('[role="status"]')?.textContent, "visible toast expires normally");
    delete (document as any).hidden;
  });
  await check("invite failure is visible and retry enables sharing", async () => {
    assert(sync.HAS_API, "start Vite with VITE_API_URL=http://localhost:15174 for mocked API test");
    Object.assign(sync.account(), { token: "test-only", syncEnabled: true, me: { user: { id: "owner", email: "owner@example.invalid", name: "Bunda" }, entitlement: { plan: "free", expiresAt: null }, household: { id: "test", seats: 2, members: [{ id: "owner", role: "owner", name: "Bunda", email: "owner@example.invalid" }] } } });
    await mount(<Partner />);
    assert(host.querySelector('[role="alert"]')?.textContent?.includes("undangan"), "failed invite is announced");
    await click(button("Coba lagi"));
    assert(inviteCalls === 2, "one retry creates one request");
    assert(!button("Bagikan tautan").disabled, "sharing enabled after success");
  });
  await check("render exception shows recovery and keeps stored records", async () => {
    const Broken = () => { throw new Error("test render failure"); };
    await mount(<ErrorBoundary><Broken /></ErrorBoundary>);
    assert(host.querySelector('[role="alert"]'), "error boundary catches actual render throw");
    assert(button("Muat ulang"), "reload recovery offered");
    assert(store.list("bottle").length === 1, "records preserved");
  });
  Object.assign(sync.account(), { token: null, me: null });
  await mount(<App />);
  output.textContent = results.join("\n") + "\nALL CHECKS PASSED. Preview uses isolated sample storage and mocked API.";
} catch (error) { output.textContent = results.join("\n") + "\nFAIL " + String(error); console.error(error); }

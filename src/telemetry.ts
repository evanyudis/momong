import type { PostHog } from "posthog-js";

const CONSENT = "momong_telemetry_consent";
const routes = new Set(["setup", "/", "/log", "/insight", "/profil", "/pasangan", "/plus", "/masuk-akun", "/masuk", "/gabung", "/kado-bersama", "/tas", "/pengingat", "/laporan", "/kado"]);
export const safeScreen = (path: string) => routes.has(path) ? path : "other";
export const telemetryConfigured = () => import.meta.env?.VITE_POSTHOG_ENABLED === "true" && !!import.meta.env?.VITE_POSTHOG_KEY;
export function telemetryConsent() {
  try { return localStorage.getItem(CONSENT) === "true"; } catch { return false; }
}
let client: PostHog | undefined;
let loading: Promise<void> | undefined;
let screen = "";
let previousScreen = "";

// Only explicit technical/product fields survive, including SDK-generated properties.
export function sanitizeTelemetry<T extends { event: string; properties: Record<string, any> }>(event: T | null): T | null {
  if (!event) return null;
  if (!["screen_viewed", "$exception"].includes(event.event)) return null;
  const p = event.properties;
  const properties: Record<string, any> = {
    distinct_id: p.distinct_id,
    $session_id: p.$session_id,
    $process_person_profile: false,
    screen: safeScreen(p.screen),
    app: "momong-web",
  };
  if (event.event === "$exception") {
    properties.source = ["react", "unhandled", "rejection", "api"].includes(p.source) ? p.source : "unhandled";
    properties.$exception_list = (Array.isArray(p.$exception_list) ? p.$exception_list : []).map((exception: any) => ({
      type: ["Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError"].includes(exception.type) ? exception.type : "Error",
      value: "Technical error (details redacted)",
      stacktrace: { frames: (exception.stacktrace?.frames ?? []).map((frame: any) => ({
        filename: typeof frame.filename === "string" ? frame.filename.match(/\/assets\/[a-zA-Z0-9_.-]+\.js/)?.[0] ?? "redacted" : "redacted",
        lineno: typeof frame.lineno === "number" ? frame.lineno : undefined,
        colno: typeof frame.colno === "number" ? frame.colno : undefined,
      })) },
    }));
  }
  return { ...event, properties };
}

export function startTelemetry(): Promise<void> {
  if (!telemetryConfigured() || !telemetryConsent()) return Promise.resolve();
  if (client) return Promise.resolve();
  if (loading) return loading;
  loading = import("posthog-js").then(({ default: posthog }) => {
    if (!telemetryConsent()) return;
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      autocapture: false, capture_pageview: false, capture_pageleave: false,
      capture_exceptions: false,
      disable_session_recording: true, disable_surveys: true,
      advanced_disable_flags: true, person_profiles: "never",
      persistence: "memory", ip: false,
      before_send: sanitizeTelemetry,
    });
    posthog.opt_in_capturing();
    client = posthog;
    previousScreen = "";
    if (screen) trackScreen(screen);
  }).catch(() => { /* Telemetry failure must not interrupt logging or sync. */ }).finally(() => { loading = undefined; });
  return loading;
}

export function setTelemetryConsent(enabled: boolean) {
  try { localStorage.setItem(CONSENT, String(enabled)); } catch { return; }
  if (enabled) void startTelemetry();
  else { client?.opt_out_capturing(); client = undefined; previousScreen = ""; }
}
export function trackScreen(path: string) {
  screen = safeScreen(path);
  if (!client || !telemetryConsent() || previousScreen === screen) return;
  previousScreen = screen;
  client.capture("screen_viewed", { screen });
}
export function reportError(error: unknown, source: "react" | "unhandled" | "rejection" | "api") {
  if (!client || !telemetryConsent()) return;
  try { client.captureException(error instanceof Error ? error : new Error("Non-Error rejection"), { source, screen }); } catch { /* Best effort only. */ }
}
export function listenForErrors() {
  const error = (event: ErrorEvent) => reportError(event.error ?? new Error("Unhandled error"), "unhandled");
  const rejection = (event: PromiseRejectionEvent) => reportError(event.reason, "rejection");
  window.addEventListener("error", error);
  window.addEventListener("unhandledrejection", rejection);
  return () => { window.removeEventListener("error", error); window.removeEventListener("unhandledrejection", rejection); };
}

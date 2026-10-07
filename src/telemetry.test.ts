import assert from "node:assert/strict";
import { test } from "node:test";
import { safeScreen, sanitizeTelemetry } from "./telemetry";

test("telemetry drops secrets, medical data, URL tokens, breadcrumbs and unknown events", () => {
  assert.equal(safeScreen("/gabung?invite=secret"), "other");
  assert.equal(sanitizeTelemetry(null), null);
  assert.equal(sanitizeTelemetry({ event: "$autocapture", properties: {} }), null);
  const result = sanitizeTelemetry({ event: "$exception", properties: {
    distinct_id: "random-id", screen: "/profil", source: "react",
    email: "private@example.com", notes: "medical record", $current_url: "https://site/?token=secret",
    $exception_steps: [{ message: "secret" }],
    $exception_list: [{ type: "TypeError", value: "private@example.com", stacktrace: { frames: [{
      filename: "https://site/assets/index-abc.js?token=secret", lineno: 10, colno: 5, function: "private", context_line: "secret",
    }] } }],
  } });
  const json = JSON.stringify(result);
  for (const secret of ["private", "medical", "secret", "$current_url", "$exception_steps", "context_line"]) assert.ok(!json.includes(secret), secret);
  assert.equal(result?.properties.$exception_list[0].stacktrace.frames[0].filename, "/assets/index-abc.js");
  assert.equal(result?.properties.$exception_list[0].stacktrace.frames[0].lineno, 10);
  assert.equal(result?.properties.$process_person_profile, false);
});


test("no SDK initialization without consent; revoke stops events and opt back in resumes", async () => {
  const { createServer } = await import("vite");
  const memory = new Map<string, string>();
  Object.assign(globalThis, { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    ssr: { noExternal: ["posthog-js"] },
    define: { "import.meta.env.VITE_POSTHOG_ENABLED": '"true"', "import.meta.env.VITE_POSTHOG_KEY": '"phc_test"' },
    plugins: [{ name: "telemetry-test-sdk", enforce: "pre",
      resolveId(id) { if (id === "posthog-js") return "\0telemetry-test-sdk"; },
      load(id) { if (id === "\0telemetry-test-sdk") return `
        export const calls = []; let config;
        export default {
          init(key, options) { config = options; calls.push(["init", options]); },
          opt_in_capturing() { calls.push(["in"]); },
          opt_out_capturing() { calls.push(["out"]); },
          capture(event, properties) { calls.push(["event", config.before_send({ event, properties })]); },
          captureException() { calls.push(["error"]); },
        };`; },
    }],
  });
  try {
    const telemetry = await server.ssrLoadModule("/src/telemetry.ts");
    const sdk = await server.ssrLoadModule("\0telemetry-test-sdk");
    await telemetry.startTelemetry();
    telemetry.trackScreen("/profil");
    assert.equal(sdk.calls.length, 0);
    telemetry.setTelemetryConsent(true);
    await telemetry.startTelemetry();
    const options = sdk.calls.find((c: any[]) => c[0] === "init")[1];
    assert.equal(options.autocapture, false);
    assert.equal(options.disable_session_recording, true);
    assert.equal(options.person_profiles, "never");
    assert.equal(options.capture_exceptions, false);
    assert.equal(sdk.calls.filter((c: any[]) => c[0] === "event").length, 1);
    telemetry.trackScreen("/profil");
    assert.equal(sdk.calls.filter((c: any[]) => c[0] === "event").length, 1);
    telemetry.setTelemetryConsent(false);
    const count = sdk.calls.length;
    telemetry.trackScreen("/log"); telemetry.reportError(new Error("secret"), "react");
    assert.equal(sdk.calls.length, count);
    telemetry.setTelemetryConsent(true);
    await telemetry.startTelemetry();
    assert.equal(sdk.calls.filter((c: any[]) => c[0] === "event").length, 2);
  } finally { await server.close(); }
});

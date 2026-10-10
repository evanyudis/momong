import test from "node:test";
import assert from "node:assert/strict";
import { toast as notify } from "sonner";
import { toast } from "./toast.ts";

test("toasts retain consecutive messages and allow more time for errors and long reminders", () => {
  const saved = toast("Catatan tersimpan");
  const failed = toast("Catatan belum tersimpan. Coba lagi.", "error");
  const reminder = toast(Array(30).fill("pengingat").join(" "), "info");
  const messages = notify.getToasts();
  assert.equal(messages.find((t) => t.id === saved)?.type, "success");
  assert.equal(messages.find((t) => t.id === failed)?.type, "error");
  assert.equal(messages.find((t) => t.id === failed)?.duration, 8000);
  assert.equal(messages.find((t) => t.id === reminder)?.type, "info");
  assert.equal(messages.find((t) => t.id === reminder)?.duration, 10500);
  notify.dismiss();
});

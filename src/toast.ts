import { toast as notify } from "sonner";

export function toast(message: string, kind: "success" | "error" | "info" = "success") {
  return notify[kind](message, {
    duration: Math.max(kind === "error" ? 8000 : 5000, message.split(/\s+/).length * 350),
  });
}

import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

// shadcn Input on the app's .input (17px text: no iOS zoom; aria-invalid draws the field-danger edge).
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={cn("input", className)} {...props} />;
}

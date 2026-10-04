import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

// shadcn Button, styled by the app's own .btn rules (press: scale 0.96 / 150ms) instead of Tailwind.
// Variants: default (sign-in blue), outline (glass surface), link. Nothing else exists.
const variants = {
  default: "btn btn-signin",
  outline: "btn btn-ghost",
  link: "link-btn",
} as const;

export function Button({ className, variant = "default", type = "button", ...props }: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button data-slot="button" type={type} className={cn(variants[variant], className)} {...props} />;
}

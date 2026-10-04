import type { ComponentProps } from "react";

// shadcn Label as a native <label>; htmlFor focuses its input, so no Radix primitive is needed.
export function Label(props: ComponentProps<"label">) {
  return <label data-slot="label" {...props} />;
}

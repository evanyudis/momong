import { Glass } from "glisse";

/** Glisse owns the material; the host retains its semantics, focus and hit area. */
export function GlassSurface() {
  return <Glass className="glass-material" aria-hidden="true" />;
}

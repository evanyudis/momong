import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const MeshGradient = lazy(() => import("@paper-design/shaders-react").then((module) => ({ default: module.MeshGradient })));
const COLORS = ["#a24d59", "#e8a0a8", "#401b25", "#f2bfc5"];

class MeshFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Decorative only; Paper handles sizing and pauses offscreen/hidden-tab rendering. */
export function PlusMesh() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return <div className="plus-mesh" aria-hidden="true">
    {!reduced && <MeshFallback><Suspense fallback={null}>
      <MeshGradient colors={COLORS} speed={0.95} distortion={1} swirl={0.57}
        grainMixer={0} grainOverlay={0} minPixelRatio={1} maxPixelCount={180000}
        style={{ width: "100%", height: "100%" }} />
    </Suspense></MeshFallback>}
  </div>;
}

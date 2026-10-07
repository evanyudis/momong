import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { document.title = "Halaman belum bisa ditampilkan · Momong"; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app"><section className="card solid stack" role="alert">
      <h1>Halaman belum bisa ditampilkan</h1>
      <p className="muted">Muat ulang untuk mencoba lagi. Catatan di perangkat ini tetap tersimpan.</p>
      <button className="btn btn-ink block" onClick={() => location.reload()}>Muat ulang</button>
    </section></main>;
  }
}

import { type FormEvent, useReducer } from "react";
import { SIGNIN_EMPTY, signIn } from "../signin";
import { TopBar } from "../ui";

/** Masuk / Daftar from Profil, signed out only. UI only: no network, no session, no account. Leaving keeps local data. */
export function SignIn() {
  const [s, dispatch] = useReducer(signIn, SIGNIN_EMPTY);
  const daftar = s.mode === "daftar";

  function submit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "submit" });
  }

  return (
    <>
      <TopBar title={daftar ? "Daftar" : "Masuk"} back="#/profil" />
      <div className="stack">
        <p className="muted" style={{ textAlign: "center" }}>Supaya data tersimpan online. Sync dan pasangan tetap gratis.</p>
        <form className="card stack" onSubmit={submit} noValidate>
          <button type="button" className="btn btn-ghost block" onClick={() => dispatch({ type: "google" })}>Lanjut dengan Google</button>
          {s.googleCancelled && <p className="muted" role="status" style={{ fontSize: 14, textAlign: "center" }}>Masuk Google dibatalkan</p>}
          <p className="signin-or" aria-hidden="true">atau</p>
          <label className="field">
            <span>Email</span>
            <input
              className="input" type="email" inputMode="email" autoComplete="email" value={s.email}
              aria-invalid={s.emailError} aria-describedby={s.emailError ? "signin-email-error" : undefined}
              onChange={(e) => dispatch({ type: "email", value: e.target.value })}
            />
            {s.emailError && <span id="signin-email-error" className="signin-error" role="alert">Email tidak cocok</span>}
          </label>
          <label className="field">
            <span>Kata sandi</span>
            <input
              className="input" type="password" autoComplete={daftar ? "new-password" : "current-password"} value={s.password}
              onChange={(e) => dispatch({ type: "password", value: e.target.value })}
            />
          </label>
          <button type="submit" className="btn btn-signin block">{daftar ? "Buat akun" : "Masuk"}</button>
        </form>
        <div className="signin-links">
          <button type="button" className="link-btn" onClick={() => dispatch({ type: "mode", mode: daftar ? "masuk" : "daftar" })}>
            {daftar ? "Masuk" : "Daftar"}
          </button>
          <a className="link-btn muted" href="#/profil">Nanti saja</a>
        </div>
      </div>
    </>
  );
}

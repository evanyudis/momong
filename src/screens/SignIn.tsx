import { type FormEvent, useEffect, useReducer, useState } from "react";
import { reducedMotion } from "../motion";
import { SIGNIN_EMPTY, signIn } from "../signin";
import { TopBar } from "../ui";

const EXIT_MS = 150; // matches the quiet exit in styles.css; enter (settle-in) is 200ms

/** Keeps a message mounted through its exit. Keyboard-driven and reduced-motion changes leave at once. */
function useLeaving(show: boolean, still: boolean) {
  const [prev, setPrev] = useState(show);
  const [leaving, setLeaving] = useState(false);
  if (prev !== show) {
    setPrev(show);
    setLeaving(!show && !still && !reducedMotion());
  }
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving]);
  return leaving;
}

/** Masuk / Daftar from Profil, signed out only. UI only: no network, no session, no account. Leaving keeps local data. */
export function SignIn() {
  const [s, dispatch] = useReducer(signIn, SIGNIN_EMPTY);
  // Last input was a key: messages appear and leave without motion (emil-animations: keyboard actions never animate).
  const [still, setStill] = useState(false);
  const errLeaving = useLeaving(s.emailError, still);
  const googleLeaving = useLeaving(s.googleCancelled, still);
  const daftar = s.mode === "daftar";

  function submit(e: FormEvent) {
    e.preventDefault();
    dispatch({ type: "submit" });
  }

  const msg = (leaving: boolean) => ({ "data-still": still || undefined, "data-leaving": leaving || undefined });

  return (
    <>
      <TopBar title={daftar ? "Daftar" : "Masuk"} back="#/profil" />
      <div className="stack" onKeyDown={() => setStill(true)} onPointerDown={() => setStill(false)}>
        <p className="muted" style={{ textAlign: "center" }}>Supaya data tersimpan online. Sync dan pasangan tetap gratis.</p>
        <form className="card stack" onSubmit={submit} noValidate>
          <button type="button" className="btn btn-ghost block" onClick={() => dispatch({ type: "google" })}>Lanjut dengan Google</button>
          {(s.googleCancelled || googleLeaving) && (
            <p className="muted signin-msg" role="status" style={{ fontSize: 14, textAlign: "center" }} {...msg(googleLeaving)}>Masuk Google dibatalkan</p>
          )}
          <p className="signin-or" aria-hidden="true">atau</p>
          <label className="field">
            <span>Email</span>
            <input
              className="input" type="email" inputMode="email" autoComplete="email" value={s.email}
              aria-invalid={s.emailError} aria-describedby={s.emailError ? "signin-email-error" : undefined}
              onChange={(e) => dispatch({ type: "email", value: e.target.value })}
            />
            {(s.emailError || errLeaving) && (
              <span id="signin-email-error" className="signin-error signin-msg" role="alert" {...msg(errLeaving)}>Email tidak cocok</span>
            )}
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

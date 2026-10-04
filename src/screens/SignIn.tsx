import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { reducedMotion } from "../motion";
import { FAILURE_TEXT, SIGNIN_EMPTY, signIn } from "../signin";
import { ApiError, authEmail } from "../sync";
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

/** Masuk / Daftar from Profil, signed out only. Real Better Auth email + password; Google stays off. Leaving keeps local data. */
export function SignIn() {
  const [s, dispatch] = useReducer(signIn, SIGNIN_EMPTY);
  // Last input was a key: messages appear and leave without motion (emil-animations: keyboard actions never animate).
  const [still, setStill] = useState(false);
  const errLeaving = useLeaving(s.emailError, still);
  const googleLeaving = useLeaving(s.googleCancelled, still);
  const failLeaving = useLeaving(!!s.failure, still);
  const lastFailure = useRef(s.failure);
  if (s.failure) lastFailure.current = s.failure; // keeps the text through its exit
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const daftar = s.mode === "daftar";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (s.pending) return;
    const email = s.email.trim();
    if (!email) return emailRef.current?.focus();
    if (!s.password) return passwordRef.current?.focus();
    dispatch({ type: "submit" });
    try {
      await authEmail(s.mode, email, s.password);
      location.hash = "#/profil";
    } catch (err) {
      // Status 0 covers fetch rejecting (offline, firewall, CORS, mixed content): never shown as success.
      dispatch({ type: "fail", status: err instanceof ApiError ? err.status : 0 });
    }
  }

  const msg = (leaving: boolean) => ({ "data-still": still || undefined, "data-leaving": leaving || undefined });

  return (
    <>
      <TopBar title={daftar ? "Daftar" : "Masuk"} back="#/profil" />
      <div className="stack" onKeyDown={() => setStill(true)} onPointerDown={() => setStill(false)}>
        <p className="muted" style={{ textAlign: "center" }}>Supaya data tersimpan online. Sync dan pasangan tetap gratis.</p>
        <form className="card stack" onSubmit={submit} noValidate aria-busy={s.pending}>
          <Button variant="outline" className="block" disabled={s.pending} onClick={() => dispatch({ type: "google" })}>Lanjut dengan Google</Button>
          {(s.googleCancelled || googleLeaving) && (
            <p className="muted signin-msg" role="status" style={{ fontSize: 14, textAlign: "center" }} {...msg(googleLeaving)}>Masuk Google dibatalkan</p>
          )}
          <p className="signin-or" aria-hidden="true">atau</p>
          <div className="field">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              ref={emailRef} id="signin-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              value={s.email} aria-invalid={s.emailError} aria-describedby={s.emailError ? "signin-email-error" : undefined}
              onChange={(e) => dispatch({ type: "email", value: e.target.value })}
            />
            {(s.emailError || errLeaving) && (
              <span id="signin-email-error" className="signin-error signin-msg" role="alert" {...msg(errLeaving)}>Email tidak cocok</span>
            )}
          </div>
          <div className="field">
            <Label htmlFor="signin-password">Kata sandi</Label>
            <Input
              ref={passwordRef} id="signin-password" type="password" autoComplete={daftar ? "new-password" : "current-password"}
              value={s.password} onChange={(e) => dispatch({ type: "password", value: e.target.value })}
            />
          </div>
          <Button type="submit" className="block" disabled={s.pending}>{daftar ? "Buat akun" : "Masuk"}</Button>
          {(s.failure || failLeaving) && lastFailure.current && (
            <p className="signin-failure signin-msg" role="alert" {...msg(failLeaving)}>{FAILURE_TEXT[lastFailure.current]}</p>
          )}
        </form>
        <div className="signin-links">
          <Button variant="link" disabled={s.pending} onClick={() => dispatch({ type: "mode", mode: daftar ? "masuk" : "daftar" })}>
            {daftar ? "Masuk" : "Daftar"}
          </Button>
          <a className="link-btn muted" href="#/profil">Nanti saja</a>
        </div>
      </div>
    </>
  );
}

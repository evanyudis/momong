import { RestoreSheet } from "./Restore";
import { ChevronLeft } from "lucide-react";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { Button, FieldError, Form, Input, Label, TextField } from "react-aria-components";
import { deviceHasData, setPrefs } from "../store";
import { reducedMotion } from "../motion";
import { FAILURE_TEXT, SIGNIN_EMPTY, signIn } from "../signin";
import { ApiError, authEmail, startGoogle, takeGoogleReturn, authDestination } from "../sync";

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

/** Google "G" in its four brand colors, drawn inline. No fetched logo, no client id. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Account entry for onboarding and Profil. Email + password and Google OAuth.
 *  Controls are react-aria-components (unstyled), dressed only by the app's .btn / .input / .field rules. */
export function SignIn({ onboarding = false, plus = false, signup = false }: { onboarding?: boolean; plus?: boolean; signup?: boolean }) {
  const [restoreOpen, setRestoreOpen] = useState(false);
  const forPlus = plus || sessionStorage.getItem("bb_auth_return") === "#/plus";
  const [s, dispatch] = useReducer(signIn, { ...SIGNIN_EMPTY, mode: signup ? "daftar" : "masuk" });
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
      location.hash = authDestination(onboarding ? "#/" : "#/profil");
    } catch (err) {
      // Status 0 covers fetch rejecting (offline, firewall, CORS, mixed content): never shown as success.
      dispatch({ type: "fail", status: err instanceof ApiError ? err.status : 0 });
    }
  }

  // Came back from Google without a session: reload or errorCallbackURL lands here; Back may restore this page from bfcache.
  useEffect(() => {
    const back = () => { if (takeGoogleReturn()) dispatch({ type: "googleCancelled" }); };
    back();
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) back(); };
    addEventListener("pageshow", onShow);
    return () => removeEventListener("pageshow", onShow);
  }, []);

  async function google() {
    if (s.pending) return;
    dispatch({ type: "google" });
    try {
      await startGoogle(); // the browser leaves for Google; success comes back to #/profil
    } catch (err) {
      dispatch({ type: "googleFail", status: err instanceof ApiError ? err.status : 0 });
    }
  }

  const msg = (leaving: boolean) => ({ "data-still": still || undefined, "data-leaving": leaving || undefined });

  return (
    <>
      <header className="header signin-head">
        {!onboarding && <a className="icon-btn" href="#/profil" aria-label="Kembali"><ChevronLeft size={22} /></a>}
        <span className="signin-brand">Momong</span>
        <h1>{onboarding ? "Selamat datang di Momong" : daftar ? "Buat akun Momong" : "Masuk ke Momong"}</h1>
        <p className="muted">{forPlus ? "Masuk atau daftar untuk lanjut dengan Momong Plus." : onboarding ? "Catat tanpa akun. Masuk untuk sinkron dengan pasangan." : "Supaya data tersimpan online. Sync dan pasangan tetap gratis."}</p>
      </header>
      <div className="signin" onKeyDownCapture={() => setStill(true)} onPointerDownCapture={() => setStill(false)}>
        <Form className="stack" onSubmit={submit} validationBehavior="native" aria-busy={s.pending}>
          <Button className="btn btn-glass block" isDisabled={s.pending} onPress={google}><GoogleMark />Lanjut dengan Google</Button>
          {(s.googleCancelled || googleLeaving) && (
            <p className="muted signin-msg" role="status" {...msg(googleLeaving)}>Masuk Google dibatalkan.</p>
          )}
          <p className="signin-or" aria-hidden="true">atau</p>
          <TextField
            className="field" type="email" inputMode="email" autoComplete="email" isRequired
            value={s.email} isInvalid={s.emailError} aria-describedby={s.emailError ? "signin-email-error" : undefined}
            onChange={(value) => dispatch({ type: "email", value })}
          >
            <Label>Email</Label>
            <Input ref={emailRef} className="input" placeholder="nama@email.com" autoCapitalize="none" spellCheck={false} />
            {!s.emailError && <FieldError className="signin-error" />}
            {(s.emailError || errLeaving) && (
              <span id="signin-email-error" className="signin-error signin-msg" role="alert" {...msg(errLeaving)}>Email tidak cocok.</span>
            )}
          </TextField>
          <TextField
            className="field" type="password" autoComplete={daftar ? "new-password" : "current-password"} isRequired minLength={daftar ? 8 : undefined}
            value={s.password} onChange={(value) => dispatch({ type: "password", value })}
          >
            <Label>Kata sandi</Label>
            <Input ref={passwordRef} className="input" />
            <FieldError className="signin-error" />
            {daftar && <small className="muted">Minimal 8 karakter.</small>}
          </TextField>
          <Button type="submit" className="btn btn-signin block" isDisabled={s.pending}>{s.pending ? "Menyambungkan…" : daftar ? "Buat akun" : "Masuk"}</Button>
          {(s.failure || failLeaving) && lastFailure.current && (
            <p className="signin-failure signin-msg" role="alert" {...msg(failLeaving)}>{FAILURE_TEXT[lastFailure.current]}</p>
          )}
          <Button type="button" className="link-btn signin-later" isDisabled={s.pending} onPress={() => dispatch({ type: "mode", mode: daftar ? "masuk" : "daftar" })}>
            {daftar ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
          </Button>

        </Form>
        <button type="button" className="btn btn-soft block" style={{ marginTop: 20 }} onClick={() => {
          setPrefs({ guest: true });
          sessionStorage.removeItem("bb_auth_return");
          sessionStorage.removeItem("bb_plus_plan");
          location.hash = "#/";
        }}>Lanjut tanpa akun</button>
        {onboarding && !forPlus && !deviceHasData() && <button type="button" className="link-btn restore-entry" onClick={() => setRestoreOpen(true)}>Punya cadangan? Pulihkan data</button>}
        <RestoreSheet open={restoreOpen} onOpenChange={setRestoreOpen} />
      </div>
    </>
  );
}

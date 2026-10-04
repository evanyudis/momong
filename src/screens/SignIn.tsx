import { ChevronLeft } from "lucide-react";
import { type FormEvent, useEffect, useReducer, useRef, useState } from "react";
import { Button, Form, Input, Label, TextField } from "react-aria-components";
import { reducedMotion } from "../motion";
import { FAILURE_TEXT, SIGNIN_EMPTY, signIn } from "../signin";
import { ApiError, authEmail, startGoogle, takeGoogleReturn } from "../sync";

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

/** Google "G" drawn inline in the label color. No fetched logo, no client id. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

/** Masuk / Daftar from Profil, signed out only. Real Better Auth email + password and Google OAuth. Leaving keeps local data.
 *  Controls are react-aria-components (unstyled), dressed only by the app's .btn / .input / .field rules. */
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
        <a className="icon-btn" href="#/profil" aria-label="Kembali"><ChevronLeft size={22} /></a>
        <span className="signin-brand">BumpBuddy</span>
        <h1>{daftar ? "Daftar" : "Masuk"}</h1>
        <p className="muted">Supaya data tersimpan online. Sync dan pasangan tetap gratis.</p>
      </header>
      <div className="signin" onKeyDownCapture={() => setStill(true)} onPointerDownCapture={() => setStill(false)}>
        <Form className="stack" onSubmit={submit} validationBehavior="aria" aria-busy={s.pending}>
          <Button className="btn btn-glass block" isDisabled={s.pending} onPress={google}><GoogleMark />Lanjut dengan Google</Button>
          {(s.googleCancelled || googleLeaving) && (
            <p className="muted signin-msg" role="status" {...msg(googleLeaving)}>Masuk Google dibatalkan.</p>
          )}
          <p className="signin-or" aria-hidden="true">atau</p>
          <TextField
            className="field" type="email" inputMode="email" autoComplete="email"
            value={s.email} isInvalid={s.emailError} aria-describedby={s.emailError ? "signin-email-error" : undefined}
            onChange={(value) => dispatch({ type: "email", value })}
          >
            <Label>Email</Label>
            <Input ref={emailRef} className="input" placeholder="nama@email.com" autoCapitalize="none" spellCheck={false} />
            {(s.emailError || errLeaving) && (
              <span id="signin-email-error" className="signin-error signin-msg" role="alert" {...msg(errLeaving)}>Email tidak cocok.</span>
            )}
          </TextField>
          <TextField
            className="field" type="password" autoComplete={daftar ? "new-password" : "current-password"}
            value={s.password} onChange={(value) => dispatch({ type: "password", value })}
          >
            <Label>Kata sandi</Label>
            <Input ref={passwordRef} className="input" />
          </TextField>
          <Button type="submit" className="btn btn-signin block" isDisabled={s.pending}>{daftar ? "Buat akun" : "Masuk"}</Button>
          {(s.failure || failLeaving) && lastFailure.current && (
            <p className="signin-failure signin-msg" role="alert" {...msg(failLeaving)}>{FAILURE_TEXT[lastFailure.current]}</p>
          )}
          <a className="link-btn muted signin-later" href="#/profil">Nanti saja</a>
        </Form>
      </div>
    </>
  );
}

/** Sign-in screen state. Pure: the network calls live in sync.ts (authEmail, startGoogle); this only decides what the screen shows. */
export type SignInMode = "masuk" | "daftar";
/** Shown under the button. "Email tidak cocok" is not here: it sits on the email field (emailError). */
export type SignInFailure = "network" | "daftar" | "other" | "timeout" | "created";
export type SignInState = {
  mode: SignInMode;
  email: string;
  password: string;
  emailError: boolean;
  googleCancelled: boolean;
  pending: boolean;
  failure: SignInFailure | null;
};
export type SignInAction =
  | { type: "email" | "password"; value: string }
  | { type: "mode"; mode: SignInMode }
  | { type: "google" | "googleCancelled" }
  | { type: "googleFail"; status: number }
  | { type: "submit" }
  | { type: "idle" }
  | { type: "fail"; status: number; failure?: SignInFailure };

export const SIGNIN_EMPTY: SignInState = {
  mode: "masuk", email: "", password: "", emailError: false, googleCancelled: false, pending: false, failure: null,
};

export const FAILURE_TEXT: Record<SignInFailure, string> = {
  network: "Tidak bisa terhubung ke server. Data tetap tersimpan di perangkat ini.",
  daftar: "Akun tidak bisa dibuat. Email mungkin sudah terdaftar, atau kata sandi kurang dari 8 karakter.",
  other: "Server sedang bermasalah. Coba lagi nanti.",
  timeout: "Sambungan terlalu lama. Coba lagi.",
  created: "Akun sudah dibuat. Masuk untuk lanjut.",
};

export const AUTH_ATTEMPT_KEY = "bb_auth_attempt";
export const AUTH_NOTICE_KEY = "bb_auth_notice";

export type AuthAttempt = { mode: SignInMode; email: string };

export function parseAuthAttempt(raw: string | null): AuthAttempt | null {
  try {
    const value = JSON.parse(raw ?? "");
    if (!value || (value.mode !== "masuk" && value.mode !== "daftar")) return null;
    if (typeof value.email !== "string") return null;
    return { mode: value.mode, email: value.email };
  } catch {
    return null;
  }
}

/** A service worker claim reloads the page. That reload aborts sign-up after the account exists, so wait. */
export function controllerChangeAction(authPending: boolean): "reload" | "defer" {
  return authPending ? "defer" : "reload";
}

/** Sign-up HTTP outcome. A lost response (0/408) may still have created the account. */
export function signupStep(input: { status: number; followUpFailed: boolean }): "retry-signin" | "registered" | "enter" | "show-error" {
  if (input.followUpFailed) return "retry-signin";
  if (input.status === 0 || input.status === 408) return "retry-signin";
  if (input.status >= 400 && input.status < 500) return "registered";
  if (input.status >= 200 && input.status < 300) return "enter";
  return "show-error";
}

/** Password sign-in after a sign-up that succeeded or whose response was lost. */
export function signInRetryStep(input: { signInStatus: number; followUpFailed: boolean; signupSucceeded: boolean }): "done" | "created-login" | "show-error" {
  if (!input.followUpFailed && input.signInStatus >= 200 && input.signInStatus < 300) return "done";
  if (input.signupSucceeded || (input.signInStatus >= 200 && input.signInStatus < 300)) return "created-login";
  return "show-error";
}

export const SIGNIN_DRAFT_KEY = "bb_signin_draft";

export type SignInDraft = { mode: SignInMode; email: string; failure: SignInFailure | null };

export function parseSignInDraft(raw: string | null): SignInDraft | null {
  try {
    const value = JSON.parse(raw ?? "");
    if (!value || (value.mode !== "masuk" && value.mode !== "daftar")) return null;
    if (typeof value.email !== "string") return null;
    const failure = value.failure === "network" || value.failure === "daftar" || value.failure === "other" || value.failure === "timeout" || value.failure === "created" ? value.failure : null;
    return { mode: value.mode, email: value.email, failure };
  } catch {
    return null;
  }
}

/** URL `mode=signup` wins, except a created-account notice. A remount during loading stays pending. The password argument is memory only. */
export function signInInitial(signup: boolean, draft: SignInDraft | null, attempt: AuthAttempt | null = null, createdNotice = false, memoryPassword = ""): SignInState {
  if (attempt) {
    return {
      ...SIGNIN_EMPTY,
      mode: signup ? "daftar" : attempt.mode,
      email: attempt.email,
      password: memoryPassword,
      pending: true,
    };
  }
  if (createdNotice || draft?.failure === "created") {
    return { ...SIGNIN_EMPTY, mode: "masuk", email: draft?.email ?? "", failure: "created" };
  }
  return {
    ...SIGNIN_EMPTY,
    mode: signup ? "daftar" : draft?.mode ?? "masuk",
    email: draft?.email ?? "",
    failure: draft?.failure ?? null,
  };
}

export function signInDraft(s: Pick<SignInState, "mode" | "email" | "failure">): SignInDraft {
  return { mode: s.mode, email: s.email, failure: s.failure };
}

/** Better Auth answers a wrong email or password on sign-in with 401. Status 0 = the request never got an answer. */
export function failureFor(mode: SignInMode, status: number): Pick<SignInState, "emailError" | "failure"> {
  if (status === 408) return { emailError: false, failure: "timeout" };
  if (status === 0) return { emailError: false, failure: "network" };
  if (mode === "masuk" && status === 401) return { emailError: true, failure: null };
  if (mode === "daftar" && status >= 400 && status < 500) return { emailError: false, failure: "daftar" };
  return { emailError: false, failure: "other" };
}

/** Better Auth sign-up requires a name; the email's local part is enough until Profil lets them change it. */
export const nameFromEmail = (email: string) => email.trim().split("@")[0] || "Momong";

export function signIn(s: SignInState, a: SignInAction): SignInState {
  switch (a.type) {
    case "email": return { ...s, email: a.value, emailError: false, failure: null };
    case "password": return { ...s, password: a.value, emailError: false, failure: null };
    case "mode": return { ...s, mode: a.mode, emailError: false, googleCancelled: false, failure: null };
    // Google: pending while the app asks for the Google URL; the browser then leaves. Back without a session = cancelled.
    case "google": return { ...s, pending: true, emailError: false, googleCancelled: false, failure: null };
    case "googleCancelled": return { ...s, pending: false, googleCancelled: true };
    case "googleFail": return { ...s, pending: false, failure: a.status === 0 ? "network" : "other" }; // never "Email tidak cocok"
    case "submit": return { ...s, pending: true, emailError: false, googleCancelled: false, failure: null };
    case "idle": return { ...s, pending: false };
    case "fail": {
      const next = a.failure ? { emailError: false, failure: a.failure } : failureFor(s.mode, a.status);
      return { ...s, pending: false, ...next, mode: next.failure === "created" ? "masuk" : s.mode };
    }
  }
}

/** Sign-in screen state. Pure: the network calls live in sync.ts (authEmail, startGoogle); this only decides what the screen shows. */
export type SignInMode = "masuk" | "daftar";
/** Shown under the button. "Email tidak cocok" is not here: it sits on the email field (emailError). */
export type SignInFailure = "network" | "daftar" | "other";
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
  | { type: "fail"; status: number };

export const SIGNIN_EMPTY: SignInState = {
  mode: "masuk", email: "", password: "", emailError: false, googleCancelled: false, pending: false, failure: null,
};

export const FAILURE_TEXT: Record<SignInFailure, string> = {
  network: "Tidak bisa terhubung ke server. Data tetap tersimpan di perangkat ini.",
  daftar: "Akun tidak bisa dibuat. Email mungkin sudah terdaftar, atau kata sandi kurang dari 8 karakter.",
  other: "Server sedang bermasalah. Coba lagi nanti.",
};

/** Better Auth answers a wrong email or password on sign-in with 401. Status 0 = the request never got an answer. */
export function failureFor(mode: SignInMode, status: number): Pick<SignInState, "emailError" | "failure"> {
  if (status === 0) return { emailError: false, failure: "network" };
  if (mode === "masuk" && status === 401) return { emailError: true, failure: null };
  if (mode === "daftar" && status >= 400 && status < 500) return { emailError: false, failure: "daftar" };
  return { emailError: false, failure: "other" };
}

/** Better Auth sign-up requires a name; the email's local part is enough until Profil lets them change it. */
export const nameFromEmail = (email: string) => email.trim().split("@")[0] || "BumpBuddy";

export function signIn(s: SignInState, a: SignInAction): SignInState {
  switch (a.type) {
    case "email": return { ...s, email: a.value, emailError: false, failure: null };
    case "password": return { ...s, password: a.value, failure: null };
    case "mode": return { ...s, mode: a.mode, emailError: false, googleCancelled: false, failure: null };
    // Google: pending while the app asks for the Google URL; the browser then leaves. Back without a session = cancelled.
    case "google": return { ...s, pending: true, emailError: false, googleCancelled: false, failure: null };
    case "googleCancelled": return { ...s, pending: false, googleCancelled: true };
    case "googleFail": return { ...s, pending: false, failure: a.status === 0 ? "network" : "other" }; // never "Email tidak cocok"
    case "submit": return { ...s, pending: true, emailError: false, googleCancelled: false, failure: null };
    case "fail": return { ...s, pending: false, ...failureFor(s.mode, a.status) }; // fields stay filled
  }
}

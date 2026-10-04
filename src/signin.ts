/** Sign-in screen state (UI only). No action here signs in, creates an account, or touches storage. */
export type SignInMode = "masuk" | "daftar";
export type SignInState = {
  mode: SignInMode;
  email: string;
  password: string;
  emailError: boolean;
  googleCancelled: boolean;
};
export type SignInAction =
  | { type: "email" | "password"; value: string }
  | { type: "mode"; mode: SignInMode }
  | { type: "google" }
  | { type: "submit" };

export const SIGNIN_EMPTY: SignInState = { mode: "masuk", email: "", password: "", emailError: false, googleCancelled: false };

// ponytail: the one demo string that shows the email error; there is no backend to ask.
export const WRONG_EMAIL = "bunda@email";

export function signIn(s: SignInState, a: SignInAction): SignInState {
  switch (a.type) {
    case "email": return { ...s, email: a.value, emailError: false };
    case "password": return { ...s, password: a.value };
    case "mode": return { ...s, mode: a.mode, emailError: false, googleCancelled: false };
    case "google": return { ...SIGNIN_EMPTY, mode: s.mode, googleCancelled: true }; // never calls Google
    case "submit": return { ...s, emailError: s.email === WRONG_EMAIL, googleCancelled: false };
  }
}

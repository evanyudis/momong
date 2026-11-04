/** Hapus akun: server contract (momong-api GET /account/deletion, POST /account/delete) and the copy for each refusal. */
export const DELETE_CONFIRM = "HAPUS";
export const DELETE_RETURN = "#/hapus-akun";

export type DeletionPreview = {
  hasPassword: boolean;
  sessionFresh: boolean;
  soleMember: boolean;
  hasPartner: boolean;
  plusActive: boolean;
  plusLossNeedsAck: boolean;
  blocked: "midtrans_autorenew_active" | null;
};

export function parsePreview(data: any): DeletionPreview | null {
  if (!data || typeof data !== "object") return null;
  const flags = ["hasPassword", "sessionFresh", "soleMember", "hasPartner", "plusActive", "plusLossNeedsAck"] as const;
  if (flags.some((k) => typeof data[k] !== "boolean")) return null;
  return { ...Object.fromEntries(flags.map((k) => [k, data[k]])) as Omit<DeletionPreview, "blocked">, blocked: data.blocked === "midtrans_autorenew_active" ? data.blocked : null };
}

export type DeleteForm = { confirm: string; password: string; acknowledgePlusLoss: boolean };

/** Same gate as the server, so the button only lights up when the request can pass. */
export function canSubmit(preview: DeletionPreview, form: DeleteForm) {
  if (preview.blocked) return false;
  if (form.confirm.trim().toUpperCase() !== DELETE_CONFIRM) return false;
  if (preview.hasPassword ? !form.password : !preview.sessionFresh) return false;
  return !preview.plusLossNeedsAck || form.acknowledgePlusLoss;
}

export function deleteBody(preview: DeletionPreview, form: DeleteForm) {
  return {
    confirm: form.confirm.trim(),
    ...(preview.hasPassword ? { password: form.password } : {}),
    ...(preview.plusLossNeedsAck ? { acknowledgePlusLoss: form.acknowledgePlusLoss } : {}),
  };
}

export function deleteErrorCopy(code: string) {
  switch (code) {
    case "invalid_password": return "Password salah. Coba lagi.";
    case "password_required": return "Masukkan password akunmu dulu.";
    case "confirm_required": return `Ketik ${DELETE_CONFIRM} dulu.`;
    case "reauth_required": return "Login kamu sudah lebih dari 10 menit. Masuk ulang dulu, lalu coba lagi.";
    case "rate_limited": return "Terlalu banyak percobaan. Coba lagi sejam lagi.";
    case "plus_loss_unacknowledged": return "Centang dulu kalau kamu paham Plus ikut hilang.";
    case "midtrans_autorenew_active": return "Langganan bulananmu masih aktif. Batalkan dulu di halaman Plus, lalu balik ke sini.";
    case "unauthorized": return "Sesi kamu sudah habis. Masuk lagi dulu.";
    default: return "Akun belum terhapus. Cek koneksi lalu coba lagi.";
  }
}

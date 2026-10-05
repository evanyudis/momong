// Copy only. Non-clinical by design (PRD §3: no clinical advice).
export const SYMPTOMS = [
  "Pegal punggung", "Sulit tidur", "Mual", "Kram kaki", "Kaki bengkak", "Sakit kepala",
  "Heartburn", "Sering pipis", "Sesak napas", "Kontraksi palsu", "Lelah", "Cemas",
];

export const BAG_DEFAULTS: { id: string; label: string; group: "Bunda" | "Bayi" | "Dokumen" }[] = [
  { id: "d-ktp", label: "KTP & kartu keluarga", group: "Dokumen" },
  { id: "d-bpjs", label: "Kartu BPJS / asuransi", group: "Dokumen" },
  { id: "d-buku", label: "Buku KIA (pink)", group: "Dokumen" },
  { id: "d-hasil", label: "Hasil USG & lab", group: "Dokumen" },
  { id: "m-baju", label: "Baju ganti 2–3 set", group: "Bunda" },
  { id: "m-daster", label: "Daster kancing depan", group: "Bunda" },
  { id: "m-bra", label: "Bra menyusui", group: "Bunda" },
  { id: "m-pembalut", label: "Pembalut nifas", group: "Bunda" },
  { id: "m-cd", label: "Celana dalam sekali pakai", group: "Bunda" },
  { id: "m-sandal", label: "Sandal", group: "Bunda" },
  { id: "m-toiletries", label: "Peralatan mandi", group: "Bunda" },
  { id: "m-handuk", label: "Handuk", group: "Bunda" },
  { id: "m-charger", label: "Charger & power bank", group: "Bunda" },
  { id: "m-camilan", label: "Camilan & botol minum", group: "Bunda" },
  { id: "m-bantal", label: "Bantal menyusui", group: "Bunda" },
  { id: "b-baju", label: "Baju bayi 3–4 set", group: "Bayi" },
  { id: "b-bedong", label: "Bedong", group: "Bayi" },
  { id: "b-topi", label: "Topi, sarung tangan & kaki", group: "Bayi" },
  { id: "b-popok", label: "Popok newborn", group: "Bayi" },
  { id: "b-tisu", label: "Tisu basah", group: "Bayi" },
  { id: "b-selimut", label: "Selimut", group: "Bayi" },
  { id: "b-gendongan", label: "Gendongan", group: "Bayi" },
  { id: "b-carseat", label: "Car seat untuk pulang", group: "Bayi" },
  { id: "b-minyak", label: "Minyak telon", group: "Bayi" },
  { id: "b-sabun", label: "Sabun & sampo bayi", group: "Bayi" },
];

export function weekNote(week: number): string {
  if (week < 13) return "Trimester pertama sering bikin lelah. Catat gejala yang muncul supaya mudah diceritakan saat kontrol.";
  if (week < 20) return "Banyak orang mulai merasa lebih bertenaga di fase ini. Waktu yang pas untuk mulai menyiapkan tas RS pelan-pelan.";
  if (week < 28) return "Gerakan si kecil mulai lebih terasa. Kenali polanya; tidak perlu dihitung setiap saat.";
  if (week < 34) return "Masuk trimester ketiga. Cicil isi tas RS dan ajak pasangan ikut mencatat dari HP masing-masing.";
  if (week < 37) return "Gerakan si kecil mungkin terasa lebih pelan karena ruang makin sempit. Tetap catat seperti biasa.";
  return "Sudah dekat. Simpan timer kontraksi di layar utama dan pastikan tas RS siap dibawa.";
}

export type PlusVariant = "overview" | "insights" | "perkiraan" | "pdf";
export const PLUS_COPY: Record<PlusVariant, { title: string; body: string }> = {
  overview: { title: "BumpBuddy Plus", body: "Lebih banyak ruang untuk mengikuti tumbuhnya si kecil." },
  insights: { title: "Lihat pola minggu ini", body: "Grafik dari catatanmu, dengan riwayat lebih dari 30 hari." },
  perkiraan: { title: "Perkiraan kapan berikutnya", body: "Perkiraan dari pola menyusu yang kamu catat. Bukan jadwal atau saran medis." },
  pdf: { title: "Simpan laporan lengkap", body: "Unduh PDF tanpa batas, langsung dari perangkatmu." },
};

export const PLUS_FEATURES = [
  { title: "Perkiraan menyusu", body: "Dari pola catatanmu, bukan saran medis." },
  { title: "Pengingat pilihanmu", body: "Atur sendiri; berjalan selama aplikasi terbuka." },
  { title: "Grafik harian", body: "Lihat pola menyusu, pompa, dan popok." },
  { title: "Riwayat lengkap", body: "Buka catatan lebih dari 30 hari." },
  { title: "PDF tanpa batas", body: "Unduh laporan untuk dibawa saat kontrol." },
  { title: "Wishlist bersama", body: "Bagikan tautan agar keluarga bisa claim hadiah." },
  { title: "Multi bayi", body: "Profil dan catatan terpisah untuk tiap si kecil." },
];

export const DIAPER_LABEL: Record<string, string> = { pee: "Pipis", poo: "Pup", both: "Pipis + pup" };
export const SIDE_LABEL: Record<string, string> = { left: "Kiri", right: "Kanan", both: "Keduanya" };

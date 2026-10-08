# Plan adaptasi desain newborn ke mode hamil

8 Oktober 2026. Newborn terpilih: identitas bayi bergambar + Cap–Baris + day view. Dokumen ini merupakan plan, belum implementasi mode hamil. Material glass bersama sudah diterapkan pada floating navigation, tombol kembali/tutup, serta kontrol yang sebelumnya memakai glass. Dashboard newborn sekarang memakai store, validasi, dan sheet produksi, bukan data Demo.

## P0 — konsistensi yang bisa langsung diadaptasi

| Keputusan | Adaptasi kehamilan | Batas |
| --- | --- | --- |
| Hierarchy kartu konsisten | Judul section 17px/600, deskripsi 14px, angka tabular. HPL/minggu menjadi fokus hero; statistik harian dan shortcut punya bobot sekunder. | Sapaan, Geist, lebar halaman dan identitas Momong tetap. Usia janin memakai minggu, bukan format bulan/hari bayi. |
| Material kartu | Canvas netral, card radius/elevation bersama; ring tipis pada dark. Glass untuk kontrol mengambang. | Kartu informasi dan sheet tetap opaque agar terbaca. |
| Cap–Baris | Eksplorasi angka utama kehamilan dengan motif ilustrasi kecil; ringkasan kontraksi, gerakan, gejala memakai baris ikon/label/nilai. | Jangan menyalin hierarki “susu dominan” ke metrik klinis. Ring HPL/Tas RS boleh tetap karena denominaturnya nyata. |
| Plus, pasangan, daftar kado | Title role dan alignment konsisten; badge Plus asli. Tas RS dan pasangan tetap memiliki akses cepat. | Flag release dan copy Segera hadir tetap. |
| Segmented switch | Pilihan pendek yang saling eksklusif memakai komponen radio yang sama. | Pilihan gejala bersifat multi-select, tetap chips/checkbox. |

## P1 — eksplorasi alur, setelah P0 dipilih

1. **Dock empat tab + Add terpisah.** Menu menampilkan Catat gejala dan pintasan Timer kontraksi / Hitung gerakan. Dua pintasan timer membuka dan memfokuskan kontrol yang ada di Log; jangan memulai timer dari menu tanpa konteks. Catat gejala dapat membuka sheet yang ada. Bandingkan dengan navigasi sekarang sebelum menetapkan perubahan.
2. **Aktivitas hari ini di Beranda.** Ringkasan baris dengan Lihat hari ini menuju tanggal yang sama di Log. Tidak menaruh daftar riwayat panjang di dashboard.
3. **Day view di Log.** Tujuh tanggal, fade di ujung, satu hari per chevron, Hari ini, filter dan kartu catatan pendek. Kontraksi memakai waktu mulai serta durasi/rentang dari end yang tercatat; gerakan memakai sesi yang tersedia; gejala memakai jam kejadian. Sesi lintas tengah malam masuk tanggal mulai.
4. **Timer dan riwayat tetap punya peran berbeda.** Log kehamilan saat ini berisi timer kontraksi, hitung gerakan, dan gejala. Eksplorasi komposisi “kontrol aktif → catatan harian”; jangan mengganti seluruh halaman menjadi history-only sebelum alur timer disepakati. Sesi aktif harus terlihat dan dapat dihentikan dengan satu aksi.

## P2 — karakter visual

Bandingkan 2–3 variasi kecil hero/ringkasan: ilustrasi tunas, aksen berbentuk cap, atau ring existing dengan aksen pastel. Tetap satu motif dominan per kartu, statis/dekoratif. Palette membedakan jenis aktivitas dengan ikon dan label. Tidak ada confetti, target baru, progress medis rekaan, atau status “aman” dari frekuensi catatan.

## Urutan pengerjaan dan kriteria selesai

- Screenshot baseline hamil pada 320/390/841px, light/dark.
- Prototype P0 dengan data identik; pilih arah, lalu eksplorasi P1. Keputusan newborn menjadi rujukan material/hierarchy, bukan kewajiban menyalin layout.
- Pertahankan pattern alert kontraksi beserta urgency, dismiss dan validasi existing. Alert harus lebih menonjol daripada dekorasi.
- Uji start/stop kontraksi, hitung 10 gerakan, catat/edit/hapus gejala, timer saat berpindah tab/reload, tanggal lokal dan tengah malam, filter/empty/busy, sheet/Escape/focus, reduced motion dan target ≥44px.
- Verifikasi angka dari store aktual, Free offline/guest, opt-in sync, partner, PDF, Plus disabled; tanpa perubahan API atau skema.
- Setelah arah dipilih, integrasikan, jalankan test/build/diff, lalu bersihkan prototype. Deployment merupakan langkah terpisah.

# PostHog — analytics dan error tracking Momong

Tanggal: 6 Oktober 2026 (Asia/Jakarta).

## Status

Integrasi lokal tersedia di frontend dan API. Pada 7 Oktober 2026, project token frontend sudah diisi di `.env.local`, flag aktif dan ingest host US dikonfigurasi. Dua event sintetis (`screen_viewed` dan `$exception`, `setup_test=true`) dikirim langsung ke endpoint batch dan mendapat HTTP 200. Ini membuktikan request ingest diterima; belum membuktikan event tampil di dashboard, pengiriman dari browser/SDK, alert, atau simbolikasi stack. File `.env.local` diabaikan Git. Frontend dan API telah dideploy pada 7 Oktober 2026; lihat hasil produksi di bawah. Penerimaan event browser di dashboard dan alert tetap belum diverifikasi.

## Membuat project

1. Daftar/login di [PostHog](https://app.posthog.com/). Buat organisasi bila diperlukan dan project `Momong Production`. Buat project terpisah `Momong Development` untuk tes; jangan campur event tes dan produksi.
2. Pilih region sesuai kebutuhan penyimpanan data. Gunakan host ingest yang ditampilkan pada setup project: US `https://us.i.posthog.com`, EU `https://eu.i.posthog.com`. Region/key frontend dan API harus berasal dari project yang sama untuk lingkungan tersebut.
3. Salin **project token** (`phc_…`) dari project settings/setup. Token ingest ini memang terlihat di browser. Personal API key untuk administrasi tidak diperlukan oleh app dan tidak boleh ditaruh di frontend/repository/chat.
4. Lewati snippet instalasi generik dari dashboard: SDK sudah terpasang. Pertahankan autocapture, session replay, surveys dan exception autocapture nonaktif; app mengirim event yang telah difilter sendiri.
5. Atur akses anggota project seperlunya, batas penggunaan/billing, retention dan pengaturan geolocation/IP sebelum aktivasi. Jangan aktifkan person enrichment atau perekaman sesi untuk Momong tanpa peninjauan baru.

## Konfigurasi lokal

Isi `momong/.env.local` dengan project development:

```dotenv
VITE_POSTHOG_ENABLED=true
VITE_POSTHOG_KEY=<project-token-development>
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Isi environment API (file privat yang sudah dipakai untuk development, jangan commit):

```dotenv
POSTHOG_ENABLED=true
POSTHOG_KEY=<project-token-development>
POSTHOG_HOST=https://us.i.posthog.com
```

Ganti host ke EU jika project EU. Restart dev server/API setelah mengubah environment. Flag hanya aktif jika nilainya persis `true` dan key tidak kosong. Dengan flag kosong/false, browser tidak memuat SDK; API tetap menulis log teknis JSON ke stderr tanpa mengirim ke PostHog.

Jalankan dari masing-masing repository:

```sh
rtk npm run dev
```

Frontend memakai SDK chunk terpisah dan baru memuatnya sesudah izin pengguna. Izin default **nonaktif**. Setelah setup akun/guest, buka Profil → **Bantu tingkatkan Momong**, lalu aktifkan. Tidak ada banner yang otomatis menyetujui telemetry.

## Data yang dikirim

| Event | Asal | Properti dan kegunaan |
| --- | --- | --- |
| `screen_viewed` | Browser, sesudah izin | `screen`, `app=momong-web`, ID acak SDK/session; analisis navigasi umum |
| `$exception` | Browser, sesudah izin | `source=react/unhandled/rejection/api`, screen, jenis error yang diizinkan, pesan generik, nama bundle JS + nomor baris/kolom |
| `$exception` | Server, jika flag aktif | `app=momong-api`, `source=http/billing`, route template, status, pesan teknis generik, frame src/dist yang aman bila tersedia |

Screen: `setup`, `/`, `/log`, `/insight`, `/profil`, `/pasangan`, `/plus`, `/masuk-akun`, `/masuk`, `/gabung`, `/kado-bersama`, `/tas`, `/pengingat`, `/laporan`, `/kado`. Screen di luar daftar menjadi `other`. Parameter query/hash tidak dikirim. Render StrictMode dan navigasi query pada screen yang sama tidak menambah event duplikat.

Browser tidak memanggil `identify`, tidak mengirim ID akun/household, nama, email, HPL, tanggal lahir, isi catatan, pengukuran medis, form, response/body/header API, token login/invite, URL/referrer atau breadcrumb. Filter `before_send` membuang properti SDK di luar daftar; pesan error mentah, function name dan source context dibuang. `person_profiles=never`, persistence memori, dan `ip=false` digunakan. Collector masih menerima koneksi jaringan pengguna; pengaturan ini bukan jaminan anonimitas penuh. Daftar screen tetap menunjukkan fitur yang digunakan.

ID browser tidak bertahan saat reload; analisis pengguna unik/retention lintas sesi dan funnel signup lintas redirect tidak tersedia. Tidak ada event detail log medis atau pembayaran. Penghentian izin mematikan capture berikutnya dan membersihkan referensi client; request yang sudah terkirim tidak dapat ditarik kembali. Izin tersimpan di perangkat/origin, bukan disinkronkan ke akun.

Server error memakai ID service `momong-api`, bukan ID pengguna. Browser opt-out tidak mengubah logging operasional server. Server mencatat semua respons HTTP >=500 serta kegagalan job reconciliation billing. Log JSON stderr tetap tersedia untuk systemd meski PostHog gagal. SDK melakukan pengiriman batch; SIGTERM/SIGINT memberi waktu flush hingga 3 detik. Pengiriman bersifat best effort, bukan audit trail transaksi.

## Dashboard awal

Buat dashboard **Momong — penggunaan & kesehatan**:

- **Navigasi harian**: Trends, event `screen_viewed`, total events per hari, filter `app=momong-web`, breakdown `screen`.
- **Sesi memakai log**: `screen_viewed` dengan `screen=/log`; gunakan sesi, jangan menyebutnya jumlah catatan tersimpan.
- **Setup ke penggunaan**: Funnel `screen_viewed(screen=setup)` → `screen_viewed(screen=/)` → `screen_viewed(screen=/log)`. Hanya mencakup sesi yang memberi izin sebelum setup; izin yang baru diberikan di Profil tidak mengisi ulang history.
- **Error browser**: `$exception`, filter `app=momong-web`, breakdown `source`/`screen`.
- **Error API**: `$exception`, filter `app=momong-api`, breakdown `route`/`status`.

Di **Error Tracking**, periksa issue browser dan API setelah event uji masuk. Pesan browser disamarkan sehingga issue tertentu dapat tergabung; frame bundle membantu penelusuran. Source map upload belum dikonfigurasi. Untuk MVP, cocokkan bundle/baris dengan artefak build yang sama. Jangan mengaktifkan source context/error payload mentah sekadar untuk mendapat detail tambahan.

Atur alert melalui UI PostHog setelah data uji ada: issue baru browser, error API 500/502/504, dan kegagalan `source=billing`. Mulai dengan ambang 5 error dalam 10 menit, lalu sesuaikan dengan traffic. Pengecualian penting: 503 pada checkout Plus yang sengaja nonaktif adalah expected release gate, bukan outage. Jika memilih alert >=500, keluarkan route checkout atau gunakan alert khusus status agar tidak bising. Kirim notifikasi ke alamat/channel milik tim yang dipilih pengguna; integrasi kanal belum dikonfigurasi.

## Verifikasi penerimaan

1. Jalankan app development dengan key development; sebelum memberi izin, periksa Network: tidak ada request PostHog dari app.
2. Aktifkan izin di Profil. Buka Beranda → Log → Profil. Di PostHog live events/activity, pastikan `screen_viewed` muncul dan hanya memuat properti yang diizinkan.
3. Untuk tes browser, di console development jalankan `setTimeout(() => { throw new Error('momong-test-only'); }, 0)` dan `Promise.reject(new Error('momong-test-only'))`. Pastikan `$exception` masuk dengan `source=unhandled`/`rejection`; nilai pesan asli tidak muncul.
4. Buka URL development dengan query dummy `#/gabung?invite=TEST_ONLY`; inspeksi payload agar token/query tidak masuk. Jangan memakai token sungguhan untuk smoke test.
5. Matikan izin. Navigasi dan ulangi error: tidak boleh ada capture baru. Nyalakan lagi dan pastikan capture kembali bekerja.
6. Uji API hanya di lingkungan development: buat kegagalan DB sementara pada endpoint terautentikasi `/me`, lalu pulihkan DB. Pastikan respons 500 generik, log JSON aman dan `$exception` dengan route template muncul. Jangan mematikan DB produksi untuk tes.
7. Uji alert dengan event development dan pastikan notifikasi sampai. Jangan menganggap konfigurasi tersimpan sebagai bukti pengiriman notifikasi.
8. Error yang tertangkap lalu ditangani pada screen selain HTTP >=500 tidak otomatis dilaporkan. Startup sebelum SDK siap, crash proses server, offline, blocker, dan force-kill dapat kehilangan event. Gunakan health monitoring/journald untuk melengkapi cakupan operasional.

## Aktivasi produksi dan rollback

Set environment frontend pada project Vercel Momong melalui akun/connector yang memang memiliki project. Gunakan project token **production** dan rebuild/redeploy karena Vite membekukan environment saat build. Preview/development harus memakai project terpisah. Untuk API VPS, isi environment privat service `/opt/momong-api`, build/deploy kode dan restart `momong-api` memakai alur deployment yang sudah ada. Jangan mengganti flag Plus/Midtrans atau konfigurasi OAuth saat melakukan ini.

Sesudah deployment, lakukan smoke test browser dan API, periksa payload aktual, lalu verifikasi dashboard/alert. Deployment produksi sudah dilakukan; batas verifikasinya dicatat di bawah.

Rollback frontend: `VITE_POSTHOG_ENABLED=false`, rebuild/redeploy. Rollback server: `POSTHOG_ENABLED=false`, restart service. Perubahan ini tidak menghapus event yang sudah tersimpan di PostHog; hapus melalui pengaturan project jika diperlukan. Switch izin browser tersembunyi saat konfigurasi nonaktif.

## Pemeriksaan lokal

```sh
# momong
rtk npm test
rtk npm run build
rtk git diff --check

# momong-api
rtk npm test
rtk npm run build
rtk git diff --check
```

Tes mencakup filter payload pribadi, frame stack aman, default tanpa izin, penghentian capture, opt-in ulang dan deduplikasi screen. SDK browser dimock pada tes lifecycle; ini tidak membuktikan layanan PostHog menerima event.

## Sumber

Dokumentasi terkini diambil melalui Context7 dari repositori SDK resmi: [PostHog JS](https://github.com/PostHog/posthog-js), [konfigurasi browser](https://github.com/PostHog/posthog-js/blob/main/packages/types/src/posthog-config.ts), [SDK Node](https://github.com/PostHog/posthog-js/tree/main/packages/node), dan [error tracking Node](https://github.com/PostHog/posthog-js/blob/main/packages/node/src/extensions/error-tracking/index.ts). API yang dipakai juga diperiksa terhadap type declarations versi dependency yang terpasang.

## Hasil deployment produksi — 7 Oktober 2026

- Frontend Vercel: `dpl_3FvFsUoe4HRPLm7Wua6e1sTQTxqL`, READY, target production. Domain `momong.evanyudis.com` dan `momong.vercel.app` sama-sama terpasang. Keduanya menyajikan bundle `index-CkZgBcyO.js` dengan isi identik terhadap build lokal yang diuji.
- Deployment menggunakan hasil build statis lokal (49 tes frontend lulus), tanpa commit baru. Build mengaktifkan PostHog dari konfigurasi lokal dan memaksa `VITE_PLUS_ENABLED=false`.
- Penyimpanan environment production Vercel melalui connector dan fallback CLI ditolak HTTP 403. Karena itu tiga variabel `VITE_POSTHOG_ENABLED`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` **belum tersimpan di project Vercel**. Release ini tetap berfungsi karena konfigurasi sudah masuk dalam bundle hasil build lokal. Sebelum deployment source/Git berikutnya, pemilik project perlu menambahkan tiga variabel tersebut ke environment Production melalui dashboard Vercel, memakai nilai dari `.env.local`; jangan menganggap token lokal otomatis masuk ke remote build.
- API: telemetry ditambahkan di atas snapshot source server aktif, dibuild di staging dan dites, kemudian dipasang dengan `posthog-node`. Perubahan email waitlist/schema dari pekerjaan lain di workspace tidak dimasukkan. Tidak ada migrasi database baru pada release telemetry ini. Seluruh 23 tes API workspace juga lulus; staging produksi menjalankan build dan tes payload telemetry.
- Backup API/source/package/environment: `/opt/momong-api/release-backups/posthog-20261007T012826Z/`. Backup environment tetap privat. Restart service berhasil, log startup normal, endpoint publik `/health` dan `/health/db` HTTP 200. `/me` melalui domain frontend menolak request tanpa autentikasi dengan 401.
- Flag server PostHog aktif dengan host US; Plus, Midtrans production dan kedua recurring methods tetap false.
- Smoke test SDK server menghasilkan event `$exception` sintetis untuk route `/telemetry/setup-check`, status 500, dan endpoint ingest PostHog menjawab HTTP 200. Event ini adalah pengujian setup, bukan outage aplikasi.
- Chrome berhasil merender halaman login pada domain utama. Browser dalam app berhasil merender Profil pada `momong.vercel.app`, menjalankan toggle izin dan navigasi Beranda/Profil tanpa console error yang teramati. Izin pada browser pengujian dikembalikan ke nonaktif. Browser dalam app tampil kosong pada domain utama; masalah ini tidak terulang di Chrome, sehingga verifikasi domain utama memakai Chrome. Tidak ada data lokal pengguna yang dihapus untuk mengatasi cache/browser.
- Bukti UI: `.playwright-mcp/posthog-production-main.png` dan `.playwright-mcp/posthog-production.png`. Penerimaan event dari browser di dashboard, alert, simbolikasi stack, dan auth/sync end-to-end pada release ini belum diuji ulang.

Rollback frontend ke deployment sebelumnya: `dpl_h9d9L6bAzWoZnrx1VkA3QPeqxYdi` melalui dashboard/connector. Untuk API, pulihkan dist/source/package/environment dari backup tersebut, instal ulang dependency yang cocok dan restart service. Jangan mengembalikan database atau menghapus catatan untuk rollback telemetry.

### Environment Vercel tersimpan — 7 Oktober 2026

Pemeriksaan langsung dashboard project `momong` mengonfirmasi `VITE_POSTHOG_ENABLED`, `VITE_POSTHOG_KEY`, dan `VITE_POSTHOG_HOST` tersedia sebagai Config untuk Production. Host yang terlihat adalah `https://us.i.posthog.com`. Token tidak dibuka; kecocokan nilai token dengan konfigurasi lokal belum diverifikasi. Nilai flag masih tertutup karena tombol reveal tidak menyelesaikan pemuatan saat pemeriksaan. Connector read environment masih mengembalikan 403, sehingga verifikasi keberadaan/scope dilakukan lewat dashboard pengguna. Catatan sebelumnya tentang variabel belum tersimpan sudah digantikan oleh pemeriksaan ini. Deployment aktif tetap build lokal yang sudah dipublikasikan; perubahan environment dashboard berlaku untuk build berikutnya.

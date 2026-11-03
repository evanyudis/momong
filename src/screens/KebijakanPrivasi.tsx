import { TopBar } from "../ui";

/** Isi statis dari momong-legal/kebijakan-privasi-v2.md. */
export const PRIVACY_SOURCE = "kebijakan-privasi-v2";
export const PRIVACY_HREF = "#/kebijakan-privasi";

const EMAIL = "contact.evanyudis@gmail.com";
const SUMOPOD_PRIVACY = "https://sumopod.com/privacy-policy";

export function KebijakanPrivasi() {
  return <>
    <TopBar title="Kebijakan Privasi" back="#/profil" />
    <div className="stack legal">
      <article className="card solid stack" aria-labelledby="kebijakan-privasi">
        <h1 id="kebijakan-privasi">Kebijakan Privasi Momong</h1>
        <p className="muted">Berlaku sejak: 3 November 2026 · Versi: <code>privasi-v1</code></p>
        <p>Halo! Momong dipakai untuk mencatat hal yang sangat pribadi: kehamilan, kontraksi, gerakan janin, dan keseharian si kecil. Di sini kami jelaskan apa saja yang kami simpan, di mana, untuk apa, dan apa hakmu. Kami menulisnya sesuai <strong>UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>.</p>

        <h2>1. Siapa yang mengelola datamu</h2>
        <p>Pengendali data pribadi Momong adalah <strong>Aditya Evan Yudistira</strong> ("kami"). Untuk pertanyaan, permintaan soal data, atau keluhan, email <strong>{EMAIL}</strong>.</p>

        <h2>2. Pakai tanpa akun: data tetap di perangkatmu</h2>
        <p>Fitur inti Momong bisa dipakai tanpa login. Selama kamu tidak masuk akun, semua catatan disimpan di penyimpanan browser di perangkatmu dan <strong>tidak dikirim ke server kami</strong>. Ini termasuk:</p>
        <ul>
          <li>HPL atau tanggal lahir, nama panggilanmu, nama si kecil;</li>
          <li>kontraksi, gerakan janin, gejala dan catatannya;</li>
          <li>menyusu langsung, botol, pumping, popok;</li>
          <li>daftar tas rumah sakit, wishlist, pengingat, tema, dan pengaturan lain.</li>
        </ul>
        <p>Pengingat berjalan di perangkat. Kalau kamu mengizinkan notifikasi, notifikasinya dibuat oleh browser di perangkatmu, bukan dikirim dari server. Laporan PDF dan file cadangan (JSON) juga dibuat di perangkatmu.</p>
        <p>Data ini hilang kalau kamu menghapus data browser, meng-uninstall aplikasi, atau menekan "Hapus semua data di perangkat" di Profil. Kami tidak bisa memulihkannya.</p>

        <h2>3. Kalau kamu membuat akun</h2>
        <p><strong>Data akun.</strong></p>
        <ul>
          <li><strong>Email dan password.</strong> Password disimpan dalam bentuk hash (teracak satu arah), tidak pernah dalam bentuk aslinya.</li>
          <li><strong>Masuk dengan Google.</strong> Kami menerima nama, email, dan foto profil dari akun Googlemu, plus token akses dari Google yang disimpan di server. Kami tidak meminta akses ke Gmail, Drive, atau kontakmu.</li>
          <li><strong>Tautan masuk lewat email</strong> (kalau dipakai) berlaku 15 menit.</li>
          <li><strong>Sesi login.</strong> Untuk menjaga kamu tetap masuk dan mendeteksi penyalahgunaan, server mencatat token sesi, waktu kedaluwarsa, jenis browser atau perangkat, dan kadang alamat IP.</li>
        </ul>
        <p><strong>Catatan yang disinkronkan.</strong> Setelah kamu masuk dan mengaktifkan Sinkron (atau bergabung dengan pasangan), catatan dari pasal 2 dikirim ke server supaya bisa dipakai di beberapa perangkat dan bersama pasangan. Sebelum itu, catatan tetap di perangkat. Catatan yang kamu hapus disimpan sebagai penanda "terhapus" tanpa isi, supaya perangkat lain ikut menghapusnya.</p>
        <p><strong>Keluarga (household) dan pasangan.</strong> Satu household berisi maksimal 2 orang. Anggota household bisa melihat <strong>nama dan email</strong> satu sama lain, dan semua catatan di household itu. Undangan pasangan memakai tautan berkode yang ada batas waktunya.</p>
        <p><strong>Wishlist bersama (Plus).</strong> Kalau kamu membagikan wishlist, siapa pun yang punya tautannya bisa melihat daftar barangnya. Orang yang memilih kado menuliskan <strong>nama</strong> mereka, dan nama itu tersimpan dan terlihat olehmu. Tautan berlaku 7 hari dan bisa kamu cabut kapan saja.</p>

        <h2>4. Pembayaran Momong Plus</h2>
        <ul>
          <li>Pembayaran diproses oleh <strong>Sumopod</strong> lewat <strong>QRIS</strong>. Kamu membayar di halaman Sumopod dengan e-wallet atau m-banking.</li>
          <li>Ke Sumopod kami hanya mengirim nomor order, nominal, mata uang, metode (QRIS), dan alamat kembali ke aplikasi. <strong>Kami tidak mengirim nama atau emailmu ke Sumopod.</strong></li>
          <li>Momong <strong>tidak pernah menerima atau menyimpan</strong> data kartu, nomor rekening, saldo, atau PIN.</li>
          <li>Yang kami simpan: nomor order, paket, nominal, status, waktu bayar dan masa berlaku, ID transaksi dari Sumopod, serta akun dan household yang membeli. Untuk Plus Bulanan, kami juga mencatat waktu dan versi persetujuanmu atas syarat perpanjangan manual.</li>
          <li>Notifikasi pembayaran dari Sumopod diverifikasi tanda tangannya. Dari notifikasi itu kami hanya menyimpan ID event dan waktu terima, untuk mencegah proses ganda.</li>
          <li>Untuk refund, kami meminta nomor rekening atau e-wallet tujuan lewat email. Data ini hanya dipakai untuk transfer refund.</li>
        </ul>

        <h2>5. Statistik dan laporan error (opsional)</h2>
        <p>Di Profil ada pilihan <strong>"Bantu tingkatkan Momong"</strong>. Defaultnya <strong>mati</strong>. Kalau kamu nyalakan, aplikasi mengirim ke <strong>PostHog</strong> (server di Amerika Serikat):</p>
        <ul>
          <li>halaman yang dibuka (dari daftar tetap, misalnya Beranda, Log, Insight);</li>
          <li>laporan error teknis tanpa isi pesan aslinya.</li>
        </ul>
        <p>Yang <strong>tidak</strong> dikirim: nama, email, ID akun, HPL, tanggal lahir, isi catatan, data kesehatan, atau data pembayaran. ID acaknya tidak bertahan setelah halaman dimuat ulang. Kamu bisa mematikannya kapan saja; data yang sudah terkirim tidak bisa ditarik.</p>
        <p>Terlepas dari pilihan itu, server kami melaporkan error server ke PostHog dengan label layanan, bukan identitasmu. Kalau error terjadi saat memproses pembayaran, laporannya bisa memuat nomor order.</p>

        <h2>6. Email</h2>
        <ul>
          <li>Email dikirim lewat <strong>Resend</strong>, misalnya tautan masuk dan kabar layanan yang penting.</li>
          <li>Kalau kamu daftar waitlist di situs Momong, emailmu disimpan di Listmonk yang berjalan di server kami sendiri, dan pengirimannya lewat Resend. Email kampanye selalu punya tautan berhenti berlangganan.</li>
          <li>Kami tidak mengirim iklan pihak ketiga dan tidak menjual daftar email.</li>
        </ul>

        <h2>7. Untuk apa data dipakai, dan dasarnya</h2>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th scope="col">Tujuan</th><th scope="col">Dasar (UU PDP Pasal 20)</th></tr></thead>
            <tbody>
              <tr><td>Akun, login, sinkron, berbagi dengan pasangan</td><td>Persetujuanmu dan pelaksanaan perjanjian (S&K)</td></tr>
              <tr><td>Menyimpan data kehamilan dan kesehatan bayi di server</td><td><strong>Persetujuan eksplisit</strong>: kamu sendiri yang mengaktifkan Sinkron</td></tr>
              <tr><td>Memproses dan membuktikan pembayaran, refund</td><td>Pelaksanaan perjanjian dan kewajiban hukum</td></tr>
              <tr><td>Keamanan dan pencegahan penyalahgunaan</td><td>Kepentingan yang sah</td></tr>
              <tr><td>Statistik dan error dari aplikasi</td><td>Persetujuan, bisa dicabut di Profil</td></tr>
            </tbody>
          </table>
        </div>
        <p>Data kami <strong>tidak dijual</strong>, <strong>tidak dipakai untuk iklan</strong>, dan <strong>tidak dipakai untuk melatih model AI</strong>.</p>

        <h2>8. Data kesehatan dan data anak</h2>
        <ul>
          <li><strong>Data kesehatan.</strong> Catatan kehamilan, kontraksi, gerakan janin, gejala, menyusu, dan popok adalah data kesehatan, yang menurut UU PDP termasuk <strong>data pribadi yang bersifat spesifik</strong>. Karena itu data ini hanya disimpan di server kalau kamu mengaktifkan Sinkron, hanya bisa dilihat anggota household-mu, dan hanya dipakai untuk menjalankan Momong.</li>
          <li><strong>Data anak.</strong> Momong menyimpan data tentang bayi atau anak (nama, tanggal lahir, catatan harian) yang dimasukkan oleh orang tua atau walinya. Dengan memasukkan data itu, kamu menyatakan bahwa kamu orang tua atau wali si anak.</li>
          <li>Momong ditujukan untuk pengguna dewasa. Kalau kamu berusia di bawah 18 tahun, pakai Momong bersama dan dengan persetujuan orang tua atau walimu.</li>
        </ul>

        <h2>9. Di mana data disimpan dan siapa yang membantu kami</h2>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th scope="col">Pihak</th><th scope="col">Untuk apa</th><th scope="col">Lokasi</th></tr></thead>
            <tbody>
              <tr><td>Tencent Cloud (VPS)</td><td>Server API dan database PostgreSQL yang kami kelola sendiri, termasuk cadangan harian</td><td>Jakarta, Indonesia</td></tr>
              <tr><td>Vercel</td><td>Menyajikan aplikasi web dan meneruskan permintaan aplikasi ke server API</td><td>Global (CDN)</td></tr>
              <tr><td>Cloudflare</td><td>Jalur aman (tunnel) dari internet ke server kami</td><td>Global</td></tr>
              <tr><td>Google</td><td>Masuk dengan Google, hanya kalau kamu memilihnya</td><td>Amerika Serikat dan lainnya</td></tr>
              <tr><td>Sumopod</td><td>Payment gateway QRIS</td><td>Diproses Sumopod (PT Koding Kreasi Indonesia) sesuai <a className="inline-link" href={SUMOPOD_PRIVACY} target="_blank" rel="noopener noreferrer">kebijakan privasinya</a>; lokasinya tidak dicantumkan di sana</td></tr>
              <tr><td>Resend</td><td>Pengiriman email</td><td>Amerika Serikat</td></tr>
              <tr><td>PostHog</td><td>Statistik opsional dan laporan error</td><td>Amerika Serikat</td></tr>
            </tbody>
          </table>
        </div>
        <p>Vercel dan Cloudflare meneruskan data dalam perjalanan antara perangkatmu dan server kami, termasuk isi sinkron, tapi tidak menyimpannya sebagai database. Sebagian pihak di atas berada di luar Indonesia. Kami hanya membagikan yang perlu untuk tugas masing-masing, dan memilih layanan yang menerapkan perlindungan data yang memadai.</p>

        <h2>10. Berapa lama data disimpan</h2>
        <ul>
          <li><strong>Data di perangkat:</strong> sampai kamu menghapusnya.</li>
          <li><strong>Akun dan catatan sinkron:</strong> selama akunmu ada, termasuk setelah Plus berakhir. Saat akun dihapus, data akun, keanggotaan household, dan catatan household yang hanya berisi kamu ikut dihapus. Catatan order pembayaran tidak dihapus, tapi dianonimkan (dilepas dari akun dan identitasmu), lihat poin berikut.</li>
          <li><strong>Data pembayaran:</strong> catatan order dan transaksi disimpan selama <strong>10 tahun</strong> untuk memenuhi kewajiban pembukuan dan perpajakan, juga setelah akun dihapus. Setelah akun dihapus, order itu dianonimkan: tidak lagi terhubung ke akun, email, atau namamu. Data rekening atau e-wallet untuk refund hanya dipakai untuk transfer itu.</li>
          <li><strong>Cadangan server:</strong> dibuat setiap hari dan disimpan <strong>14 hari</strong>, lalu terhapus otomatis. Data yang sudah kamu hapus bisa masih ada di cadangan sampai masa itu lewat.</li>
          <li><strong>Log teknis server:</strong> disimpan <strong>30 hari</strong> untuk keperluan operasional dan keamanan, lalu terhapus otomatis.</li>
          <li><strong>Tautan masuk:</strong> 15 menit. <strong>Tautan wishlist bersama:</strong> 7 hari.</li>
        </ul>

        <h2>11. Hak kamu</h2>
        <p>Sesuai UU PDP, kamu berhak:</p>
        <ol>
          <li><strong>Mengakses</strong> data pribadimu dan mendapat salinannya.</li>
          <li><strong>Memperbaiki</strong> data yang salah atau tidak lengkap. Sebagian bisa langsung kamu ubah di Profil.</li>
          <li><strong>Menghapus</strong> akun dan datamu.</li>
          <li><strong>Mengekspor</strong> datamu dalam format yang umum dipakai. Catatan di perangkat bisa kamu simpan sendiri sebagai file cadangan JSON atau laporan PDF. Untuk data di server, minta lewat email.</li>
          <li><strong>Menarik persetujuan</strong> kapan saja: matikan "Bantu tingkatkan Momong", keluar dari household, atau minta akunmu dihapus. Menarik persetujuan tidak membatalkan pemrosesan yang sudah terjadi sebelumnya.</li>
          <li><strong>Mengajukan keberatan</strong> atas pemrosesan tertentu, dan mengadu ke lembaga pelindungan data pribadi yang berwenang.</li>
        </ol>
        <p>Caranya: email <strong>{EMAIL}</strong> dari email yang terdaftar di akun Momong, dengan subjek <strong>"Privasi Momong"</strong> dan apa yang kamu minta. Kami mungkin meminta konfirmasi untuk memastikan itu memang kamu. Kami tanggapi paling lambat <strong>3 x 24 jam</strong>. Akses dan koreksi kami selesaikan dalam waktu itu. Penghapusan akun kami selesaikan paling lama <strong>14 hari kerja</strong>. Catatan order pembayaran dianonimkan, bukan dihapus (lihat pasal 10).</p>
        <p>Menghapus akun tidak menghapus catatan yang masih ada di perangkatmu, dan tidak otomatis mengembalikan dana Plus. Kalau kamu anggota household orang lain, catatan bersama tetap ada di household itu setelah kamu keluar.</p>

        <h2>12. Keamanan</h2>
        <ul>
          <li>Semua koneksi memakai HTTPS.</li>
          <li>Server API dan database tidak terbuka langsung ke internet. Permintaan masuk lewat tunnel Cloudflare.</li>
          <li>Password di-hash. Kunci layanan disimpan di server dan tidak pernah dikirim ke aplikasi.</li>
          <li>Akses ke database dan cadangan dibatasi untuk pengelola Momong.</li>
        </ul>
        <p>Tidak ada sistem yang 100% aman. Kalau terjadi kebocoran yang menyangkut datamu, kami beri tahu kamu dan lembaga yang berwenang paling lambat <strong>3 x 24 jam</strong> setelah kami mengetahuinya.</p>

        <h2>13. Perubahan kebijakan</h2>
        <p>Kalau kebijakan ini berubah, kami kabari lewat aplikasi atau email paling lambat 14 hari sebelum berlaku. Kalau perubahannya menyangkut tujuan baru untuk data kesehatan, kami minta persetujuanmu lagi.</p>

        <h2>14. Kontak</h2>
        <p>Aditya Evan Yudistira, pengelola Momong. Email: <strong>{EMAIL}</strong>.</p>
      </article>

      <a className="btn btn-soft block" href="#/syarat-ketentuan">Baca Syarat & Ketentuan</a>
    </div>
  </>;
}

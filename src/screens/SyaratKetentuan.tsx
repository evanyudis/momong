import type { ReactNode } from "react";
import { TopBar } from "../ui";
import { PRIVACY_HREF } from "./KebijakanPrivasi";

/** Isi statis dari momong-legal/syarat-refund-v2.md. Placeholder sengaja tetap terlihat sebagai TODO sampai Evan mengisinya. */
export const TERMS_SOURCE = "syarat-refund-v2";

function Todo({ children }: { children: ReactNode }) {
  return <span className="pill coral legal-todo">TODO: {children}</span>;
}

const EMAIL = "contact.evanyudis@gmail.com";

export function SyaratKetentuan() {
  return <>
    <TopBar title="Syarat & Ketentuan" back="#/plus" />
    <div className="stack legal">
      <p className="pill coral legal-todo" role="note">TODO: Draf v2, belum dipublikasikan, bukan nasihat hukum. Sisa placeholder diisi saat publish.</p>

      <article className="card solid stack" aria-labelledby="syarat-plus">
        <h1 id="syarat-plus">Syarat & Ketentuan Momong Plus</h1>
        <p className="muted">Berlaku sejak: 3 November 2026 · Versi: <code>plus-v1</code></p>
        <p>Halo! Ini aturan main Momong Plus, kami buat sesingkat dan sejelas mungkin. Dengan membeli Plus, kamu setuju dengan syarat di bawah.</p>

        <h2>1. Siapa kami</h2>
        <p>Momong dikelola oleh Aditya Evan Yudistira ("kami"). Ada pertanyaan? Email kami di <strong>{EMAIL}</strong>.</p>

        <h2>2. Momong bukan alat medis</h2>
        <p>Momong membantu kamu mencatat, misalnya kontraksi, gerakan janin, menyusu, pumping, dan popok. Perkiraan dan grafik di Momong dihitung dari catatanmu sendiri, jadi hasilnya <strong>bukan diagnosis dan bukan saran medis</strong>.</p>
        <p>Kalau ada yang terasa tidak biasa, misalnya gerakan janin berkurang, ada perdarahan, atau kontraksi yang bikin khawatir, <strong>langsung hubungi bidan, dokter, atau fasilitas kesehatan terdekat</strong>. Tidak perlu menunggu aplikasi.</p>

        <h2>3. Yang tetap gratis</h2>
        <p>Fitur inti gratis selamanya, bisa dipakai tanpa login, dan datanya tersimpan di perangkatmu:</p>
        <ul>
          <li>hitung mundur HPL,</li>
          <li>timer kontraksi,</li>
          <li>penghitung gerakan janin,</li>
          <li>daftar tas rumah sakit,</li>
          <li>dark mode.</li>
        </ul>
        <p>Plus tidak akan mengunci fitur-fitur ini.</p>

        <h2>4. Isi Momong Plus</h2>
        <p>Plus menambahkan:</p>
        <ul>
          <li>perkiraan menyusu (bukan penilaian klinis);</li>
          <li>pengingat yang kamu atur sendiri (berjalan selama aplikasi terbuka);</li>
          <li>grafik harian;</li>
          <li>riwayat lengkap lebih dari 30 hari (di versi gratis, riwayat menyusu langsung, pumping, dan popok hanya tampil 30 hari terakhir; data lamanya disembunyikan, tidak dihapus);</li>
          <li>unduh PDF laporan tanpa batas;</li>
          <li>wishlist bersama;</li>
          <li>profil untuk lebih dari satu bayi.</li>
        </ul>
        <p>Fitur Plus butuh akun. Pembelianmu tercatat di server kami, bukan cuma di perangkat.</p>
        <p><strong>Household / pasangan.</strong> Satu Plus berlaku untuk satu household, isinya maksimal <strong>2 orang</strong>: kamu dan satu pasangan atau pendamping. Pemilik household bisa mengeluarkan pasangan kapan saja, dan pasangan juga bisa keluar sendiri. Setelah keluar, pasangan tidak lagi dapat akses Plus dari household itu. Catatan yang sudah dibuat bersama tetap ada di household tersebut.</p>

        <h2>5. Harga dan paket</h2>
        <div className="legal-table-wrap">
          <table className="legal-table">
            <thead><tr><th scope="col">Paket</th><th scope="col">Harga</th><th scope="col">Masa berlaku</th></tr></thead>
            <tbody>
              <tr><td>Plus Bulanan</td><td><strong>Rp39.000 / bulan</strong></td><td>1 bulan kalender sejak pembayaran berhasil</td></tr>
              <tr><td>Plus Selamanya</td><td><strong>Rp199.000 sekali bayar</strong></td><td>Selama Momong Plus masih beroperasi (lihat pasal 8)</td></tr>
            </tbody>
          </table>
        </div>
        <p>Harga sudah termasuk biaya transaksi, jadi tidak ada biaya tambahan saat checkout. Kalau harga berubah, harga baru hanya berlaku untuk pembelian berikutnya, bukan untuk periode yang sudah kamu bayar.</p>

        <h2>6. Cara bayar</h2>
        <ul>
          <li>Pembayaran diproses oleh <strong>Sumopod</strong>, payment gateway pihak ketiga, lewat <strong>QRIS</strong>. Kamu bisa bayar pakai e-wallet atau m-banking apa pun yang mendukung QRIS.</li>
          <li>Setiap pembelian punya satu link pembayaran, dan link ini <strong>ada batas waktunya</strong>. Kalau sudah kedaluwarsa, buat link baru dari aplikasi. Jangan bayar lewat link lama.</li>
          <li>Momong <strong>tidak pernah menyimpan</strong> data kartu, rekening, atau PIN kamu. Yang kami terima hanya status pembayaran (berhasil, gagal, atau kedaluwarsa), nomor order, nominal, dan waktu bayar.</li>
          <li>Plus aktif otomatis begitu Sumopod mengonfirmasi pembayaran, biasanya dalam hitungan detik. Kalau sudah bayar tapi Plus belum aktif lebih dari 1 jam, email kami dan sertakan bukti bayar.</li>
        </ul>

        <h2>7. Plus Bulanan: perpanjangan manual</h2>
        <ul>
          <li><strong>Tidak ada potong saldo otomatis.</strong> Tiap bulan kamu bayar sendiri lewat link QRIS baru.</li>
          <li>Sekitar <strong>3 hari sebelum</strong> periode berakhir, link perpanjangan sudah siap di aplikasi.</li>
          <li>Kalau kamu bayar sebelum periode habis, periode baru langsung menyambung dari tanggal berakhir yang lama. Hari yang sudah dibayar tidak hilang.</li>
          <li>Kalau tidak dibayar, Plus berhenti tepat di akhir periode. <strong>Tidak ada masa tenggang.</strong> Kalau kamu bayar setelah itu, periode 1 bulan yang baru dimulai dari tanggal bayar.</li>
          <li>Mau berhenti? Cukup jangan bayar link berikutnya, atau tekan "Hentikan perpanjangan" di halaman Plus. Akses tetap jalan sampai akhir periode yang sudah dibayar.</li>
        </ul>

        <h2>8. Plus Selamanya</h2>
        <p>"Selamanya" artinya <strong>selama Momong Plus masih kami jalankan</strong>, bukan seumur hidupmu atau tanpa batas sama sekali. Plus Selamanya juga tidak bisa dipindahkan ke household lain.</p>
        <p>Kalau suatu saat Momong Plus dihentikan:</p>
        <ul>
          <li>kami umumkan paling lambat <strong>90 hari</strong> sebelumnya lewat aplikasi dan email;</li>
          <li>kamu bisa <strong>mengekspor semua datamu</strong> sebelum layanan ditutup;</li>
          <li>fitur yang bisa jalan tanpa server tetap bisa dipakai di perangkatmu sebisa mungkin.</li>
        </ul>

        <h2>9. Saat Plus berakhir</h2>
        <ul>
          <li>Fitur gratis tetap jalan seperti biasa.</li>
          <li>Datamu <strong>tidak kami hapus</strong>. Catatan yang lebih lama dari 30 hari disembunyikan, lalu muncul lagi kalau kamu aktifkan Plus kembali.</li>
          <li>Data cloud akun yang Plus-nya sudah berakhir tetap kami simpan selama akunnya masih ada.</li>
          <li>Tautan wishlist bersama tidak bisa dibuka orang lain sampai Plus aktif lagi.</li>
        </ul>

        <h2>10. Akun dan hapus data</h2>
        <ul>
          <li>Kamu bisa minta datamu dilihat, dikoreksi, atau dihapus lewat email di pasal 1. Kami proses paling lama <strong>14 hari kerja</strong>.</li>
          <li>Menghapus akun <strong>tidak otomatis mengembalikan dana</strong> Plus yang masih berjalan. Kalau perlu, ajukan refund dulu (lihat Kebijakan Refund).</li>
          <li>Catatan yang hanya ada di perangkatmu tetap di sana sampai kamu hapus sendiri, misalnya dengan menghapus data browser atau aplikasinya.</li>
        </ul>

        <h2>11. Data pribadi</h2>
        <p>Kami memproses data pribadi sesuai <strong>UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)</strong>. Data kehamilan dan kesehatan bayi termasuk data pribadi yang bersifat spesifik, jadi hanya kami pakai untuk menjalankan fitur Momong. Data ini tidak kami jual dan tidak dipakai untuk iklan.</p>
        <p>Data akun dan sync disimpan di server PostgreSQL yang kami kelola sendiri, di VPS Tencent Cloud di Jakarta. Penjelasan lengkapnya ada di <a className="inline-link" href={PRIVACY_HREF}>Kebijakan Privasi</a>.</p>

        <h2>12. Pemakaian yang wajar</h2>
        <p>Jangan menyalahgunakan Momong, misalnya membobol akun orang lain, mengganggu server, atau menjual ulang akses Plus. Kalau itu terjadi, kami bisa menangguhkan akun. Kalau ternyata penangguhan itu bukan karena kesalahanmu, sisa periode Plus yang sudah dibayar kami kembalikan.</p>

        <h2>13. Batas tanggung jawab</h2>
        <p>Kami berusaha supaya Momong selalu bisa dipakai, tapi sesekali bisa ada gangguan atau perawatan. Sejauh diizinkan hukum, tanggung jawab kami atas Plus paling banyak sebesar yang kamu bayar untuk Plus dalam 12 bulan terakhir. Ini tidak mengurangi hakmu sebagai konsumen menurut <strong>UU No. 8 Tahun 1999 tentang Perlindungan Konsumen</strong>.</p>

        <h2>14. Perubahan syarat</h2>
        <p>Kalau syarat ini berubah, kami kabari lewat aplikasi atau email paling lambat 14 hari sebelum berlaku. Perubahan yang merugikan kamu tidak berlaku untuk periode yang sudah dibayar.</p>

        <h2>15. Hukum dan sengketa</h2>
        <p>Syarat ini tunduk pada hukum Republik Indonesia. Kalau ada masalah, hubungi kami dulu, kita selesaikan baik-baik. Kalau belum selesai juga, kamu tetap bisa menempuh jalur yang tersedia untuk konsumen, misalnya BPSK atau pengadilan negeri <Todo>domisili pengadilan</Todo>.</p>
      </article>

      <article className="card solid stack" aria-labelledby="kebijakan-refund">
        <h1 id="kebijakan-refund">Kebijakan Refund Momong Plus</h1>
        <p className="muted">Berlaku sejak: 3 November 2026 · Versi: <code>refund-v1</code></p>

        <h2>1. Garansi 7 hari</h2>
        <ul>
          <li><strong>Plus Selamanya:</strong> refund penuh kalau kamu minta dalam <strong>7 hari</strong> sejak pembayaran, tanpa perlu alasan. Berlaku satu kali per household.</li>
          <li><strong>Plus Bulanan:</strong> refund penuh untuk <strong>pembayaran bulanan pertama</strong> kalau diminta dalam <strong>3 hari</strong>. Perpanjangan bulan berikutnya tidak di-refund, tapi kamu bisa berhenti kapan saja.</li>
          <li>Lewat dari masa itu, refund hanya untuk kasus di pasal 2.</li>
        </ul>

        <h2>2. Kasus yang selalu kami refund</h2>
        <ol>
          <li><strong>Bayar dobel.</strong> Misalnya kamu membayar dua link untuk periode yang sama, atau membayar Plus Bulanan padahal household-mu sudah punya Plus Selamanya. Sistem kami otomatis menandai pembayaran seperti ini, lalu kami hubungi kamu dan kembalikan kelebihannya.</li>
          <li><strong>Sudah bayar tapi Plus tidak aktif,</strong> dan kami tidak bisa membereskannya dalam 3 hari kerja.</li>
          <li><strong>Nominal tidak cocok.</strong> Kalau jumlah yang tercatat beda dengan harga, pembayaran kami tahan dan cek manual. Setelah itu kami hubungi kamu untuk mengaktifkan Plus atau mengembalikan dana.</li>
          <li><strong>Kesalahan teknis dari pihak kami</strong> yang bikin kamu ditagih tidak semestinya.</li>
        </ol>

        <h2>3. Yang tidak di-refund</h2>
        <ul>
          <li>Periode bulanan yang sedang berjalan, setelah lewat masa garansi.</li>
          <li>Akun yang ditangguhkan karena pelanggaran di S&K pasal 12.</li>
        </ul>

        <h2>4. Cara minta refund</h2>
        <ol>
          <li>Kirim email ke <strong>{EMAIL}</strong> dengan subjek <strong>"Refund Momong Plus"</strong>.</li>
          <li>Sertakan:
            <ul>
              <li>email akun Momong;</li>
              <li>nomor order (diawali <code>bb-</code>, ada di halaman Plus atau bukti bayar);</li>
              <li>waktu bayar;</li>
              <li>nomor rekening atau e-wallet tujuan refund, plus nama pemiliknya.</li>
            </ul>
          </li>
          <li>Kami balas dalam <strong>2 hari kerja</strong>.</li>
        </ol>

        <h2>5. Proses dan waktu</h2>
        <ul>
          <li>Sumopod belum punya refund otomatis, jadi <strong>refund kami proses manual</strong> dan dananya kami transfer ke rekening atau e-wallet yang kamu berikan.</li>
          <li>Dana sampai paling lambat <strong>7 hari kerja</strong> setelah permintaan disetujui.</li>
          <li>Jumlahnya <strong>penuh sesuai yang kamu bayar</strong>. Biaya transaksi Sumopod kami yang tanggung.</li>
          <li>Setelah refund, akses Plus dari pembayaran itu dicabut. Datamu tidak dihapus.</li>
        </ul>

        <h2>6. Kontak</h2>
        <p>Ada pertanyaan soal tagihan? Email <strong>{EMAIL}</strong>.</p>
      </article>

      <a className="btn btn-soft block" href="#/plus">Kembali ke Plus</a>
    </div>
  </>;
}

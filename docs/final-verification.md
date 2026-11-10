# Verifikasi Final Pantau Bergizi

Pembaruan 11 November 2026. [PRD dan checklist penerimaan](../PRD_Pantau_Bergizi_V2_1.md#yang-harus-diverifikasi-sebelum-final) · [Tracker fitur #10](https://github.com/MakeAnythingg/pantau-bergizi/issues/10) · [Pengumpulan #9](https://github.com/MakeAnythingg/pantau-bergizi/issues/9)

## Status fitur

- #3, #4, #5, #6, dan #8 ditutup di GitHub. Hasil uji skala lima alur ada di [README](../README.md#bukti-skala-nasional).
- #7 sudah masuk ke `main`. Halaman Data dan Metode tersedia di deployment. Catat persetujuan teks Indonesia dari Praffi sebelum menutup issue. Teks Metode ditulis ulang menjadi Tanya Pantau di #19, jadi persetujuan juga mencakup teks itu. [Issue #7](https://github.com/MakeAnythingg/pantau-bergizi/issues/7) · [PR #15](https://github.com/MakeAnythingg/pantau-bergizi/pull/15)
- #9 mencakup pengumpulan berkas lomba, uji pengguna di HP, dan verifikasi pada deployment.
- #19 mendesain ulang tampilan seluruh aplikasi dan sudah masuk ke `main`. [PR #19](https://github.com/MakeAnythingg/pantau-bergizi/pull/19)

## Pengecekan 11 November

Desain ulang dari #19 masuk ke `main` sebagai `0bef1ac` dan ter-deploy otomatis. Pada head PR (`2821e8e`), `bun run check` lulus dengan 101 tes, dan 22 tes Playwright lulus, termasuk tes baru untuk jalur Lapor dari header dan pencarian sekolah. #19 tidak menambah migrasi, jadi database produksi tidak perlu dimigrasi. Setelah deploy, Beranda, Lacak, Metode, Rapor SPPG Melati 01, dan formulir lapor SDN Harapan 1 menjawab HTTP 200 di deployment publik, dan header memuat tautan Lapor. Skenario pada tabel di bawah belum diulang pada tampilan baru. [Commit merge](https://github.com/MakeAnythingg/pantau-bergizi/commit/0bef1ac0912d5bab5819af851e706e0fd35cf979) · [Screenshot sebelum dan sesudah](https://github.com/MakeAnythingg/pantau-bergizi/pull/19)

## Pengecekan 10 November

Pada kode aplikasi yang sama dengan `main` (`fbbf1a4`), `bun run check` lulus, termasuk 101 tes unit dan integrasi dengan PostgreSQL lokal. Build produksi menghasilkan `/data` dan `/metode` sebagai halaman statis. Seluruh 21 tes Playwright lulus pada build tersebut dengan database simulasi lokal dan kunci uji Turnstile. [Commit acuan](https://github.com/MakeAnythingg/pantau-bergizi/commit/fbbf1a4)

Uji tambahan pada build lokal memakai emulasi Pixel 7. Penilaian untuk SDN Dahlia 1 berhasil dikirim saat izin lokasi tidak diberikan dan menu dapur belum diisi. Kode yang sama membuka laporan dari sesi browser baru setelah proses Next.js dimulai ulang dengan database yang sama.

Pada deployment publik, cek browser di lebar 390 px lulus untuk Beranda, Rapor Melati dan Dahlia, halaman QR sekolah, formulir pengalaman menu, Lacak, Data, dan Metode. Rapor Dahlia menampilkan “Belum ada data” dan “Sisa makanan: Data belum cukup”. Pengunjung anonim yang membuka Dasbor diarahkan ke Masuk. [Deployment publik](https://pantau-bergizi.vercel.app)

Empat angka pada Data dan PRD §1.1 dicocokkan kembali dengan rujukannya. Siaran pers aktivasi 4 November menyebut jumlah dapur yang baru diaktivasi pada gelombang itu, sehingga angka pendataan tetap memakai total akhir Oktober. [Korban per 2 September](https://www.dpr.go.id/kegiatan-dpr/berita/Desak-Perubahan-Sistemik-BGN-Harus-Beralih-ke-Dapur-Berbasis-Sekolah-68757) · [Pendataan akhir Oktober](https://www.bgn.go.id/news/artikel/ketika-mbg-tumbuh-besar-bgn-mulai-membenahi-dapur-hingga-tata-kelola) · [Aktivasi November](https://www.bgn.go.id/news/siaran-pers-deputi-sistakol/bgn-kembali-aktivasi-953-sppg-baru-di-34-provinsi-sasar-15-juta-penerima-manfaat) · [Pagu per 16 September](https://www.bgn.go.id/news/siaran-pers/program-mbg-serap-anggaran-6389-persen-per-september-2026) · [Studi sisa makanan SMPN 4 Garut](https://repository.ipb.ac.id/handle/123456789/177115)

## Skenario yang harus dicatat di deployment uji

Gunakan preview deployment dengan database simulasi terpisah, akun petugas demo, dan Turnstile yang berfungsi untuk domain preview. Catat URL, commit, waktu WIB, dan hasil tiap skenario pada issue #9. Simpan kode lacak uji untuk pengecekan ulang secara privat.

| Skenario | Hasil yang diharapkan |
| --- | --- |
| Tiga keluhan dari dua sekolah satu dapur, minimal satu dari area sekolah | Rapor naik ke Prioritas. Tolak satu laporan yang menjadi bukti. Pastikan status turun dan riwayat episode memuat alasan. |
| Guru/UKS mengirim pengamatan kelompok dengan minimal lima orang terdampak | Sebelum ditinjau, Rapor menampilkan Perlu perhatian. Setelah moderator meninjau, status menjadi Prioritas. Kirim tanggapan dari dasbor dapur dan cek di Lacak. |
| Episode dengan bukti lebih dari 24 jam dan laporan duplikat | Episode yang masih terbuka tetap tampil. Setelah moderator menggabungkan duplikat, laporan tersebut keluar dari hitungan. |
| Dapur tanpa laporan, laporan sisa belum cukup, serta nilai menu rendah | Status tanpa laporan adalah Belum ada data. Di bawah 10 jawaban sisa, Rapor menampilkan Data belum cukup. Nilai rendah dan sisa banyak tetap ditafsirkan sebagai mutu menu. |
| Laporan saat lokasi ditolak dan menu belum diisi | Pilih sekolah dengan dapur tanpa menu, tolak izin lokasi, lalu kirim penilaian. Kode lacak tampil. |
| Survei ganda, keluhan ulang, dan IP bersama | Survei kedua dari perangkat, sekolah, dan tanggal makan yang sama ditolak dengan pesan yang jelas. Keluhan ulang menawarkan Lacak dan pilihan Tetap kirim. Perangkat lain pada jaringan yang sama tetap bisa melapor. |
| Akses petugas | Pengelola hanya melihat dan menanggapi laporan dapurnya sendiri. Aksi moderator memerlukan peran moderator. Pengunjung anonim diarahkan ke Masuk. |
| Data bertahan setelah redeploy | Kirim laporan, tanggapi lewat dasbor dapur, dan simpan kode. Redeploy commit yang sama dengan database yang sama. Buka Lacak pada sesi baru dan pastikan laporan serta tanggapannya tetap tersedia. |

### Uji pengguna di HP

Berikan QR sekolah simulasi kepada peserta dan minta mereka mengirim penilaian menu seperti biasa. Mulai stopwatch saat formulir siap di HP dan hentikan saat kode lacak terlihat. Catat model HP, jaringan, apakah muncul prompt lokasi, durasi, dan hambatan. Target PRD adalah **kurang dari 20 detik**. Catat hasil pengukuran pengguna pada #9.

## Pengumpulan lomba

| Tahap | Isi paket |
| --- | --- |
| First Draft | PDF maksimal 10 halaman, minimal dua screenshot (Beranda dan Rapor), repo publik, dan README. Snapshot kode tersedia pada tag `first-draft`. |
| Final · 11 November | Situs ter-deploy, video maksimal 5 menit, proposal maksimal 30 halaman, dan surat orisinalitas bertanda tangan. Lengkapi identitas tim dan pembuka video sebelum pengumpulan. |
| Onsite · 28 November | Pitch deck maksimal 15 slide dan latihan demo cadangan dengan PostgreSQL lokal, `bun run db:reset --yes`, dan build produksi. Formulir publik memerlukan koneksi ke Turnstile. |

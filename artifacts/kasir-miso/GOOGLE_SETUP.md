# Menyiapkan koneksi akun Google

Kasir Miso menggunakan OAuth Google langsung dari aplikasi untuk menghubungkan
identitas akun sekaligus menyimpan backup online ke Google Drive akun yang sama.

## Yang diperlukan

1. Satu project di Google Cloud.
2. Google Drive API yang sudah diaktifkan melalui **APIs & Services → Library**.
3. OAuth consent screen yang sudah dikonfigurasi.
4. Tambahkan scope `https://www.googleapis.com/auth/drive.file` pada consent screen.
5. Tiga OAuth Client ID:
   - Web application
   - Android application
   - iOS application
6. Tiga environment variable publik berikut di project:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
7. Secret `GOOGLE_OAUTH_CLIENT_SECRET` untuk Web OAuth disimpan sebagai Replit
   Secret. Jangan pernah memakai nama `EXPO_PUBLIC_` untuk client secret.
8. Environment variable server `GOOGLE_OAUTH_CLIENT_IDS` berisi daftar Client ID
   yang diizinkan, dipisahkan koma. Jika hanya Web Client ID yang dipakai, server
   juga dapat membaca `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

Salin nama variable dari `.env.example`. Client ID bukan password, tetapi
Client Secret tidak boleh dimasukkan ke aplikasi mobile atau ke chat.

## Pengaturan platform

- Android package: `com.kasirwarung.app`
- iOS bundle identifier: `com.kasirwarung.app`
- Scope login: `openid`, `profile`, `email`, dan
  `https://www.googleapis.com/auth/drive.file`
- Untuk Android, Google Cloud dapat meminta SHA-1 signing certificate.
- Untuk iOS, gunakan bundle identifier yang sama saat membuat OAuth client.
- Untuk Web, tambahkan alamat preview berikut ke **Authorized JavaScript origins**
  dan **Authorized redirect URIs** pada Web OAuth Client:
  `https://f76ba586-9769-44c4-90f8-41959264d92c-00-27nro1o6bur0.expo.sisko.replit.dev`
  Gunakan alamat persis seperti di atas, tanpa menambahkan path atau slash di akhir.
  Jika alamat preview berubah, gunakan alamat terbaru yang muncul pada pesan error
  Google dan perbarui dua daftar tersebut.

Setelah konfigurasi disimpan, muat ulang workflow API Server dan Expo. Tombol
**Hubungkan akun Google** akan membuka consent screen Google. Setelah berhasil,
API Server menukar authorization code dan menyimpan refresh token dalam bentuk
terenkripsi. Aplikasi hanya menyimpan session token acak untuk mengenali koneksi
server; access token dan refresh token Google tidak disimpan di AsyncStorage atau
kode client.

Saat aplikasi dibuka kembali, session token tersebut dipakai untuk melanjutkan
backup tanpa meminta pemilik warung login ulang. Jika Google mencabut izin atau
refresh token kedaluwarsa, aplikasi menampilkan instruksi untuk menghubungkan
ulang tanpa menghapus data usaha lokal.

Kasir Miso hanya dapat mencari, membuat, memperbarui, dan membaca file Drive yang
dibuat oleh aplikasi sendiri. File backup bernama `Kasir Miso Backup.json`.

## Saat membuat APK

Replit Secrets hanya tersedia pada workflow yang berjalan di Replit. Jika APK
dibuat oleh layanan build lain, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` harus
tersedia pada environment layanan tersebut **saat proses build berlangsung**.
Jika tidak, Client ID tidak masuk ke JavaScript bundle APK dan login Google akan
ditolak.

OAuth Client Android di Google Cloud juga harus memakai:

- Package name `com.kasirwarung.app`.
- SHA-1 dari sertifikat yang benar-benar menandatangani APK tersebut.

APK debug, APK dari layanan cloud, dan APK produksi dapat memakai sertifikat
berbeda. Client ID yang benar tetapi SHA-1 tidak cocok tetap akan menyebabkan
login gagal atau jendela login langsung tertutup.

Backup otomatis berjalan setelah data usaha berubah dan secara berkala selama
aplikasi terbuka. Pemulihan dilakukan manual dari menu **Lainnya → Pulihkan dari
Google Drive**. Kredensial Google, token OAuth, dan backup offline lokal tidak
dimasukkan ke file backup online.
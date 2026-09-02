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
6. Tiga environment variable berikut di project:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

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

Setelah Client ID disimpan sebagai environment variable, muat ulang workflow
Expo. Tombol **Hubungkan akun Google** akan membuka consent screen Google. Setelah
berhasil, email akun tampil di kartu akun dan akses Google Drive aktif untuk sesi
aplikasi tersebut. Kasir Miso hanya dapat mencari, membuat, memperbarui, dan
membaca file Drive yang dibuat oleh aplikasi sendiri. File backup bernama
`Kasir Miso Backup.json`.

Backup otomatis berjalan setelah data usaha berubah dan secara berkala selama
aplikasi terbuka. Pemulihan dilakukan manual dari menu **Lainnya → Pulihkan dari
Google Drive**. Kredensial Google, token OAuth, dan backup offline lokal tidak
dimasukkan ke file backup online.
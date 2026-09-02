# Menyiapkan koneksi akun Google

Kasir Miso menggunakan OAuth Google langsung dari aplikasi untuk menghubungkan
identitas akun. Pada tahap ini aplikasi hanya meminta nama dan email, tanpa
akses Google Drive atau layanan Google lainnya.

## Yang diperlukan

1. Satu project di Google Cloud.
2. OAuth consent screen yang sudah dikonfigurasi.
3. Tiga OAuth Client ID:
   - Web application
   - Android application
   - iOS application
5. Tiga environment variable berikut di project:
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
   - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

Salin nama variable dari `.env.example`. Client ID bukan password, tetapi
Client Secret tidak boleh dimasukkan ke aplikasi mobile atau ke chat.

## Pengaturan platform

- Android package: `com.kasirwarung.app`
- iOS bundle identifier: `com.kasirwarung.app`
- Scope login: `openid`, `profile`, dan `email`
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
berhasil, email akun tampil di kartu akun. Backup Google Drive belum termasuk
tahap ini dan sengaja ditunda.
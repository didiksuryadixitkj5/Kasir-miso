# Memindahkan Kasir Miso ke komputer lain

ZIP portable ini berisi source code dan asset Kasir Miso, tetapi tidak berisi
secret atau token. File berikut harus tetap disimpan di pengelola secret, bukan
diarsipkan:

- `GOOGLE_OAUTH_CLIENT_SECRET`
- `SESSION_SECRET`
- `EXPO_TOKEN`

Client ID Google memang bukan password, tetapi pada proyek ini nilainya
disimpan sebagai environment variable agar konfigurasi setiap platform tetap
jelas dan tidak tertukar.

## Menjalankan di komputer baru

1. Install Node.js dan pnpm.
2. Extract ZIP.
3. Dari folder hasil extract, jalankan:

   ```bash
   pnpm install --filter @workspace/kasir-miso...
   ```

4. Buat file `artifacts/kasir-miso/.env` dari `.env.example`, lalu isi:

   ```text
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
   ```

   Alternatif untuk APK portable: isi tiga nilai publik tersebut langsung pada
   `expo.extra.googleClientIds` di `app.json`. Kode aplikasi akan memakai nilai
   `app.json` jika environment variable tidak tersedia saat build.

5. Jalankan aplikasi:

   ```bash
   pnpm --filter @workspace/kasir-miso run dev
   ```

Alamat dan SHA-1 OAuth Android tetap mengikuti panduan di
`GOOGLE_SETUP.md`.

> Jangan memasukkan `GOOGLE_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`, atau
> `EXPO_TOKEN` ke ZIP, Git, atau aplikasi mobile.
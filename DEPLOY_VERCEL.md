# Panduan Deploy ke Vercel (MiniSoccer Arena)

Aplikasi ini sudah siap dan dikonfigurasi untuk langsung di-deploy ke Vercel.

## Cara Deploy (Mudah & Cepat)

### Opsi 1: Lewat Dashboard Vercel (Disarankan)
1. **Ekspor Proyek**:
   - Klik menu titik tiga / settings di Google AI Studio, pilih **Export to GitHub** atau unduh sebagai ZIP.
   - Unggah ke repository GitHub Anda (misal: `minisoccer-booking`).
2. **Import di Vercel**:
   - Buka [vercel.com](https://vercel.com) dan login.
   - Klik **Add New...** -> **Project**.
   - Pilih repository GitHub yang baru saja dibuat.
3. **Pengaturan Framework**:
   - Vercel akan otomatis mendeteksi **Vite**.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. **Environment Variables (Opsional)**:
   - Tambahkan variabel jika ingin mengganti password login owner:
     - `OWNER_PASSWORD`: `password_rahasia_anda` (default jika kosong: `arena2026`)
5. **Klik Deploy**:
   - Tunggu 1-2 menit hingga proses selesai.
   - Website langsung aktif dengan alamat `https://nama-proyek-anda.vercel.app`.

---

### Opsi 2: Menggunakan Vercel CLI
Jika Anda mengunduh proyek ke komputer:
```bash
npm install -g vercel
vercel
```
Ikuti instruksi di layar, pilih preset **Vite**, dan Vercel akan otomatis mendeteksi file `vercel.json` dan folder `api/`.

---

## Rute Penting Setelah Deploy:
- Halaman Pelanggan (Booking): `https://domain-anda.vercel.app/`
- Halaman Pengelola (Owner): `https://domain-anda.vercel.app/owner`

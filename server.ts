import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { store } from './server/store';
import { calculatePrice, getJakartaDateString, timeToMinutes, minutesToTime, checkCollision } from './src/utils/timeUtils';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory rate limiter for Cek Booking lookup
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
function rateLimitLookup(req: Request, res: Response, next: NextFunction) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '')) || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxAttempts = 30;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (current.count >= maxAttempts) {
    return res.status(429).json({
      error: 'Terlalu banyak percobaan pencarian booking. Harap tunggu 1 menit sebelum mencoba kembali.',
    });
  }

  current.count++;
  next();
}

// Owner authentication
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'arena2026';
const ownerSessions = new Set<string>();

function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Silakan login sebagai pengelola/owner terlebih dahulu.' });
  }
  const token = authHeader.substring(7);
  if (!ownerSessions.has(token)) {
    return res.status(401).json({ error: 'Sesi login owner sudah kedaluwarsa atau tidak valid.' });
  }
  next();
}

// -------------------------------------------------------------
// PUBLIC API ROUTES
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Public venue info
app.get('/api/venue-info', (req, res) => {
  const settings = store.getSettings();
  res.json({
    name: settings.name,
    address: settings.address,
    gmapsUrl: settings.gmapsUrl,
    ownerWhatsapp: settings.ownerWhatsapp,
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    closedDays: settings.closedDays,
    maxAdvanceDays: settings.maxAdvanceDays,
    minDurationMinutes: settings.minDurationMinutes,
    allowedDurations: settings.allowedDurations,
    bufferMinutes: settings.bufferMinutes,
    baseHourlyRate: settings.baseHourlyRate,
    specialRates: settings.specialRates.filter(r => r.isActive),
    paymentTerms: settings.paymentTerms,
    cancellationPolicy: settings.cancellationPolicy,
  });
});

// Public schedule for a date (NO customer info leaked!)
app.get('/api/schedule', (req, res) => {
  const dateStr = (req.query.date as string) || getJakartaDateString();
  try {
    const schedule = store.getPublicSchedule(dateStr);
    res.json(schedule);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal memuat jadwal.' });
  }
});

// Calculate price preview
app.post('/api/bookings/calculate-price', (req, res) => {
  const { date, startTime, durationMinutes } = req.body;
  if (!date || !startTime || !durationMinutes) {
    return res.status(400).json({ error: 'Parameter tanggal, waktu mulai, dan durasi wajib diisi.' });
  }
  const settings = store.getSettings();
  const calculation = calculatePrice(date, startTime, Number(durationMinutes), settings);
  res.json(calculation);
});

// Customer booking creation (atomic + collision check + idempotency)
app.post('/api/bookings', async (req, res) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes } = req.body;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    if (!date || !startTime || !durationMinutes || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: 'Mohon lengkapi tanggal, waktu mulai, durasi, nama, dan nomor WhatsApp.',
      });
    }

    // Validate phone number format (Indonesian 10-15 digits)
    const cleanedPhone = customerWhatsapp.replace(/[^0-9]/g, '');
    if (cleanedPhone.length < 9 || cleanedPhone.length > 15) {
      return res.status(400).json({
        error: 'Nomor WhatsApp tidak valid. Masukkan nomor ponsel aktif (contoh: 081234567890).',
      });
    }

    const booking = await store.createBookingAtomic({
      date,
      startTime,
      durationMinutes: Number(durationMinutes),
      customerName,
      customerWhatsapp,
      teamName,
      notes,
      idempotencyKey,
      bookingSource: 'online',
    });

    res.status(201).json({
      success: true,
      booking,
      secretToken: booking.secretToken,
      message: 'Booking berhasil dikonfirmasi! Silakan simpan kode booking Anda.',
    });
  } catch (err: any) {
    console.error('Booking error:', err);
    res.status(409).json({
      error: err.message || 'Terjadi benturan jadwal atau kegagalan saat konfirmasi booking.',
    });
  }
});

// Customer Cek Booking (Rate limited, requires code + phone)
app.post('/api/bookings/lookup', rateLimitLookup, (req, res) => {
  const { bookingCode, whatsappNumber } = req.body;
  if (!bookingCode || !whatsappNumber) {
    return res.status(400).json({
      error: 'Kode booking dan nomor WhatsApp wajib diisi untuk mencari pesanan Anda.',
    });
  }

  const booking = store.findBookingByCodeAndPhone(bookingCode, whatsappNumber);
  if (!booking) {
    return res.status(404).json({
      error: 'Booking tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai.',
    });
  }

  res.json({ success: true, booking });
});

// Customer private view by secret token
app.get('/api/bookings/private/:token', (req, res) => {
  const { token } = req.params;
  const booking = store.findBookingBySecretToken(token);
  if (!booking) {
    return res.status(404).json({ error: 'Tautan booking tidak ditemukan atau sudah tidak valid.' });
  }
  res.json({ success: true, booking });
});

// -------------------------------------------------------------
// OWNER / ADMIN API ROUTES
// -------------------------------------------------------------

// Owner Login
app.post('/api/owner/login', (req, res) => {
  const { password } = req.body;
  if (password === OWNER_PASSWORD) {
    const sessionToken = crypto.randomUUID();
    ownerSessions.add(sessionToken);
    return res.json({ success: true, token: sessionToken });
  }
  res.status(401).json({ error: 'Kata sandi owner salah.' });
});

// Owner Logout
app.post('/api/owner/logout', requireOwnerAuth, (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    ownerSessions.delete(authHeader.substring(7));
  }
  res.json({ success: true });
});

// Owner Dashboard: Get all bookings, closures, settings, and calculated stats
app.get('/api/owner/dashboard', requireOwnerAuth, (req, res) => {
  const todayJakarta = getJakartaDateString();
  const allBookings = store.getAllBookings();
  const closures = store.getAllClosures();
  const settings = store.getSettings();

  // Calculate quick stats
  const activeToday = allBookings.filter(b => b.date === todayJakarta && b.bookingStatus !== 'cancelled');
  const todayBookingsCount = activeToday.length;
  const todayTotalMinutes = activeToday.reduce((acc, b) => acc + b.durationMinutes, 0);
  const todayTotalHours = Math.round((todayTotalMinutes / 60) * 10) / 10;

  const unpaidActive = allBookings.filter(b => b.bookingStatus !== 'cancelled' && b.paymentStatus === 'unpaid');
  const unpaidCount = unpaidActive.length;
  const unpaidTotalAmount = unpaidActive.reduce((acc, b) => acc + b.totalPrice, 0);

  res.json({
    todayDate: todayJakarta,
    stats: {
      todayBookingsCount,
      todayTotalHours,
      unpaidCount,
      unpaidTotalAmount,
    },
    bookings: allBookings,
    closures,
    settings,
  });
});

// Owner Manual Booking
app.post('/api/owner/bookings', requireOwnerAuth, async (req, res) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes, bookingSource, paymentStatus } = req.body;
    if (!date || !startTime || !durationMinutes || !customerName || !customerWhatsapp) {
      return res.status(400).json({ error: 'Mohon lengkapi informasi booking.' });
    }

    const booking = await store.createBookingAtomic({
      date,
      startTime,
      durationMinutes: Number(durationMinutes),
      customerName,
      customerWhatsapp,
      teamName,
      notes,
      bookingSource: bookingSource || 'whatsapp',
      paymentStatus: paymentStatus || 'unpaid',
    });

    res.status(201).json({ success: true, booking });
  } catch (err: any) {
    res.status(409).json({ error: err.message || 'Gagal menambahkan booking manual.' });
  }
});

// Owner Reschedule Booking (with atomic lock and price recalculation)
app.put('/api/owner/bookings/:id/schedule', requireOwnerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, durationMinutes } = req.body;
    if (!date || !startTime || !durationMinutes) {
      return res.status(400).json({ error: 'Tanggal, waktu mulai, dan durasi wajib diisi.' });
    }

    const updated = await store.updateBookingScheduleAtomic(id, date, startTime, Number(durationMinutes));
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    res.status(409).json({ error: err.message || 'Gagal mengubah jadwal booking.' });
  }
});

// Owner Update Contact / Notes
app.put('/api/owner/bookings/:id/contact', requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, customerWhatsapp, teamName, notes } = req.body;
    const updated = store.updateBookingDetails(id, { customerName, customerWhatsapp, teamName, notes });
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Owner Update Payment Status
app.put('/api/owner/bookings/:id/payment', requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    if (!['paid', 'unpaid'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Status pembayaran harus paid atau unpaid.' });
    }
    const updated = store.updatePaymentStatus(id, paymentStatus);
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Owner Cancel Booking
app.post('/api/owner/bookings/:id/cancel', requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const updated = store.cancelBooking(id, reason);
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Owner Add Field Closure
app.post('/api/owner/closures', requireOwnerAuth, (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body;
    if (!date || !startTime || !endTime || !reason) {
      return res.status(400).json({ error: 'Semua kolom penutupan wajib diisi.' });
    }
    const closure = store.addClosure(date, startTime, endTime, reason);
    res.status(201).json({ success: true, closure });
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

// Owner Delete Field Closure
app.delete('/api/owner/closures/:id', requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    store.removeClosure(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Owner Update Settings
app.put('/api/owner/settings', requireOwnerAuth, (req, res) => {
  try {
    const updatedSettings = store.updateSettings(req.body);
    res.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Owner Reset Demo Data
app.post('/api/owner/reset-demo', requireOwnerAuth, (req, res) => {
  try {
    store.resetDemoData();
    res.json({ success: true, message: 'Data demo berhasil direset ke kondisi awal.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Global JSON error handler for API routes
app.use('/api', (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Terjadi kesalahan pada server internal.',
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SERVER START
// -------------------------------------------------------------

// Export express app for serverless deployment (Vercel)
export default app;

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only listen directly if not running inside a serverless runtime (e.g. Vercel)
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

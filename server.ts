import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { store } from './server/store';
import { calculatePrice, getJakartaDateString, timeToMinutes, minutesToTime, checkCollision } from './src/utils/timeUtils';

const app = express();
const PORT = 3000;

// 1. CORS Headers & Preflight
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 2. Body Parsing (JSON + URL-Encoded + Fallback safety)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      // ignore
    }
  }
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  next();
});

// 3. Normalize Vercel Serverless Function URLs
// In Vercel, requests to /api/index.js or rewrites might include the function name in the URL
app.use((req: Request, res: Response, next: NextFunction) => {
  // Strip /api/index.js or /index.js prefix if present in req.url
  if (req.url.startsWith('/api/index.js')) {
    req.url = req.url.slice('/api/index.js'.length) || '/';
  } else if (req.url.startsWith('/index.js')) {
    req.url = req.url.slice('/index.js'.length) || '/';
  }

  // Ensure req.url always begins with /
  if (!req.url.startsWith('/')) {
    req.url = '/' + req.url;
  }

  next();
});

// Rate limiter for Cek Booking lookup
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

// -------------------------------------------------------------
// OWNER AUTHENTICATION (Stateless HMAC-SHA256 for Vercel + In-Memory)
// -------------------------------------------------------------
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'arena2026';
const ownerSessions = new Set<string>();

function createOwnerToken(): string {
  const ts = Date.now().toString();
  const signature = crypto.createHmac('sha256', OWNER_PASSWORD).update(ts).digest('hex');
  const token = `${ts}.${signature}`;
  ownerSessions.add(token);
  return token;
}

function verifyOwnerToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  if (ownerSessions.has(token)) return true;

  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [tsStr, signature] = parts;
  const ts = Number(tsStr);
  if (isNaN(ts)) return false;

  // Sesi berlaku selama 7 hari
  if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) return false;

  try {
    const expectedSig = crypto.createHmac('sha256', OWNER_PASSWORD).update(tsStr).digest('hex');
    if (signature.length !== expectedSig.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function requireOwnerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Silakan login sebagai pengelola/owner terlebih dahulu.' });
  }
  const token = authHeader.substring(7).trim();
  if (!verifyOwnerToken(token)) {
    return res.status(401).json({ error: 'Sesi login owner sudah kedaluwarsa atau tidak valid.' });
  }
  next();
}

// -------------------------------------------------------------
// API ROUTER (Mounted on BOTH /api and / to prevent Vercel route mismatches)
// -------------------------------------------------------------
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Public venue info
apiRouter.get('/venue-info', (req: Request, res: Response) => {
  try {
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
  } catch (err: any) {
    console.error('Error in /venue-info:', err);
    res.status(500).json({ error: err.message || 'Gagal memuat info lapangan.' });
  }
});

// Public schedule for a date (NO customer info leaked!)
apiRouter.get('/schedule', (req: Request, res: Response) => {
  const dateStr = (req.query.date as string) || getJakartaDateString();
  try {
    const schedule = store.getPublicSchedule(dateStr);
    res.json(schedule);
  } catch (err: any) {
    console.error('Error in /schedule:', err);
    res.status(500).json({ error: err.message || 'Gagal memuat jadwal.' });
  }
});

// Calculate price preview
apiRouter.post('/bookings/calculate-price', (req: Request, res: Response) => {
  try {
    const { date, startTime, durationMinutes } = req.body || {};
    if (!date || !startTime || !durationMinutes) {
      return res.status(400).json({ error: 'Parameter tanggal, waktu mulai, dan durasi wajib diisi.' });
    }
    const settings = store.getSettings();
    const calculation = calculatePrice(date, startTime, Number(durationMinutes), settings);
    res.json(calculation);
  } catch (err: any) {
    console.error('Error in calculate-price:', err);
    res.status(500).json({ error: err.message || 'Gagal menghitung perkiraan harga.' });
  }
});

// Customer booking creation (atomic + collision check + idempotency)
apiRouter.post('/bookings', async (req: Request, res: Response) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes } = req.body || {};
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body?.idempotencyKey;

    if (!date || !startTime || !durationMinutes || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: 'Mohon lengkapi tanggal, waktu mulai, durasi, nama, dan nomor WhatsApp.',
      });
    }

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
apiRouter.post('/bookings/lookup', rateLimitLookup, (req: Request, res: Response) => {
  try {
    const { bookingCode, whatsappNumber } = req.body || {};
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
  } catch (err: any) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: err.message || 'Gagal mencari data booking.' });
  }
});

// Customer private view by secret token
apiRouter.get('/bookings/private/:token', (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const booking = store.findBookingBySecretToken(token);
    if (!booking) {
      return res.status(404).json({ error: 'Tautan booking tidak ditemukan atau sudah tidak valid.' });
    }
    res.json({ success: true, booking });
  } catch (err: any) {
    console.error('Private view error:', err);
    res.status(500).json({ error: err.message || 'Gagal memuat rincian booking.' });
  }
});

// -------------------------------------------------------------
// OWNER / ADMIN API ROUTES
// -------------------------------------------------------------

// Owner Login
apiRouter.post('/owner/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Kata sandi tidak boleh kosong.' });
    }
    if (password === OWNER_PASSWORD) {
      const sessionToken = createOwnerToken();
      return res.json({ success: true, token: sessionToken });
    }
    return res.status(401).json({ error: 'Kata sandi owner salah.' });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Gagal memproses login pengelola.' });
  }
});

// Owner Logout
apiRouter.post('/owner/logout', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      ownerSessions.delete(authHeader.substring(7).trim());
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Gagal logout.' });
  }
});

// Owner Dashboard: Get all bookings, closures, settings, and calculated stats
apiRouter.get('/owner/dashboard', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const todayJakarta = getJakartaDateString();
    const allBookings = store.getAllBookings();
    const closures = store.getAllClosures();
    const settings = store.getSettings();

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
  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message || 'Gagal memuat dashboard pengelola.' });
  }
});

// Owner Manual Booking
apiRouter.post('/owner/bookings', requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes, bookingSource, paymentStatus } = req.body || {};
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
    console.error('Manual booking error:', err);
    res.status(409).json({ error: err.message || 'Gagal menambahkan booking manual.' });
  }
});

// Owner Reschedule Booking
apiRouter.put('/owner/bookings/:id/schedule', requireOwnerAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, startTime, durationMinutes } = req.body || {};
    if (!date || !startTime || !durationMinutes) {
      return res.status(400).json({ error: 'Tanggal, waktu mulai, dan durasi wajib diisi.' });
    }

    const updated = await store.updateBookingScheduleAtomic(id, date, startTime, Number(durationMinutes));
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    console.error('Reschedule error:', err);
    res.status(409).json({ error: err.message || 'Gagal mengubah jadwal booking.' });
  }
});

// Owner Update Contact / Notes
apiRouter.put('/owner/bookings/:id/contact', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerName, customerWhatsapp, teamName, notes } = req.body || {};
    const updated = store.updateBookingDetails(id, { customerName, customerWhatsapp, teamName, notes });
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    console.error('Update contact error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Owner Update Payment Status
apiRouter.put('/owner/bookings/:id/payment', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body || {};
    if (!['paid', 'unpaid'].includes(paymentStatus)) {
      return res.status(400).json({ error: 'Status pembayaran harus paid atau unpaid.' });
    }
    const updated = store.updatePaymentStatus(id, paymentStatus);
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    console.error('Update payment error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Owner Cancel Booking
apiRouter.post('/owner/bookings/:id/cancel', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const updated = store.cancelBooking(id, reason);
    res.json({ success: true, booking: updated });
  } catch (err: any) {
    console.error('Cancel booking error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Owner Add Field Closure
apiRouter.post('/owner/closures', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const { date, startTime, endTime, reason } = req.body || {};
    if (!date || !startTime || !endTime || !reason) {
      return res.status(400).json({ error: 'Semua kolom penutupan wajib diisi.' });
    }
    const closure = store.addClosure(date, startTime, endTime, reason);
    res.status(201).json({ success: true, closure });
  } catch (err: any) {
    console.error('Closure error:', err);
    res.status(409).json({ error: err.message });
  }
});

// Owner Delete Field Closure
apiRouter.delete('/owner/closures/:id', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    store.removeClosure(id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Delete closure error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Owner Update Settings
apiRouter.put('/owner/settings', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    const updatedSettings = store.updateSettings(req.body || {});
    res.json({ success: true, settings: updatedSettings });
  } catch (err: any) {
    console.error('Update settings error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Owner Reset Demo Data
apiRouter.post('/owner/reset-demo', requireOwnerAuth, (req: Request, res: Response) => {
  try {
    store.resetDemoData();
    res.json({ success: true, message: 'Data demo berhasil direset ke kondisi awal.' });
  } catch (err: any) {
    console.error('Reset demo error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// MOUNT API ROUTER AT BOTH /api AND / (Fail-Safe Routing)
// -------------------------------------------------------------
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 4. Fallback 404 Handler for API endpoints
app.use((req: Request, res: Response, next: NextFunction) => {
  // If in Vercel serverless environment, always respond with JSON instead of hanging
  if (process.env.VERCEL || req.path.startsWith('/api')) {
    return res.status(404).json({ error: `Rute API '${req.method} ${req.originalUrl || req.url}' tidak ditemukan.` });
  }
  next();
});

// 5. Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global Server Error:', err);
  const status = typeof err.status === 'number' ? err.status : (typeof err.statusCode === 'number' ? err.statusCode : 500);
  res.status(status).json({
    error: err.message || 'Terjadi kesalahan pada server internal.',
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SERVER START (Local / Cloud Run Only)
// -------------------------------------------------------------
export default app;

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION ||
  process.env.LAMBDA_TASK_ROOT
);

async function startServer() {
  if (isServerless) {
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

// In Vercel or AWS Lambda serverless functions, do NOT start the standalone HTTP server
if (!isServerless) {
  startServer();
}

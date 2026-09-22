// server.ts
import express from "express";
import path2 from "path";
import crypto2 from "crypto";

// server/store.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";

// src/utils/timeUtils.ts
var JAKARTA_TZ = "Asia/Jakarta";
function getJakartaDateString(date = /* @__PURE__ */ new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(date);
}
function getJakartaCurrentMinutes() {
  const now = /* @__PURE__ */ new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TZ,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return hour * 60 + minute;
}
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minutesToTime(totalMinutes) {
  const bounded = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function getDayOfWeek(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCDay();
}
function calculatePrice(dateStr, startTime, durationMinutes, settings) {
  const startMins = timeToMinutes(startTime);
  const endMins = startMins + durationMinutes;
  const dayOfWeek = getDayOfWeek(dateStr);
  const applicableRules = (settings.specialRates || []).filter(
    (rule) => rule.isActive && rule.days.includes(dayOfWeek)
  );
  const cutPoints = /* @__PURE__ */ new Set([startMins, endMins]);
  for (const rule of applicableRules) {
    const rStart = timeToMinutes(rule.startTime);
    const rEnd = timeToMinutes(rule.endTime);
    if (rStart > startMins && rStart < endMins) cutPoints.add(rStart);
    if (rEnd > startMins && rEnd < endMins) cutPoints.add(rEnd);
  }
  const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);
  const segments = [];
  let totalPrice = 0;
  for (let i = 0; i < sortedCuts.length - 1; i++) {
    const segStart = sortedCuts[i];
    const segEnd = sortedCuts[i + 1];
    const segDuration = segEnd - segStart;
    const midpoint = (segStart + segEnd) / 2;
    let activeRate = settings.baseHourlyRate;
    let rateName = "Tarif Dasar";
    for (const rule of applicableRules) {
      const rStart = timeToMinutes(rule.startTime);
      const rEnd = timeToMinutes(rule.endTime);
      if (midpoint >= rStart && midpoint < rEnd) {
        activeRate = rule.hourlyRate;
        rateName = rule.name;
        break;
      }
    }
    const segAmount = segDuration * activeRate / 60;
    totalPrice += segAmount;
    segments.push({
      fromTime: minutesToTime(segStart),
      toTime: minutesToTime(segEnd),
      durationMinutes: segDuration,
      hourlyRate: activeRate,
      amount: Math.round(segAmount),
      rateName
    });
  }
  return {
    totalMinutes: durationMinutes,
    totalPrice: Math.round(totalPrice),
    segments,
    baseHourlyRate: settings.baseHourlyRate
  };
}
function checkCollision(dateStr, startTime, endTime, bookings, closures, settings, excludeBookingId) {
  const newStart = timeToMinutes(startTime);
  const newEnd = timeToMinutes(endTime);
  const openMins = timeToMinutes(settings.openTime);
  const closeMins = timeToMinutes(settings.closeTime);
  if (newStart < openMins) {
    return {
      hasCollision: true,
      reason: `Waktu mulai (${startTime}) sebelum jam operasional (${settings.openTime}).`
    };
  }
  if (newEnd > closeMins) {
    return {
      hasCollision: true,
      reason: `Waktu selesai (${endTime}) melewati jam tutup lapangan (${settings.closeTime}).`
    };
  }
  const dayOfWeek = getDayOfWeek(dateStr);
  if (settings.closedDays && settings.closedDays.includes(dayOfWeek)) {
    return {
      hasCollision: true,
      reason: `Lapangan tutup rutin pada hari ini.`
    };
  }
  const todayJakarta = getJakartaDateString();
  if (dateStr < todayJakarta) {
    return {
      hasCollision: true,
      reason: `Tanggal pemesanan sudah lewat.`
    };
  }
  if (dateStr === todayJakarta) {
    const currentMins = getJakartaCurrentMinutes();
    if (newStart < currentMins) {
      return {
        hasCollision: true,
        reason: `Waktu mulai (${startTime}) sudah terlewat (waktu sekarang: ${minutesToTime(currentMins)} WIB).`
      };
    }
  }
  for (const closure of closures) {
    if (closure.date !== dateStr) continue;
    const cStart = timeToMinutes(closure.startTime);
    const cEnd = timeToMinutes(closure.endTime);
    if (newStart < cEnd && newEnd > cStart) {
      return {
        hasCollision: true,
        reason: `Lapangan ditutup (${closure.startTime}\u2013${closure.endTime}) untuk: ${closure.reason}.`,
        conflictingClosure: closure
      };
    }
  }
  const buffer = settings.bufferMinutes || 0;
  for (const b of bookings) {
    if (b.id === excludeBookingId) continue;
    if (b.date !== dateStr) continue;
    if (b.bookingStatus === "cancelled") continue;
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    if (newStart < bEnd + buffer && newEnd > bStart - buffer) {
      let detail = `Bertabrakan dengan jadwal terisi (${b.startTime}\u2013${b.endTime}).`;
      if (buffer > 0) {
        if (newStart < bEnd + buffer && newStart >= bEnd) {
          detail = `Membutuhkan jeda antarsewa minimal ${buffer} menit setelah booking ${b.startTime}\u2013${b.endTime} (paling cepat mulai ${minutesToTime(bEnd + buffer)}).`;
        } else if (newEnd > bStart - buffer && newEnd <= bStart) {
          detail = `Membutuhkan jeda antarsewa minimal ${buffer} menit sebelum booking ${b.startTime}\u2013${b.endTime} (paling lambat selesai ${minutesToTime(bStart - buffer)}).`;
        }
      }
      return {
        hasCollision: true,
        reason: detail,
        conflictingBooking: b
      };
    }
  }
  return { hasCollision: false };
}
function generatePublicSchedule(dateStr, bookings, closures, settings) {
  const openMins = timeToMinutes(settings.openTime);
  const closeMins = timeToMinutes(settings.closeTime);
  const buffer = settings.bufferMinutes || 0;
  const todayJakarta = getJakartaDateString();
  const currentMins = dateStr === todayJakarta ? getJakartaCurrentMinutes() : -1;
  const busy = [];
  for (const b of bookings) {
    if (b.date === dateStr && b.bookingStatus !== "cancelled") {
      busy.push({
        start: timeToMinutes(b.startTime),
        end: timeToMinutes(b.endTime),
        type: "booked",
        label: "Terisi"
      });
    }
  }
  for (const c of closures) {
    if (c.date === dateStr) {
      busy.push({
        start: timeToMinutes(c.startTime),
        end: timeToMinutes(c.endTime),
        type: "closed",
        label: "Ditutup",
        reason: c.reason
      });
    }
  }
  if (currentMins > openMins) {
    const pastEnd = Math.min(closeMins, currentMins);
    busy.push({
      start: openMins,
      end: pastEnd,
      type: "past",
      label: "Sudah lewat"
    });
  }
  busy.sort((a, b) => a.start - b.start);
  const slots = [];
  let pointer = openMins;
  for (const interval of busy) {
    const iStart = Math.max(openMins, interval.start);
    const iEnd = Math.min(closeMins, interval.end);
    if (iEnd <= pointer) continue;
    if (iStart > pointer) {
      slots.push({
        startTime: minutesToTime(pointer),
        endTime: minutesToTime(iStart),
        status: "available",
        label: "Tersedia"
      });
    }
    slots.push({
      startTime: minutesToTime(iStart),
      endTime: minutesToTime(iEnd),
      status: interval.type,
      label: interval.label,
      reason: interval.reason
    });
    pointer = iEnd;
  }
  if (pointer < closeMins) {
    slots.push({
      startTime: minutesToTime(pointer),
      endTime: minutesToTime(closeMins),
      status: "available",
      label: "Tersedia"
    });
  }
  const minDuration = settings.minDurationMinutes || 60;
  const freeRanges = [];
  for (const slot of slots) {
    if (slot.status === "available") {
      const sMins = timeToMinutes(slot.startTime);
      const eMins = timeToMinutes(slot.endTime);
      const span = eMins - sMins;
      if (span >= minDuration) {
        freeRanges.push({
          startTime: slot.startTime,
          endTime: slot.endTime,
          durationMinutes: span
        });
      }
    }
  }
  const isFull = freeRanges.length === 0;
  return { slots, freeRanges, isFull };
}

// server/store.ts
var isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT
);
var DATA_DIR = isServerless ? path.join("/tmp", "data") : path.join(process.cwd(), "data");
var DB_FILE = path.join(DATA_DIR, "database.json");
var DEFAULT_SETTINGS = {
  name: "MiniSoccer Arena",
  address: "Jl. Lapangan Hijau No. 18, Jakarta Selatan",
  gmapsUrl: "https://maps.google.com/?q=Jakarta",
  ownerWhatsapp: "6281234567890",
  openTime: "07:00",
  closeTime: "23:00",
  closedDays: [],
  maxAdvanceDays: 30,
  minDurationMinutes: 60,
  allowedDurations: [60, 90, 120, 180],
  bufferMinutes: 0,
  baseHourlyRate: 3e5,
  specialRates: [
    {
      id: "rule-peak-night",
      name: "Tarif Malam (Peak Hour)",
      hourlyRate: 35e4,
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: "18:00",
      endTime: "23:00",
      isActive: true
    }
  ],
  paymentTerms: "Pembayaran dilakukan di lokasi sebelum kick-off via Cash atau QRIS.",
  cancellationPolicy: "Pembatalan bebas biaya dapat dilakukan maksimal 6 jam sebelum waktu main."
};
function getInitialDemoData() {
  const today = getJakartaDateString();
  const [y, m, d] = today.split("-").map(Number);
  const tomorrowDate = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const demoBookings = [
    {
      id: "demo-b1",
      bookingCode: "MS-2609-A101",
      secretToken: "demo-token-1111-aaaa-bbbb",
      date: today,
      startTime: "14:45",
      endTime: "16:15",
      durationMinutes: 90,
      customerName: "Budi Santoso",
      customerWhatsapp: "081234567891",
      teamName: "Garuda FC",
      notes: "Rompi disediakan pihak lapangan ya min",
      bookingSource: "online",
      bookingStatus: "confirmed",
      paymentStatus: "unpaid",
      priceBreakdown: [
        {
          fromTime: "14:45",
          toTime: "16:15",
          durationMinutes: 90,
          hourlyRate: 3e5,
          amount: 45e4,
          rateName: "Tarif Dasar"
        }
      ],
      totalPrice: 45e4,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isDemo: true
    },
    {
      id: "demo-b2",
      bookingCode: "MS-2609-A102",
      secretToken: "demo-token-2222-cccc-dddd",
      date: today,
      startTime: "19:00",
      endTime: "21:00",
      durationMinutes: 120,
      customerName: "Reza Pratama",
      customerWhatsapp: "081987654321",
      teamName: "Senayan Ballers",
      bookingSource: "whatsapp",
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      priceBreakdown: [
        {
          fromTime: "19:00",
          toTime: "21:00",
          durationMinutes: 120,
          hourlyRate: 35e4,
          amount: 7e5,
          rateName: "Tarif Malam (Peak Hour)"
        }
      ],
      totalPrice: 7e5,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isDemo: true
    },
    {
      id: "demo-b3",
      bookingCode: "MS-2609-A103",
      secretToken: "demo-token-3333-eeee-ffff",
      date: tomorrow,
      startTime: "16:00",
      endTime: "18:00",
      durationMinutes: 120,
      customerName: "Dimas Setiawan",
      customerWhatsapp: "085712345678",
      teamName: "Kelapa Gading United",
      bookingSource: "phone",
      bookingStatus: "confirmed",
      paymentStatus: "unpaid",
      priceBreakdown: [
        {
          fromTime: "16:00",
          toTime: "18:00",
          durationMinutes: 120,
          hourlyRate: 3e5,
          amount: 6e5,
          rateName: "Tarif Dasar"
        }
      ],
      totalPrice: 6e5,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isDemo: true
    }
  ];
  const demoClosures = [
    {
      id: "demo-c1",
      date: today,
      startTime: "11:45",
      endTime: "13:00",
      reason: "Perawatan Rumput & Penyiraman",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      isDemo: true
    }
  ];
  return {
    settings: { ...DEFAULT_SETTINGS },
    bookings: demoBookings,
    closures: demoClosures
  };
}
var Store = class {
  constructor() {
    this.locks = /* @__PURE__ */ new Map();
    this.idempotencyCache = /* @__PURE__ */ new Map();
    this.data = this.loadFromDisk();
  }
  loadFromDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(content);
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          bookings: parsed.bookings || [],
          closures: parsed.closures || []
        };
      }
    } catch (err) {
      console.warn("Could not read db file, initializing with demo data", err);
    }
    const initial = getInitialDemoData();
    this.saveToDisk(initial);
    return initial;
  }
  saveToDisk(data) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error saving db file", err);
    }
  }
  async withDateLock(dateStr, fn) {
    while (this.locks.has(dateStr)) {
      await this.locks.get(dateStr);
    }
    let resolveLock;
    const lockPromise = new Promise((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(dateStr, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(dateStr);
      resolveLock();
    }
  }
  getSettings() {
    return { ...this.data.settings };
  }
  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.saveToDisk(this.data);
    return this.getSettings();
  }
  getAllBookings() {
    return [...this.data.bookings];
  }
  getAllClosures() {
    return [...this.data.closures];
  }
  getPublicSchedule(dateStr) {
    const { slots, freeRanges, isFull } = generatePublicSchedule(
      dateStr,
      this.data.bookings,
      this.data.closures,
      this.data.settings
    );
    let nearestAvailableDates = [];
    if (isFull) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(baseDate.getTime() + i * 864e5);
        const checkStr = checkDate.toISOString().slice(0, 10);
        const checkSched = generatePublicSchedule(checkStr, this.data.bookings, this.data.closures, this.data.settings);
        if (!checkSched.isFull) {
          nearestAvailableDates.push(checkStr);
          if (nearestAvailableDates.length >= 3) break;
        }
      }
    }
    return {
      date: dateStr,
      venueName: this.data.settings.name,
      openTime: this.data.settings.openTime,
      closeTime: this.data.settings.closeTime,
      bufferMinutes: this.data.settings.bufferMinutes,
      baseHourlyRate: this.data.settings.baseHourlyRate,
      slots,
      freeRanges,
      isFull,
      nearestAvailableDates
    };
  }
  findBookingById(id) {
    return this.data.bookings.find((b) => b.id === id);
  }
  findBookingBySecretToken(token) {
    return this.data.bookings.find((b) => b.secretToken === token);
  }
  findBookingByCodeAndPhone(code, phone) {
    const cleanCode = code.trim().toUpperCase();
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    return this.data.bookings.find((b) => {
      const bCode = b.bookingCode.trim().toUpperCase();
      const bPhone = b.customerWhatsapp.replace(/[^0-9]/g, "");
      const phoneMatch = bPhone.endsWith(cleanPhone) || cleanPhone.endsWith(bPhone);
      return bCode === cleanCode && phoneMatch;
    });
  }
  async createBookingAtomic(input) {
    return this.withDateLock(input.date, async () => {
      if (input.idempotencyKey) {
        const cached = this.idempotencyCache.get(input.idempotencyKey);
        if (cached && Date.now() - cached.timestamp < 10 * 60 * 1e3) {
          return cached.booking;
        }
      }
      const startMins = timeToMinutes(input.startTime);
      const endMins = startMins + input.durationMinutes;
      const endTimeStr = minutesToTime(endMins);
      const minDur = this.data.settings.minDurationMinutes || 60;
      if (input.durationMinutes < minDur) {
        throw new Error(`Durasi sewa minimal adalah ${minDur} menit.`);
      }
      const collision = checkCollision(
        input.date,
        input.startTime,
        endTimeStr,
        this.data.bookings,
        this.data.closures,
        this.data.settings
      );
      if (collision.hasCollision) {
        throw new Error(collision.reason || "Jadwal yang dipilih sudah terisi atau tidak tersedia.");
      }
      const priceCalc = calculatePrice(input.date, input.startTime, input.durationMinutes, this.data.settings);
      const datePart = input.date.replace(/-/g, "").slice(2);
      const randPart = crypto.randomBytes(2).toString("hex").toUpperCase();
      const bookingCode = `MS-${datePart}-${randPart}`;
      const secretToken = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex");
      const newBooking = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `b-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        bookingCode,
        secretToken,
        date: input.date,
        startTime: input.startTime,
        endTime: endTimeStr,
        durationMinutes: input.durationMinutes,
        customerName: input.customerName.trim(),
        customerWhatsapp: input.customerWhatsapp.trim(),
        teamName: input.teamName?.trim(),
        notes: input.notes?.trim(),
        bookingSource: input.bookingSource || "online",
        bookingStatus: "confirmed",
        paymentStatus: input.paymentStatus || "unpaid",
        priceBreakdown: priceCalc.segments,
        totalPrice: priceCalc.totalPrice,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        idempotencyKey: input.idempotencyKey
      };
      this.data.bookings.push(newBooking);
      this.saveToDisk(this.data);
      if (input.idempotencyKey) {
        this.idempotencyCache.set(input.idempotencyKey, {
          booking: newBooking,
          timestamp: Date.now()
        });
      }
      return newBooking;
    });
  }
  async updateBookingScheduleAtomic(id, newDate, newStartTime, newDurationMinutes) {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error("Booking tidak ditemukan.");
    const lockDate1 = booking.date;
    const lockDate2 = newDate;
    return this.withDateLock(lockDate1, async () => {
      return this.withDateLock(lockDate2, async () => {
        const startMins = timeToMinutes(newStartTime);
        const endMins = startMins + newDurationMinutes;
        const endTimeStr = minutesToTime(endMins);
        const collision = checkCollision(
          newDate,
          newStartTime,
          endTimeStr,
          this.data.bookings,
          this.data.closures,
          this.data.settings,
          id
          // exclude self!
        );
        if (collision.hasCollision) {
          throw new Error(collision.reason || "Jadwal baru bertabrakan dengan jadwal lain.");
        }
        const priceCalc = calculatePrice(newDate, newStartTime, newDurationMinutes, this.data.settings);
        booking.date = newDate;
        booking.startTime = newStartTime;
        booking.endTime = endTimeStr;
        booking.durationMinutes = newDurationMinutes;
        booking.priceBreakdown = priceCalc.segments;
        booking.totalPrice = priceCalc.totalPrice;
        booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.saveToDisk(this.data);
        return booking;
      });
    });
  }
  updateBookingDetails(id, updates) {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error("Booking tidak ditemukan.");
    if (updates.customerName !== void 0) booking.customerName = updates.customerName.trim();
    if (updates.customerWhatsapp !== void 0) booking.customerWhatsapp = updates.customerWhatsapp.trim();
    if (updates.teamName !== void 0) booking.teamName = updates.teamName.trim();
    if (updates.notes !== void 0) booking.notes = updates.notes.trim();
    booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToDisk(this.data);
    return booking;
  }
  updatePaymentStatus(id, status) {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error("Booking tidak ditemukan.");
    booking.paymentStatus = status;
    booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToDisk(this.data);
    return booking;
  }
  cancelBooking(id, reason) {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error("Booking tidak ditemukan.");
    booking.bookingStatus = "cancelled";
    booking.cancellationReason = reason || "Dibatalkan oleh pengelola.";
    booking.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToDisk(this.data);
    return booking;
  }
  addClosure(date, startTime, endTime, reason) {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);
    const overlappingBookings = this.data.bookings.filter((b) => {
      if (b.date !== date || b.bookingStatus === "cancelled") return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return startMins < bEnd && endMins > bStart;
    });
    if (overlappingBookings.length > 0) {
      const codes = overlappingBookings.map((b) => `${b.bookingCode} (${b.startTime}\u2013${b.endTime}, ${b.customerName})`).join(", ");
      throw new Error(`Penutupan bertabrakan dengan booking aktif: ${codes}. Harap ubah jadwal atau batalkan booking terlebih dahulu.`);
    }
    const closure = {
      id: crypto.randomUUID(),
      date,
      startTime,
      endTime,
      reason,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.data.closures.push(closure);
    this.saveToDisk(this.data);
    return closure;
  }
  removeClosure(id) {
    this.data.closures = this.data.closures.filter((c) => c.id !== id);
    this.saveToDisk(this.data);
  }
  resetDemoData() {
    this.data = getInitialDemoData();
    this.saveToDisk(this.data);
    return this.data;
  }
};
var store = new Store();

// server.ts
var app = express();
var PORT = 3e3;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  if (typeof req.body === "string" && req.body.trim().length > 0) {
    try {
      req.body = JSON.parse(req.body);
    } catch {
    }
  }
  if (!req.body || typeof req.body !== "object") {
    req.body = {};
  }
  next();
});
app.use((req, res, next) => {
  if (req.url.startsWith("/api/index.js")) {
    req.url = req.url.slice("/api/index.js".length) || "/";
  } else if (req.url.startsWith("/index.js")) {
    req.url = req.url.slice("/index.js".length) || "/";
  }
  if (!req.url.startsWith("/")) {
    req.url = "/" + req.url;
  }
  next();
});
var rateLimitMap = /* @__PURE__ */ new Map();
function rateLimitLookup(req, res, next) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60 * 1e3;
  const maxAttempts = 30;
  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }
  if (current.count >= maxAttempts) {
    return res.status(429).json({
      error: "Terlalu banyak percobaan pencarian booking. Harap tunggu 1 menit sebelum mencoba kembali."
    });
  }
  current.count++;
  next();
}
var OWNER_PASSWORD = process.env.OWNER_PASSWORD || "arena2026";
var ownerSessions = /* @__PURE__ */ new Set();
function createOwnerToken() {
  const ts = Date.now().toString();
  const signature = crypto2.createHmac("sha256", OWNER_PASSWORD).update(ts).digest("hex");
  const token = `${ts}.${signature}`;
  ownerSessions.add(token);
  return token;
}
function verifyOwnerToken(token) {
  if (!token || typeof token !== "string") return false;
  if (ownerSessions.has(token)) return true;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [tsStr, signature] = parts;
  const ts = Number(tsStr);
  if (isNaN(ts)) return false;
  if (Date.now() - ts > 7 * 24 * 60 * 60 * 1e3) return false;
  try {
    const expectedSig = crypto2.createHmac("sha256", OWNER_PASSWORD).update(tsStr).digest("hex");
    if (signature.length !== expectedSig.length) return false;
    return crypto2.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}
function requireOwnerAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Akses ditolak: Silakan login sebagai pengelola/owner terlebih dahulu." });
  }
  const token = authHeader.substring(7).trim();
  if (!verifyOwnerToken(token)) {
    return res.status(401).json({ error: "Sesi login owner sudah kedaluwarsa atau tidak valid." });
  }
  next();
}
var apiRouter = express.Router();
apiRouter.get("/health", (req, res) => {
  res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
});
apiRouter.get("/venue-info", (req, res) => {
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
      specialRates: settings.specialRates.filter((r) => r.isActive),
      paymentTerms: settings.paymentTerms,
      cancellationPolicy: settings.cancellationPolicy
    });
  } catch (err) {
    console.error("Error in /venue-info:", err);
    res.status(500).json({ error: err.message || "Gagal memuat info lapangan." });
  }
});
apiRouter.get("/schedule", (req, res) => {
  const dateStr = req.query.date || getJakartaDateString();
  try {
    const schedule = store.getPublicSchedule(dateStr);
    res.json(schedule);
  } catch (err) {
    console.error("Error in /schedule:", err);
    res.status(500).json({ error: err.message || "Gagal memuat jadwal." });
  }
});
apiRouter.post("/bookings/calculate-price", (req, res) => {
  try {
    const { date, startTime, durationMinutes } = req.body || {};
    if (!date || !startTime || !durationMinutes) {
      return res.status(400).json({ error: "Parameter tanggal, waktu mulai, dan durasi wajib diisi." });
    }
    const settings = store.getSettings();
    const calculation = calculatePrice(date, startTime, Number(durationMinutes), settings);
    res.json(calculation);
  } catch (err) {
    console.error("Error in calculate-price:", err);
    res.status(500).json({ error: err.message || "Gagal menghitung perkiraan harga." });
  }
});
apiRouter.post("/bookings", async (req, res) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes } = req.body || {};
    const idempotencyKey = req.headers["idempotency-key"] || req.body?.idempotencyKey;
    if (!date || !startTime || !durationMinutes || !customerName || !customerWhatsapp) {
      return res.status(400).json({
        error: "Mohon lengkapi tanggal, waktu mulai, durasi, nama, dan nomor WhatsApp."
      });
    }
    const cleanedPhone = customerWhatsapp.replace(/[^0-9]/g, "");
    if (cleanedPhone.length < 9 || cleanedPhone.length > 15) {
      return res.status(400).json({
        error: "Nomor WhatsApp tidak valid. Masukkan nomor ponsel aktif (contoh: 081234567890)."
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
      bookingSource: "online"
    });
    res.status(201).json({
      success: true,
      booking,
      secretToken: booking.secretToken,
      message: "Booking berhasil dikonfirmasi! Silakan simpan kode booking Anda."
    });
  } catch (err) {
    console.error("Booking error:", err);
    res.status(409).json({
      error: err.message || "Terjadi benturan jadwal atau kegagalan saat konfirmasi booking."
    });
  }
});
apiRouter.post("/bookings/lookup", rateLimitLookup, (req, res) => {
  try {
    const { bookingCode, whatsappNumber } = req.body || {};
    if (!bookingCode || !whatsappNumber) {
      return res.status(400).json({
        error: "Kode booking dan nomor WhatsApp wajib diisi untuk mencari pesanan Anda."
      });
    }
    const booking = store.findBookingByCodeAndPhone(bookingCode, whatsappNumber);
    if (!booking) {
      return res.status(404).json({
        error: "Booking tidak ditemukan. Pastikan kode booking dan nomor WhatsApp sudah sesuai."
      });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error("Lookup error:", err);
    res.status(500).json({ error: err.message || "Gagal mencari data booking." });
  }
});
apiRouter.get("/bookings/private/:token", (req, res) => {
  try {
    const { token } = req.params;
    const booking = store.findBookingBySecretToken(token);
    if (!booking) {
      return res.status(404).json({ error: "Tautan booking tidak ditemukan atau sudah tidak valid." });
    }
    res.json({ success: true, booking });
  } catch (err) {
    console.error("Private view error:", err);
    res.status(500).json({ error: err.message || "Gagal memuat rincian booking." });
  }
});
apiRouter.post("/owner/login", (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: "Kata sandi tidak boleh kosong." });
    }
    if (password === OWNER_PASSWORD) {
      const sessionToken = createOwnerToken();
      return res.json({ success: true, token: sessionToken });
    }
    return res.status(401).json({ error: "Kata sandi owner salah." });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Gagal memproses login pengelola." });
  }
});
apiRouter.post("/owner/logout", requireOwnerAuth, (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      ownerSessions.delete(authHeader.substring(7).trim());
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Gagal logout." });
  }
});
apiRouter.get("/owner/dashboard", requireOwnerAuth, (req, res) => {
  try {
    const todayJakarta = getJakartaDateString();
    const allBookings = store.getAllBookings();
    const closures = store.getAllClosures();
    const settings = store.getSettings();
    const activeToday = allBookings.filter((b) => b.date === todayJakarta && b.bookingStatus !== "cancelled");
    const todayBookingsCount = activeToday.length;
    const todayTotalMinutes = activeToday.reduce((acc, b) => acc + b.durationMinutes, 0);
    const todayTotalHours = Math.round(todayTotalMinutes / 60 * 10) / 10;
    const unpaidActive = allBookings.filter((b) => b.bookingStatus !== "cancelled" && b.paymentStatus === "unpaid");
    const unpaidCount = unpaidActive.length;
    const unpaidTotalAmount = unpaidActive.reduce((acc, b) => acc + b.totalPrice, 0);
    res.json({
      todayDate: todayJakarta,
      stats: {
        todayBookingsCount,
        todayTotalHours,
        unpaidCount,
        unpaidTotalAmount
      },
      bookings: allBookings,
      closures,
      settings
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: err.message || "Gagal memuat dashboard pengelola." });
  }
});
apiRouter.post("/owner/bookings", requireOwnerAuth, async (req, res) => {
  try {
    const { date, startTime, durationMinutes, customerName, customerWhatsapp, teamName, notes, bookingSource, paymentStatus } = req.body || {};
    if (!date || !startTime || !durationMinutes || !customerName || !customerWhatsapp) {
      return res.status(400).json({ error: "Mohon lengkapi informasi booking." });
    }
    const booking = await store.createBookingAtomic({
      date,
      startTime,
      durationMinutes: Number(durationMinutes),
      customerName,
      customerWhatsapp,
      teamName,
      notes,
      bookingSource: bookingSource || "whatsapp",
      paymentStatus: paymentStatus || "unpaid"
    });
    res.status(201).json({ success: true, booking });
  } catch (err) {
    console.error("Manual booking error:", err);
    res.status(409).json({ error: err.message || "Gagal menambahkan booking manual." });
  }
});
apiRouter.put("/owner/bookings/:id/schedule", requireOwnerAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, durationMinutes } = req.body || {};
    if (!date || !startTime || !durationMinutes) {
      return res.status(400).json({ error: "Tanggal, waktu mulai, dan durasi wajib diisi." });
    }
    const updated = await store.updateBookingScheduleAtomic(id, date, startTime, Number(durationMinutes));
    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error("Reschedule error:", err);
    res.status(409).json({ error: err.message || "Gagal mengubah jadwal booking." });
  }
});
apiRouter.put("/owner/bookings/:id/contact", requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, customerWhatsapp, teamName, notes } = req.body || {};
    const updated = store.updateBookingDetails(id, { customerName, customerWhatsapp, teamName, notes });
    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error("Update contact error:", err);
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put("/owner/bookings/:id/payment", requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body || {};
    if (!["paid", "unpaid"].includes(paymentStatus)) {
      return res.status(400).json({ error: "Status pembayaran harus paid atau unpaid." });
    }
    const updated = store.updatePaymentStatus(id, paymentStatus);
    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error("Update payment error:", err);
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/owner/bookings/:id/cancel", requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const updated = store.cancelBooking(id, reason);
    res.json({ success: true, booking: updated });
  } catch (err) {
    console.error("Cancel booking error:", err);
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/owner/closures", requireOwnerAuth, (req, res) => {
  try {
    const { date, startTime, endTime, reason } = req.body || {};
    if (!date || !startTime || !endTime || !reason) {
      return res.status(400).json({ error: "Semua kolom penutupan wajib diisi." });
    }
    const closure = store.addClosure(date, startTime, endTime, reason);
    res.status(201).json({ success: true, closure });
  } catch (err) {
    console.error("Closure error:", err);
    res.status(409).json({ error: err.message });
  }
});
apiRouter.delete("/owner/closures/:id", requireOwnerAuth, (req, res) => {
  try {
    const { id } = req.params;
    store.removeClosure(id);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete closure error:", err);
    res.status(400).json({ error: err.message });
  }
});
apiRouter.put("/owner/settings", requireOwnerAuth, (req, res) => {
  try {
    const updatedSettings = store.updateSettings(req.body || {});
    res.json({ success: true, settings: updatedSettings });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(400).json({ error: err.message });
  }
});
apiRouter.post("/owner/reset-demo", requireOwnerAuth, (req, res) => {
  try {
    store.resetDemoData();
    res.json({ success: true, message: "Data demo berhasil direset ke kondisi awal." });
  } catch (err) {
    console.error("Reset demo error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.use((req, res, next) => {
  if (process.env.VERCEL || req.path.startsWith("/api")) {
    return res.status(404).json({ error: `Rute API '${req.method} ${req.originalUrl || req.url}' tidak ditemukan.` });
  }
  next();
});
app.use((err, req, res, next) => {
  console.error("Global Server Error:", err);
  const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
  res.status(status).json({
    error: err.message || "Terjadi kesalahan pada server internal."
  });
});
var server_default = app;
var isServerless2 = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT
);
async function startServer() {
  if (isServerless2) {
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
if (!isServerless2) {
  startServer();
}
export {
  server_default as default
};

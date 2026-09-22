import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Booking, FieldClosure, VenueSettings, PriceCalculationResult, CustomerBookingInput, OwnerBookingInput } from '../src/types';
import { checkCollision, calculatePrice, getJakartaDateString, generatePublicSchedule, timeToMinutes, minutesToTime, normalizeWhatsappNumber } from '../src/utils/timeUtils';
import {
  getPrismaClient,
  mapDbToSettings,
  mapSettingsToDb,
  mapDbToBooking,
  mapBookingToDb,
  mapDbToClosure,
} from './prisma';

// In Vercel / AWS Lambda serverless functions, only /tmp is writable; locally process.cwd()/data is used
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NOW_REGION ||
  process.env.LAMBDA_TASK_ROOT
);
const DATA_DIR = isServerless ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

export interface DatabaseSchema {
  settings: VenueSettings;
  bookings: Booking[];
  closures: FieldClosure[];
  ownerToken?: string;
}

const DEFAULT_SETTINGS: VenueSettings = {
  name: 'MiniSoccer Arena',
  address: 'Jl. Lapangan Hijau No. 18, Jakarta Selatan',
  gmapsUrl: 'https://maps.google.com/?q=Jakarta',
  ownerWhatsapp: '6281234567890',
  openTime: '07:00',
  closeTime: '23:00',
  closedDays: [],
  maxAdvanceDays: 30,
  minDurationMinutes: 60,
  allowedDurations: [60, 90, 120, 180],
  bufferMinutes: 0,
  baseHourlyRate: 300000,
  specialRates: [
    {
      id: 'rule-peak-night',
      name: 'Tarif Malam (Peak Hour)',
      hourlyRate: 350000,
      days: [0, 1, 2, 3, 4, 5, 6],
      startTime: '18:00',
      endTime: '23:00',
      isActive: true,
    },
  ],
  paymentTerms: 'Pembayaran dilakukan di lokasi sebelum kick-off via Cash atau QRIS.',
  cancellationPolicy: 'Pembatalan bebas biaya dapat dilakukan maksimal 6 jam sebelum waktu main.',
};

export function getInitialDemoData(): DatabaseSchema {
  const today = getJakartaDateString();
  const [y, m, d] = today.split('-').map(Number);
  const tomorrowDate = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);

  const demoBookings: Booking[] = [
    {
      id: 'demo-b1',
      bookingCode: 'MS-2609-A101',
      secretToken: 'demo-token-1111-aaaa-bbbb',
      date: today,
      startTime: '14:45',
      endTime: '16:15',
      durationMinutes: 90,
      customerName: 'Budi Santoso',
      customerWhatsapp: '081234567891',
      teamName: 'Garuda FC',
      notes: 'Rompi disediakan pihak lapangan ya min',
      bookingSource: 'online',
      bookingStatus: 'confirmed',
      paymentStatus: 'unpaid',
      priceBreakdown: [
        {
          fromTime: '14:45',
          toTime: '16:15',
          durationMinutes: 90,
          hourlyRate: 300000,
          amount: 450000,
          rateName: 'Tarif Dasar',
        },
      ],
      totalPrice: 450000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'demo-b2',
      bookingCode: 'MS-2609-A102',
      secretToken: 'demo-token-2222-cccc-dddd',
      date: today,
      startTime: '19:00',
      endTime: '21:00',
      durationMinutes: 120,
      customerName: 'Reza Pratama',
      customerWhatsapp: '081987654321',
      teamName: 'Senayan Ballers',
      bookingSource: 'whatsapp',
      bookingStatus: 'confirmed',
      paymentStatus: 'paid',
      priceBreakdown: [
        {
          fromTime: '19:00',
          toTime: '21:00',
          durationMinutes: 120,
          hourlyRate: 350000,
          amount: 700000,
          rateName: 'Tarif Malam (Peak Hour)',
        },
      ],
      totalPrice: 700000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
    {
      id: 'demo-b3',
      bookingCode: 'MS-2609-A103',
      secretToken: 'demo-token-3333-eeee-ffff',
      date: tomorrow,
      startTime: '16:00',
      endTime: '18:00',
      durationMinutes: 120,
      customerName: 'Dimas Setiawan',
      customerWhatsapp: '085712345678',
      teamName: 'Kelapa Gading United',
      bookingSource: 'phone',
      bookingStatus: 'confirmed',
      paymentStatus: 'unpaid',
      priceBreakdown: [
        {
          fromTime: '16:00',
          toTime: '18:00',
          durationMinutes: 120,
          hourlyRate: 300000,
          amount: 600000,
          rateName: 'Tarif Dasar',
        },
      ],
      totalPrice: 600000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDemo: true,
    },
  ];

  const demoClosures: FieldClosure[] = [
    {
      id: 'demo-c1',
      date: today,
      startTime: '11:45',
      endTime: '13:00',
      reason: 'Perawatan Rumput & Penyiraman',
      createdAt: new Date().toISOString(),
      isDemo: true,
    },
  ];

  return {
    settings: { ...DEFAULT_SETTINGS },
    bookings: demoBookings,
    closures: demoClosures,
  };
}

class Store {
  private data: DatabaseSchema;
  private locks = new Map<string, Promise<void>>();
  private idempotencyCache = new Map<string, { booking: Booking; timestamp: number }>();

  constructor() {
    this.data = this.loadFromDisk();
    // Initialize MySQL Prisma sync if DATABASE_URL is provided
    this.initPrismaSync().catch((err) => {
      console.warn('[Prisma] Inisialisasi awal database dilewati:', err.message);
    });
  }

  private async initPrismaSync() {
    const prisma = getPrismaClient();
    if (!prisma) return;
    try {
      // 1. Sync settings
      const dbSetting = await prisma.venueSetting.findUnique({ where: { id: 'default' } });
      if (dbSetting) {
        this.data.settings = mapDbToSettings(dbSetting, this.data.settings);
      } else {
        await prisma.venueSetting.create({
          data: { id: 'default', ...mapSettingsToDb(this.data.settings) },
        });
      }

      // 2. Sync bookings
      const count = await prisma.booking.count();
      if (count > 0) {
        const dbBookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
        this.data.bookings = dbBookings.map(mapDbToBooking);
      } else if (this.data.bookings.length > 0) {
        for (const b of this.data.bookings) {
          await prisma.booking.create({ data: mapBookingToDb(b) }).catch(() => {});
        }
      }

      // 3. Sync closures
      const closureCount = await prisma.fieldClosure.count();
      if (closureCount > 0) {
        const dbClosures = await prisma.fieldClosure.findMany();
        this.data.closures = dbClosures.map(mapDbToClosure);
      } else if (this.data.closures.length > 0) {
        for (const c of this.data.closures) {
          await prisma.fieldClosure.create({
            data: {
              id: c.id,
              date: c.date,
              startTime: c.startTime,
              endTime: c.endTime,
              reason: c.reason,
              isDemo: Boolean(c.isDemo),
            },
          }).catch(() => {});
        }
      }

      this.saveToDisk(this.data);
      console.log('[Store] Berhasil sinkronisasi dengan database MySQL via Prisma.');
    } catch (err: any) {
      console.warn('[Store] MySQL Prisma sync skipped (tabel belum siap atau db:push diperlukan):', err.message);
    }
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
          bookings: parsed.bookings || [],
          closures: parsed.closures || [],
        };
      }
    } catch (err) {
      console.warn('Could not read db file, initializing with demo data', err);
    }
    const initial = getInitialDemoData();
    this.saveToDisk(initial);
    return initial;
  }

  private saveToDisk(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db file', err);
    }
  }

  public async withDateLock<T>(dateStr: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(dateStr)) {
      await this.locks.get(dateStr);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
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

  public getSettings(): VenueSettings {
    return { ...this.data.settings };
  }

  public updateSettings(newSettings: Partial<VenueSettings>): VenueSettings {
    const sanitized = { ...newSettings };
    if (sanitized.ownerWhatsapp) {
      sanitized.ownerWhatsapp = normalizeWhatsappNumber(sanitized.ownerWhatsapp) || sanitized.ownerWhatsapp.trim();
    }
    this.data.settings = { ...this.data.settings, ...sanitized };
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.venueSetting
        .upsert({
          where: { id: 'default' },
          create: { id: 'default', ...mapSettingsToDb(this.data.settings) },
          update: mapSettingsToDb(this.data.settings),
        })
        .catch((e) => console.warn('[Prisma] Gagal update VenueSetting di MySQL:', e.message));
    }
    return this.getSettings();
  }

  public getAllBookings(): Booking[] {
    return [...this.data.bookings];
  }

  public getAllClosures(): FieldClosure[] {
    return [...this.data.closures];
  }

  public getPublicSchedule(dateStr: string) {
    const { slots, freeRanges, isFull } = generatePublicSchedule(
      dateStr,
      this.data.bookings,
      this.data.closures,
      this.data.settings
    );

    // If full, find nearest available dates
    let nearestAvailableDates: string[] = [];
    if (isFull) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const baseDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(baseDate.getTime() + i * 86400000);
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
      nearestAvailableDates,
    };
  }

  public findBookingById(id: string): Booking | undefined {
    return this.data.bookings.find(b => b.id === id);
  }

  public findBookingBySecretToken(token: string): Booking | undefined {
    return this.data.bookings.find(b => b.secretToken === token);
  }

  public findBookingByCodeAndPhone(code: string, phone: string): Booking | undefined {
    const cleanCode = code.trim().toUpperCase();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.data.bookings.find(b => {
      const bCode = b.bookingCode.trim().toUpperCase();
      const bPhone = b.customerWhatsapp.replace(/[^0-9]/g, '');
      const phoneMatch = bPhone.endsWith(cleanPhone) || cleanPhone.endsWith(bPhone);
      return bCode === cleanCode && phoneMatch;
    });
  }

  public async createBookingAtomic(input: CustomerBookingInput & { bookingSource?: any; paymentStatus?: any }): Promise<Booking> {
    return this.withDateLock(input.date, async () => {
      // Check idempotency cache
      if (input.idempotencyKey) {
        const cached = this.idempotencyCache.get(input.idempotencyKey);
        if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
          return cached.booking;
        }
      }

      const startMins = timeToMinutes(input.startTime);
      const endMins = startMins + input.durationMinutes;
      const endTimeStr = minutesToTime(endMins);

      // Validate duration
      const minDur = this.data.settings.minDurationMinutes || 60;
      if (input.durationMinutes < minDur) {
        throw new Error(`Durasi sewa minimal adalah ${minDur} menit.`);
      }

      // Check collision
      const collision = checkCollision(
        input.date,
        input.startTime,
        endTimeStr,
        this.data.bookings,
        this.data.closures,
        this.data.settings
      );

      if (collision.hasCollision) {
        throw new Error(collision.reason || 'Jadwal yang dipilih sudah terisi atau tidak tersedia.');
      }

      // Calculate price
      const priceCalc = calculatePrice(input.date, input.startTime, input.durationMinutes, this.data.settings);

      // Generate booking code & secret token
      const datePart = input.date.replace(/-/g, '').slice(2); // e.g. 260921
      const randPart = crypto.randomBytes(2).toString('hex').toUpperCase();
      const bookingCode = `MS-${datePart}-${randPart}`;
      const secretToken = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

      const newBooking: Booking = {
        id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `b-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
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
        bookingSource: input.bookingSource || 'online',
        bookingStatus: 'confirmed',
        paymentStatus: input.paymentStatus || 'unpaid',
        priceBreakdown: priceCalc.segments,
        totalPrice: priceCalc.totalPrice,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey,
      };

      this.data.bookings.push(newBooking);
      this.saveToDisk(this.data);

      const prisma = getPrismaClient();
      if (prisma) {
        prisma.booking.create({ data: mapBookingToDb(newBooking) }).catch((e) => {
          console.warn('[Prisma] Gagal menyimpan booking ke MySQL:', e.message);
        });
      }

      if (input.idempotencyKey) {
        this.idempotencyCache.set(input.idempotencyKey, {
          booking: newBooking,
          timestamp: Date.now(),
        });
      }

      return newBooking;
    });
  }

  public async updateBookingScheduleAtomic(
    id: string,
    newDate: string,
    newStartTime: string,
    newDurationMinutes: number
  ): Promise<Booking> {
    // Lock both old and new date if different
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');

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
          id // exclude self!
        );

        if (collision.hasCollision) {
          throw new Error(collision.reason || 'Jadwal baru bertabrakan dengan jadwal lain.');
        }

        const priceCalc = calculatePrice(newDate, newStartTime, newDurationMinutes, this.data.settings);

        booking.date = newDate;
        booking.startTime = newStartTime;
        booking.endTime = endTimeStr;
        booking.durationMinutes = newDurationMinutes;
        booking.priceBreakdown = priceCalc.segments;
        booking.totalPrice = priceCalc.totalPrice;
        booking.updatedAt = new Date().toISOString();

        this.saveToDisk(this.data);
        return booking;
      });
    });
  }

  public updateBookingDetails(
    id: string,
    updates: { customerName?: string; customerWhatsapp?: string; teamName?: string; notes?: string }
  ): Booking {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');

    if (updates.customerName !== undefined) booking.customerName = updates.customerName.trim();
    if (updates.customerWhatsapp !== undefined) booking.customerWhatsapp = updates.customerWhatsapp.trim();
    if (updates.teamName !== undefined) booking.teamName = updates.teamName.trim();
    if (updates.notes !== undefined) booking.notes = updates.notes.trim();
    booking.updatedAt = new Date().toISOString();

    this.saveToDisk(this.data);
    return booking;
  }

  public updatePaymentStatus(id: string, status: 'paid' | 'unpaid'): Booking {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');
    booking.paymentStatus = status;
    booking.updatedAt = new Date().toISOString();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.booking
        .updateMany({
          where: { id },
          data: { paymentStatus: status },
        })
        .catch((e) => console.warn('[Prisma] Gagal update payment status di MySQL:', e.message));
    }

    return booking;
  }

  public cancelBooking(id: string, reason?: string): Booking {
    const booking = this.findBookingById(id);
    if (!booking) throw new Error('Booking tidak ditemukan.');
    booking.bookingStatus = 'cancelled';
    booking.cancellationReason = reason || 'Dibatalkan oleh pengelola.';
    booking.updatedAt = new Date().toISOString();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.booking
        .updateMany({
          where: { id },
          data: {
            bookingStatus: 'cancelled',
            cancellationReason: booking.cancellationReason,
          },
        })
        .catch((e) => console.warn('[Prisma] Gagal update cancel booking di MySQL:', e.message));
    }

    return booking;
  }

  public addClosure(date: string, startTime: string, endTime: string, reason: string): FieldClosure {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    // Check if overlaps any ACTIVE booking
    const overlappingBookings = this.data.bookings.filter(b => {
      if (b.date !== date || b.bookingStatus === 'cancelled') return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return startMins < bEnd && endMins > bStart;
    });

    if (overlappingBookings.length > 0) {
      const codes = overlappingBookings.map(b => `${b.bookingCode} (${b.startTime}–${b.endTime}, ${b.customerName})`).join(', ');
      throw new Error(`Penutupan bertabrakan dengan booking aktif: ${codes}. Harap ubah jadwal atau batalkan booking terlebih dahulu.`);
    }

    const closure: FieldClosure = {
      id: crypto.randomUUID(),
      date,
      startTime,
      endTime,
      reason,
      createdAt: new Date().toISOString(),
    };

    this.data.closures.push(closure);
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.fieldClosure
        .create({
          data: {
            id: closure.id,
            date: closure.date,
            startTime: closure.startTime,
            endTime: closure.endTime,
            reason: closure.reason,
            isDemo: false,
          },
        })
        .catch((e) => console.warn('[Prisma] Gagal menyimpan closure di MySQL:', e.message));
    }

    return closure;
  }

  public removeClosure(id: string) {
    this.data.closures = this.data.closures.filter(c => c.id !== id);
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      prisma.fieldClosure.deleteMany({ where: { id } }).catch((e) => console.warn('[Prisma] Gagal hapus closure di MySQL:', e.message));
    }
  }

  public resetDemoData() {
    this.data = getInitialDemoData();
    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      (async () => {
        try {
          await prisma.booking.deleteMany();
          await prisma.fieldClosure.deleteMany();
          for (const b of this.data.bookings) {
            await prisma.booking.create({ data: mapBookingToDb(b) }).catch(() => {});
          }
          for (const c of this.data.closures) {
            await prisma.fieldClosure.create({
              data: {
                id: c.id,
                date: c.date,
                startTime: c.startTime,
                endTime: c.endTime,
                reason: c.reason,
                isDemo: Boolean(c.isDemo),
              },
            }).catch(() => {});
          }
        } catch (e: any) {
          console.warn('[Prisma] Reset demo di MySQL dilewati:', e.message);
        }
      })();
    }

    return this.data;
  }

  public clearDemoData(clearAllBookings = false): { removedBookings: number; removedClosures: number } {
    const beforeB = this.data.bookings.length;
    const beforeC = this.data.closures.length;

    if (clearAllBookings) {
      this.data.bookings = [];
      this.data.closures = [];
    } else {
      // Remove all bookings and closures marked as demo or with demo- prefix
      this.data.bookings = this.data.bookings.filter(b => !b.isDemo && !b.id.startsWith('demo-'));
      this.data.closures = this.data.closures.filter(c => !c.id.startsWith('demo-'));
    }

    const removedBookings = beforeB - this.data.bookings.length;
    const removedClosures = beforeC - this.data.closures.length;

    this.saveToDisk(this.data);

    const prisma = getPrismaClient();
    if (prisma) {
      if (clearAllBookings) {
        prisma.booking.deleteMany().catch(() => {});
        prisma.fieldClosure.deleteMany().catch(() => {});
      } else {
        prisma.booking.deleteMany({ where: { isDemo: true } }).catch(() => {});
        prisma.fieldClosure.deleteMany({ where: { isDemo: true } }).catch(() => {});
      }
    }

    return { removedBookings, removedClosures };
  }
}

export const store = new Store();
